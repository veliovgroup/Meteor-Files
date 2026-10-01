# Use AWS:S3 as storage

The example below shows how to store and serve uploaded files via S3. It also removes the files from S3 when a record is removed from *FilesCollection*.

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

## Move a file to AWS:S3 after upload

File: `Server-side-file-store.js`.
Use this in Meteor's `imports/server` directory, __NOT__ on the client.

```js
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { FilesCollection } from 'meteor/ostrio:files';
import fs from 'node:fs';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

/* Example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx"}}' meteor */
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}

const s3Conf = Meteor.settings.s3 || {};

/* Check settings existence in `Meteor.settings` */
/* This is the best practice for app security */
if (!s3Conf.key || !s3Conf.secret || !s3Conf.bucket || !s3Conf.region) {
  throw new Meteor.Error(401, 'Missing Meteor file settings');
}

// Create a new S3 client
const s3Client = new S3Client({
  region: s3Conf.region,
  credentials: {
    accessKeyId: s3Conf.key,
    secretAccessKey: s3Conf.secret,
  },
});

/**
 * Resolve a `Range` header into an explicit, inclusive byte range.
 * Returns `null` when the full content must be sent (no header, a malformed header,
 * or a multi-range request), `false` when the range is not satisfiable, and `{ start, end }` otherwise.
 */
const resolveRange = (header, size) => {
  if (!header) {
    return null;
  }

  if (header.includes(',')) {
    // Multi-range requests are answered with full content
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) {
    // Malformed header: ignored, same as `.serve()` does
    return null;
  }

  let start;
  let end;
  if (!match[1]) {
    // Suffix range: the last N bytes
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) {
      return false;
    }
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
  }

  if (start >= size || end < start) {
    return false;
  }

  return { start, end };
};

// Declare the Meteor file collection on the Server
const UserFiles = new FilesCollection({
  debug: false, // Change to `true` for debugging
  storagePath: 'assets/app/uploads/uploadedFiles',
  collectionName: 'userFiles',
  // Disallow Client to execute remove, use a Meteor method
  allowClientCode: false,

  // Start moving files to AWS:S3
  // after fully received by the Meteor server
  async onAfterUpload(fileRef) {
    // Run through each of the uploaded file
    for (const version of Object.keys(fileRef.versions)) {
      const vRef = fileRef.versions[version];
      if (!vRef) {
        continue;
      }

      // We use Random.id() instead of real file's _id
      // to secure files from reverse engineering
      // As after viewing this code it will be easy
      // to get access to unlisted and protected files
      const filePath = `files/${Random.id()}-${version}.${fileRef.extension}`;
      const fileStream = fs.createReadStream(vRef.path);
      fileStream.on('error', (error) => {
        console.error('[onAfterUpload] [createReadStream] [ERROR:] File was not uploaded to S3', fileRef._id, error);
      });

      try {
        await s3Client.send(new PutObjectCommand({
          StorageClass: 'STANDARD',
          Bucket: s3Conf.bucket,
          Key: filePath,
          Body: fileStream,
          ContentLength: vRef.size,
          ContentType: vRef.type,
        }));
      } catch (error) {
        console.error('[onAfterUpload] [PutObjectCommand] Error:', fileRef._id, error);
        continue;
      }

      try {
        await this.collection.updateAsync({ _id: fileRef._id }, {
          $set: {
            [`versions.${version}.meta.pipePath`]: filePath
          }
        });
        // Unlink original file from FS
        // after successful upload to AWS:S3
        await this.unlinkAsync(fileRef, version);
      } catch (_unlinkError) {
        // If file was removed before it was fully moved to S3
        // `.updateAsync()` or `.unlinkAsync()` will throw an error
        // Then we will need to remove that file from S3
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: s3Conf.bucket,
            Key: filePath,
          }));
          console.info('[onAfterUpload] [DeleteObjectCommand] unlinked file successfully removed from S3', fileRef._id);
        } catch (deleteError) {
          console.error('[onAfterUpload] [DeleteObjectCommand] Error:', fileRef._id, deleteError);
        }
      }
    }
  },

  // Intercept calls to `.removeAsync()` to remove file from S3
  // onAfterRemove is called right after the record is removed from the MongoDB Collection
  // and before calling `.unlinkAsync()`,
  // return `true` to prevent calling `.unlinkAsync()`
  async onAfterRemove(docs) {
    for (const doc of docs) {
      for (const version of Object.keys(doc.versions || {})) {
        const vRef = doc.versions[version];
        if (vRef?.meta?.pipePath) {
          try {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: s3Conf.bucket,
              Key: vRef.meta.pipePath,
            }));
            console.info('[onAfterRemove] [DeleteObjectCommand] Successfully removed from S3', vRef.path, vRef.meta.pipePath);
          } catch (error) {
            console.error('[onAfterRemove] [DeleteObjectCommand] Error:', error);
          }
        }
      }
    }

    // Return `true` only if every record was moved to S3
    // and its files were already removed from FS after upload
    return docs.length > 0 && docs.every((doc) => doc.versions?.original?.meta?.pipePath);
  },

  // Intercept access to the file
  // And serve the file from AWS:S3
  async interceptDownload(http, fileRef, version) {
    const vRef = fileRef?.versions?.[version];
    const path = vRef?.meta?.pipePath;

    if (!path) {
      // While file is not yet uploaded to AWS:S3
      // it will be served from FS
      return false;
    }

    // If file is successfully moved to AWS:S3
    // we will pipe the S3 response to the client
    // So, original link will always stay secure

    // To keep ?play and ?download parameters, original file name,
    // content-type, content-disposition, chunked "streaming",
    // and cache-control we use the low-level .serve() method
    const opts = {
      Bucket: s3Conf.bucket,
      Key: path,
    };

    const range = resolveRange(http.request.headers.range, vRef.size);
    // With `strict: false` an unsatisfiable range gets the full content with `200`, as in `.serve()`
    if (range === false && this.strict !== false) {
      http.response.writeHead(416, { 'Content-Range': `bytes */${vRef.size}` });
      http.response.end();
      return true;
    }

    if (range) {
      // Same explicit range for S3 and for .serve()
      opts.Range = `bytes=${range.start}-${range.end}`;
      http.request.headers.range = opts.Range;
    } else {
      // Full content requested: .serve() answers `200`
      delete http.request.headers.range;
    }

    try {
      const { Body } = await s3Client.send(new GetObjectCommand(opts));
      Body.on('error', (error) => {
        console.error('[interceptDownload] [GetObject stream]', error);
        if (!http.response.writableEnded) {
          http.response.end();
        }
      });

      this.serve(http, fileRef, vRef, version, Body);
    } catch (error) {
      console.error('[interceptDownload] [GetObjectCommand]', error);
      if (!http.response.headersSent) {
        http.response.writeHead(404);
      }
      if (!http.response.writableEnded) {
        http.response.end();
      }
    }

    return true;
  }
});
```

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
