# Use AWS:S3 As Storage

The example below shows how to store and serve uploaded file via S3. This also covers removing the files from S3 when removed from *FilesCollection*.

First, install aws-sdk [Official AWS SDK Docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html)

```shell
npm install --save aws-sdk
```

Or:

```shell
meteor npm install --save aws-sdk
```

Typical regions are these, see full list at AWS S3 console. *Every region is supported.*

  * US Standard (default): `us-standard`
  * US West (Oregon): `us-west-2`
  * US West (Northern California): `us-west-1`
  * EU (Ireland): `eu-west-1`
  * EU (Frankfurt): `eu-central-1`
  * Asia Pacific (Singapore): `ap-southeast-1`
  * Asia Pacific (Tokyo): `ap-northeast-1`
  * South America (Sao Paulo): `sa-east-1`

Prepare: Get access to AWS S3:

  * Go to [aws.amazon.com/s3](http://aws.amazon.com/s3/) (*Sign(in|up) if required*)
  * Follow the steps from [this procedure - (to the step where policy and user is created)](https://vincetocco.com/backup-your-servers-automatically-to-amazon-aws-s3/)
    * Create an S3 bucket in preferred region
    * Get an "Access Key Id" and "Secret Key"

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

Instead of using `settings.json`, - environment variable can be used:

```js
import { Meteor } from 'meteor/meteor';
/** env.var example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx""}}' **/
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}
```

## Move a file to AWS:S3 after upload

File: `Server-side-file-store.js`.
Use this at Meteor's `imports/server` directory, __NOT__ on the client

```js
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { Random } from 'meteor/random';
import { FilesCollection } from 'meteor/ostrio:files';
import stream from 'stream';

import S3 from 'aws-sdk/clients/s3'; /* http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html */
/* See fs-extra and graceful-fs NPM packages */
/* For better i/o performance */
import fs from 'fs';

/* Example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx""}}' meteor */
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}

const s3Conf = Meteor.settings.s3 || {};
const bound  = Meteor.bindEnvironment((callback) => {
  return callback();
});

/* Check settings existence in `Meteor.settings` */
/* This is the best practice for app security */
if (s3Conf && s3Conf.key && s3Conf.secret && s3Conf.bucket && s3Conf.region) {
  // Create a new S3 object
  const s3 = new S3({
    secretAccessKey: s3Conf.secret,
    accessKeyId: s3Conf.key,
    region: s3Conf.region,
    // sslEnabled: true, // optional
    httpOptions: {
      timeout: 6000,
      agent: false
    }
  });

  // Declare the Meteor file collection on the Server
  const UserFiles = new FilesCollection({
    debug: false, // Change to `true` for debugging
    storagePath: 'assets/app/uploads/uploadedFiles',
    collectionName: 'userFiles',
    // Disallow Client to execute remove, use the Meteor.method
    allowClientCode: false,

    // Start moving files to AWS:S3
    // after fully received by the Meteor server
    onAfterUpload(fileRef) {
      // Run through each of the uploaded file
      _.each(fileRef.versions, (vRef, version) => {
        // We use Random.id() instead of real file's _id
        // to secure files from reverse engineering on the AWS client
        const filePath = 'files/' + (Random.id()) + '-' + version + '.' + fileRef.extension;

        // Create the AWS:S3 object.
        // Feel free to change the storage class from, see the documentation,
        // `STANDARD_IA` is the best deal for low access files.
        // Key is the file name we are creating on AWS:S3, so it will be like files/XXXXXXXXXXXXXXXXX-original.XXXX
        // Body is the file stream we are sending to AWS
        s3.putObject({
          // ServerSideEncryption: 'AES256', // Optional
          StorageClass: 'STANDARD',
          Bucket: s3Conf.bucket,
          Key: filePath,
          Body: fs.createReadStream(vRef.path),
          ContentType: vRef.type,
        }, (error) => {
          bound(() => {
            if (error) {
              console.error(error);
            } else {
              // Update FilesCollection with link to the file at AWS
              const upd = { $set: {} };
              upd['$set']['versions.' + version + '.meta.pipePath'] = filePath;

              this.collection.update({
                _id: fileRef._id
              }, upd, (updError) => {
                if (updError) {
                  console.error(updError);
                } else {
                  // Unlink original files from FS after successful upload to AWS:S3
                  this.unlink(this.collection.findOne(fileRef._id), version);
                }
              });
            }
          });
        });
      });
    },


    // Intercept access to the file
    // And redirect request to AWS:S3
    interceptDownload(http, fileRef, version) {
      let path;

      if (fileRef && fileRef.versions && fileRef.versions[version] && fileRef.versions[version].meta && fileRef.versions[version].meta.pipePath) {
        path = fileRef.versions[version].meta.pipePath;
      }

      if (path) {
        // If file is successfully moved to AWS:S3
        // We will pipe request to AWS:S3
        // So, original link will stay always secure

        // To force ?play and ?download parameters
        // and to keep original file name, content-type,
        // content-disposition, chunked "streaming" and cache-control
        // we're using low-level .serve() method
        const opts = {
          Bucket: s3Conf.bucket,
          Key: path
        };

        if (http.request.headers.range) {
          const vRef  = fileRef.versions[version];
          let range   = _.clone(http.request.headers.range);
          const array = range.split(/bytes=([0-9]*)-([0-9]*)/);
          const start = parseInt(array[1]);
          let end     = parseInt(array[2]);
          if (isNaN(end)) {
            // Request data from AWS:S3 by small chunks
            end       = (start + this.chunkSize) - 1;
            if (end >= vRef.size) {
              end     = vRef.size - 1;
            }
          }
          opts.Range   = `bytes=${start}-${end}`;
          http.request.headers.range = `bytes=${start}-${end}`;
        }

        const fileColl = this;
        s3.getObject(opts, function (error) {
          if (error) {
            console.error(error);
            if (!http.response.finished) {
              http.response.end();
            }
          } else {
            if (http.request.headers.range && this.httpResponse.headers['content-range']) {
              // Set proper range header in according to what is returned from AWS:S3
              http.request.headers.range = this.httpResponse.headers['content-range'].split('/')[0].replace('bytes ', 'bytes=');
            }

            const dataStream = new stream.PassThrough();
            fileColl.serve(http, fileRef, fileRef.versions[version], version, dataStream);
            dataStream.end(this.data.Body);
          }
        });

        return true;
      }
      // While file is not yet uploaded to AWS:S3
      // It will be served file from FS
      return false;
    }
  });

  // Intercept FilesCollection's remove method to remove file from AWS:S3
  const _origRemove = UserFiles.remove;
  UserFiles.remove = function (search) {
    const cursor = this.collection.find(search);
    cursor.forEach((fileRef) => {
      _.each(fileRef.versions, (vRef) => {
        if (vRef && vRef.meta && vRef.meta.pipePath) {
          // Remove the object from AWS:S3 first, then we will call the original FilesCollection remove
          s3.deleteObject({
            Bucket: s3Conf.bucket,
            Key: vRef.meta.pipePath,
          }, (error) => {
            bound(() => {
              if (error) {
                console.error(error);
              }
            });
          });
        }
      });
    });

    //remove original file from database
    _origRemove.call(this, search);
  };
} else {
  throw new Meteor.Error(401, 'Missing Meteor file settings');
}
```

## Further image (JPEG, PNG) processing with AWS Lambda

The basic concept: you already have a S3 folder that you use for storage above. We are going to set a Lambda trigger
 on that folder and for each file saved into (plus any other condition you wish), we will save a thumb into another folder.

First, sign in to your AWS console and select your region from the top bar. Go to your Lambda dashboard and create a new function.

Add a trigger for S3, select your bucket, select "Object Created(All)", check Enable trigger and save (Add). Then add the "Function Code". The code will be your xxx.js file zipped together with the node_modules folder used by your xxx.js file. Please note that your Lambda function will need to have the same name as your xxx.js file (e.g.  JS file name: ImageResizer.js will require the Lambda function name/handler ImageResizer.handler. Upload your ZIP file.

### Your resizer JS file

We will be using two differents methods so please feel free to chose the one you prefer.

  1. Official Lambda resizer by AWS: [full documentation here](https://aws.amazon.com/blogs/compute/resize-images-on-the-fly-with-amazon-s3-aws-lambda-and-amazon-api-gateway/). This is based on sharp.js, claimed to be 4-5 times faster than [ImageMagick](http://sharp.pixelplumbing.com/en/stable/). Just download the ZIP from the Amazon documentation and follow the steps above. You might want to make sure that the packages in the package.json file are at the toppes version. If not, please run an npm install to latest versions in order to generate the updated node_modules before you zip your index.js and node_modules folder together.
  2. Resizer based on ImageMagic (example shows a resize to output JPG, 420px width, 85% quality, with a meta attached for CachControl set to 10 days).

#### `package.json`

```json
{
  "name": "amazon-lambda-resizer",
  "version": "0.0.1",
  "description": "Resizer for lambda images in a S3 bucket from a source_folder to target_folder",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "async": "^2.6.0",
    "aws-sdk": "^2.240.1",
    "gm": "^1.23.1",
    "path": "^0.12.7"
  },
  "keywords": [
    "node",
    "lambda",
    "aws"
  ]
}
```

#### `index.js`

*Change to something like* `ImageResizer.js` *and make sure this has the same name as your Lambda function / handler*

```js
/* Dependencies: */
const async = require('async');
const AWS   = require('aws-sdk');
const gm    = require('gm');
const util  = require('util');
const path  = require('path');
const imageMagick = gm.subClass({ imageMagick: true });

const WEB_WIDTH_MAX = 420;
const WEB_Q_MAX = 85;
const FOLDER_DEST = 'thumb/';

AWS.config.update({
  accessKeyId: 'xxxxxxxxxxx',
  secretAccessKey: 'xxxxxxxxxxxxxxxxxxxx'
});

const s3 = new AWS.S3();

exports.handler = (event, context, callback) => {
  // Read options from the event.
  // console.log('Reading options from event:\n', util.inspect(event, {depth: 5}));
  const srcBucket = event.Records[0].s3.bucket.name;

  // Object key may have spaces or unicode non-ASCII characters.
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  const dstBucket = srcBucket;
  const imageName = path.basename(srcKey);

  // Infer the image type.
  const typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    callback('Could not determine the image type.');
    return;
  }
  const imageType = typeMatch[1];
  if (imageType.toUpperCase() !== 'jpg'.toUpperCase() && imageType.toUpperCase() !== 'png'.toUpperCase() && imageType.toUpperCase() !== 'jpeg'.toUpperCase()) {
    callback(`Unsupported image type: ${imageType}`);
    return;
  }

  // ****************before async******************
  // Download the image from S3, transform, and upload to a different S3 bucket.
  async.waterfall([
    function download (next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket: srcBucket,
        Key: srcKey
      }, next);
    },
    function transformWebMax (response, next) {
      imageMagick(response.Body)
        .resize(WEB_WIDTH_MAX)
        .quality(WEB_Q_MAX)
        // .gravity('Center')
        .strip()
        // .crop(WEB_WIDTH_MAX, WEB_HEIGHT_MAX)
        .toBuffer('jpg', (err, buffer) => {
          if (err) {
            throw new Error(err);
          }
          next(null, response, buffer);
        });
    },
    function uploadWebMax (response, buffer, next) {
      // Stream the transformed image to a different S3 bucket.
      const dstKeyResized = FOLDER_DEST + imageName;
      s3.putObject({
        Bucket: dstBucket,
        Key: dstKeyResized,
        Body: buffer,
        ContentType: response.ContentType,
        CacheControl: 'max-age=864000'
      }, (err, data) => {
        if (err) {
          console.error(err, err.stack);
        } else {
          console.log('uploaded to web-max Successfully !!');
          next(null, response, buffer);
        }
      });
    }
  ], err => {
    if (err) {
      console.error('Unable to resize image');
    } else {
      console.log('Successfully resized image');
    }
    callback(null, 'message');
  });
};
```

AWS Lambda offers monitoring of these functions as well as debugging (ideally you would keep all console.logs in place in order to see what is going on in case something is not working).
