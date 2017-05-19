### Use AWS:S3 As Storage

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
 * Asia Pacific (Singapore): `ap-southeast-1`
 * Asia Pacific (Tokyo): `ap-northeast-1`
 * South America (Sao Paulo): `sa-east-1`


Prepare: Get access to AWS S3:
 - Go to http://aws.amazon.com/s3/ (*Sign(in|up) if required*)
 - Follow the steps from [this procedure - (to the step where policy and user is created)](https://vincetocco.com/backup-your-servers-automatically-to-amazon-aws-s3/)
    * Create an S3 bucket in preferred region
    * Get an "Access Key Id" and "Secret Key"

### Settings.json
First, create the `settings.json` file and add AWS:S3 credentials to it:

Use it with: `meteor --settings settings.json`
```jsx
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
// env.var example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx""}}'
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}
```

### Server-side-file-store.js
Use this at Meteor's `imports/server` directory, __NOT__ the client
```jsx
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { Random } from 'meteor/random';
import { FilesCollection } from 'meteor/ostrio:files';

import S3 from 'aws-sdk/clients/s3'; // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
// See fs-extra and graceful-fs NPM packages
// For better i/o performance
import fs from 'fs';

// Example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx""}}' meteor
if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}

const s3Conf = Meteor.settings.s3 || {};
const bound  = Meteor.bindEnvironment((callback) => {
  return callback();
});

// Check settings existence in `Meteor.settings`
// This is the best practice for app security
if (s3Conf && s3Conf.key && s3Conf.secret && s3Conf.bucket && s3Conf.region) {
  // Create a new S3 object
  const s3 = new S3({
    secretAccessKey: s3Conf.secret,
    accessKeyId: s3Conf.key,
    region: s3Conf.region,
    sslEnabled: true
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
          ServerSideEncryption: 'AES256',
          StorageClass: 'STANDARD_IA',
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
              }, upd, function (updError) {
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
          Key: path,
        };

        if (http.request.headers.range) {
          opts.Range = http.request.headers.range;
        }
        this.serve(http, fileRef, fileRef.versions[version], version, client.getObject(opts).createReadStream());
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
