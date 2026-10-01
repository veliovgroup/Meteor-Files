# Use AWS:S3 as storage

The example below shows how to store and serve uploaded files via S3 with a `storage` adapter. The adapter also removes the files from S3 when a record is removed from *FilesCollection*.

The example uses the modular [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/) (`@aws-sdk/client-s3`). The old `aws-sdk` v2 package is in maintenance mode, do not use it in new code.

First, install the S3 client:

```shell
meteor npm install --save @aws-sdk/client-s3
```

For files larger than 5 GB, or to get automatic multipart uploads, also install `@aws-sdk/lib-storage` and use its `Upload` class instead of `PutObjectCommand`.

Typical regions are listed below, see the full list in the AWS S3 console. *Every region is supported.*

* US East (N. Virginia, default): `us-east-1`
* US West (Oregon): `us-west-2`
* US West (Northern California): `us-west-1`
* EU (Ireland): `eu-west-1`
* EU (Frankfurt): `eu-central-1`
* Asia Pacific (Singapore): `ap-southeast-1`
* Asia Pacific (Tokyo): `ap-northeast-1`
* South America (Sao Paulo): `sa-east-1`

Prepare: Get access to AWS S3:

* Go to [aws.amazon.com/s3](https://aws.amazon.com/s3/) (*Sign(in|up) if required*)
* Create an S3 bucket in the preferred region
* Create an IAM user (or role) with a policy for that bucket, and get an "Access Key Id" and "Secret Access Key"
* The policy needs the actions `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the bucket's objects

## Settings.json

First, create the `settings.json` file and add AWS:S3 credentials to it:

Use it with: `meteor --settings settings.json`

```json
{
  "s3": {
    "key": "AWSKEY",
    "secret": "AWSSECRET",
    "bucket": "BUCKETNAME",
    "region": "us-west-1"
  }
}
```

### Use environment variable to set settings

Instead of using `settings.json`, an environment variable can be used:

```js
import { Meteor } from 'meteor/meteor';
/** env.var example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx"}}' **/
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}
```

## Store files in AWS:S3 with a storage adapter

File: `Server-side-file-store.js`.
Use this in Meteor's `imports/server` directory, __NOT__ on the client.

The adapter is passed as the [`storage` option](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md). Uploads are written to `storagePath` first. When a file is complete, `put()` copies it to S3 and deletes the local copy. Its result is stored at `versions.<name>.meta.storage`, before the document insert and before `onAfterUpload`. `serve()` streams through `createReadStream()` with the requested byte range, so `Range`, `responseHeaders`, and `Content-Disposition` work as with local files. `removeAsync()` and `unlinkAsync()` call `remove()`.

`put()` gets `{ source }` as its 4th argument. When `source` is `'addFile'`, the local file belongs to the caller of `addFile()`, so the adapter keeps it.

```js
import fs from 'node:fs';
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/* Example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx"}}' meteor */
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}

const s3Conf = Meteor.settings.s3 || {};
if (!s3Conf.key || !s3Conf.secret || !s3Conf.bucket || !s3Conf.region) {
  throw new Meteor.Error(401, 'Missing Meteor file settings');
}

class S3Storage {
  constructor({ client, bucket, prefix = '' }) {
    this.client = client;
    this.bucket = bucket;
    this.prefix = prefix;
  }

  async put(fileRef, versionName, localPath, { source } = {}) {
    const vRef = fileRef.versions[versionName];
    const key = `${this.prefix}${fileRef._id}/${versionName}${fileRef.extensionWithDot || ''}`;
    const { size } = await fs.promises.stat(localPath);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentLength: size,
      ContentType: vRef.type || fileRef.type,
    }));
    // Files passed to `addFile()` belong to the caller
    if (source !== 'addFile') {
      await fs.promises.unlink(localPath);
    }
    return { name: 's3', bucket: this.bucket, key };
  }

  async stat(fileRef, versionName) {
    return fileRef.versions[versionName]?.meta?.storage?.key ? { size: fileRef.versions[versionName].size } : null;
  }

  async createReadStream(fileRef, versionName, { start, end } = {}) {
    const key = fileRef.versions[versionName]?.meta?.storage?.key;
    if (!key) {
      throw new Meteor.Error(404, 'File not found');
    }
    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: Number.isInteger(start) ? `bytes=${start}-${end}` : undefined,
    }));
    return res.Body;
  }

  async remove(fileRef, versionName) {
    const key = fileRef.versions[versionName]?.meta?.storage?.key;
    if (key) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
  }
}

const s3 = new S3Client({
  region: s3Conf.region,
  credentials: { accessKeyId: s3Conf.key, secretAccessKey: s3Conf.secret },
});

export const UserFiles = new FilesCollection({
  collectionName: 'userFiles',
  storagePath: 'assets/app/uploads/uploadedFiles',
  storage: new S3Storage({ client: s3, bucket: s3Conf.bucket, prefix: 'files/' }),
});
```

`stat()` is optional. Without it `download()` can not answer `404` or apply `integrityCheck` before streaming. The `stat()` above trusts the size stored in the document. Call `HeadObjectCommand` instead to check that the object exists.

Files created by `onAfterUpload` subversions must be passed to `this.storage.put(fileRef, versionName, localPath)` and the result saved at `versions.<name>.meta.storage`. Pass `{ source: 'write' }` as the 4th argument to let the adapter delete the local file after the copy, or `{ source: 'addFile' }` to keep it. With the adapter above, `onAfterUpload` no longer finds the original file on local disk. Create subversions from the S3 object, or with the Lambda function below.

## Further image (JPEG, PNG) processing with AWS Lambda

The basic concept: you already have an S3 folder that you use for storage above. We set a Lambda trigger on that folder. For each file saved into it (plus any other condition you wish), the function saves a thumbnail into another folder.

First, sign in to your AWS console and select your region from the top bar. Go to your Lambda dashboard and create a new function (Node.js 20 or newer).

Add a trigger for S3, select your bucket, select "All object create events", set the prefix to `files/` (the folder used for storage above), check Enable trigger and save (Add). The function writes thumbnails to `thumb/` in the same bucket. Without the prefix every thumbnail triggers the function again, which runs in a loop and keeps adding cost. The handler below also skips keys under `thumb/` as a second guard. Then add the function code. The code is your `.js` file zipped together with the `node_modules` folder it uses. The Lambda handler setting must match the file name (e.g. file `ImageResizer.js` requires the handler `ImageResizer.handler`). Upload your ZIP file.

Pick one of two resizers:

  1. The official Lambda resizer by AWS: [full documentation here](https://aws.amazon.com/blogs/compute/resize-images-on-the-fly-with-amazon-s3-aws-lambda-and-amazon-api-gateway/). It is based on [sharp](https://sharp.pixelplumbing.com/). Download the ZIP from the Amazon documentation and follow the steps above. Update the packages in `package.json` to the latest versions and run `npm install` before you zip `index.js` and the `node_modules` folder together.
  2. The resizer below, based on `sharp`. It resizes to JPG, 420px width, 85% quality, and sets `Cache-Control` to 10 days.

`sharp` has native binaries. Install it for the Lambda platform, for example `npm install --os=linux --cpu=x64 sharp` (use `--cpu=arm64` for Graviton functions).

#### `package.json`

```json
{
  "name": "amazon-lambda-resizer",
  "version": "0.0.2",
  "description": "Resizer for lambda images in a S3 bucket from a source_folder to target_folder",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "sharp": "^0.34.0"
  },
  "keywords": [
    "node",
    "lambda",
    "aws"
  ]
}
```

The Lambda runtime for Node.js already includes `@aws-sdk/client-s3`. Keep it in `dependencies` for local testing, or remove it from the ZIP to make the package smaller.

#### `index.js`

*Rename to something like* `ImageResizer.js` *and make sure the name matches your Lambda function handler*

```js
const path = require('node:path');
const sharp = require('sharp');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const WEB_WIDTH_MAX = 420;
const WEB_Q_MAX = 85;
const FOLDER_DEST = 'thumb/';

// Credentials come from the Lambda execution role
const s3 = new S3Client({});

exports.handler = async (event) => {
  const srcBucket = event.Records[0].s3.bucket.name;

  // Object key may have spaces or unicode non-ASCII characters.
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

  // Never process the function's own output, it would trigger the function again
  if (srcKey.startsWith(FOLDER_DEST)) {
    return 'Skipped thumbnail';
  }

  const imageName = path.basename(srcKey);

  // Infer the image type.
  const typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    throw new Error('Could not determine the image type.');
  }

  const imageType = typeMatch[1].toLowerCase();
  if (!['jpg', 'jpeg', 'png'].includes(imageType)) {
    throw new Error(`Unsupported image type: ${imageType}`);
  }

  // Download the image from S3 into a buffer.
  const response = await s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: srcKey }));
  const source = Buffer.from(await response.Body.transformToByteArray());

  // Resize and re-encode as JPEG.
  const buffer = await sharp(source)
    .resize({ width: WEB_WIDTH_MAX })
    .jpeg({ quality: WEB_Q_MAX })
    .toBuffer();

  // Upload the thumbnail to a different folder of the same bucket.
  await s3.send(new PutObjectCommand({
    Bucket: srcBucket,
    Key: FOLDER_DEST + imageName,
    Body: buffer,
    ContentType: 'image/jpeg',
    CacheControl: 'max-age=864000'
  }));

  return 'Successfully resized image';
};
```

AWS Lambda offers monitoring of these functions as well as debugging. Keep the `console.log` calls in place to see what happens when something does not work.
