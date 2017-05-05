##### Use AWS:S3 As Storage

The example below shows how to store and serve uploaded file via S3. This also covers removing the files from S3 when removed from your collection. 


Prepare: install aws-sdk [Official AWS SDK Docs](//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html)
```shell
npm install --save aws-sdk
```
Or:
```shell
meteor npm install --save aws-sdk
```

Typical regions are these, you can get this from your AWS S3 console. Every region is supported. 
 * US Standard (default): `us-standard`
 * US West (Oregon): `us-west-2`
 * US West (Northern California): `us-west-1`
 * EU (Ireland): `eu-west-1`
 * Asia Pacific (Singapore): `ap-southeast-1`
 * Asia Pacific (Tokyo): `ap-northeast-1`
 * South America (Sao Paulo): `sa-east-1`


Prepare: Get access to AWS S3:
- Go to http://aws.amazon.com/s3/ (*Sign(in|up) if required*)
- Follow the steps from [this procedure - (you can stop when the user is created and policy attached)](https://vincetocco.com/backup-your-servers-automatically-to-amazon-aws-s3/)
    * Create an S3 bucket in your preferred region
    * Get an "Access Key Id" and "Secret Key"


- Create new [CloudFront Distribution](https://console.aws.amazon.com/cloudfront/home)
* Note: if you are only pipeing data through your server and don't need public direct access, you don't need cloudfront
    * Select __Web__ as delivery method
    * In __Origin Domain Name__ select your previously created S3 Bucket
    * Click __Create Distribution__
    * After *Distribution* is *Deployed* pick __Domain Name__ for `cfdomain`
#
### Settings.json
##### First off create a settings.json file and add your AWS S3 information to it:
##### Then you will run "meteor --settings settings.json"
```javascript
{
  "s3": {
    "key": "AWSKEY",
    "secret": "AWSSECRET",
    "bucket": "YOURBUCKETNAME",
    "region": "us-west-1",
    "cfdomain": "https://XXXXXXXXXXX.cloudfront.net"
  }
}
```
#
### Server-side-file-store.js
##### Import this into your meteor imports/server directory, NOT the client
```javascript
import {Meteor} from 'meteor/meteor';
import {check} from 'meteor/check';
import {_} from 'meteor/underscore';
import {Random} from 'meteor/random';
import {FilesCollection} from 'meteor/ostrio:files';

let _origRemove;

import AWS from 'aws-sdk';  //http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
let fs = require('fs');

//We are checking that the following things exist in your meteor.settings file
//This is best practice for app security
if (Meteor.settings.s3 &&
  Meteor.settings.s3.key &&
  Meteor.settings.s3.secret &&
  Meteor.settings.s3.bucket &&
  Meteor.settings.s3.region &&
  Meteor.settings.s3.cfdomain) {
  
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;  //this might be needed for a cloudfront issue, I haven't run into it

//use the settings file for our secrets, or you can paste them in manually
  const options = {
    secretAccessKey: Meteor.settings.s3.secret,
    accessKeyId: Meteor.settings.s3.key,
    region: Meteor.settings.s3.region,
    sslEnabled: true,
  };

//create a new S3 object
  let s3 = new AWS.S3(options);

//declare the meteor file collection on the SERVER
  var UserFiles = new FilesCollection({
    debug: true,
    throttle: false,
    chunkSize: 1024 * 1024,
    storagePath: 'assets/app/uploads/uploadedFiles',
    collectionName: 'userFiles',
    //do not allow client to run remove, we will create a method for that
    allowClientCode: false,

//this runs after the upload is received by the meteor server
    onAfterUpload: function (fileRef) {
      'use strict';

      let self = this;
      // We use Random.id() instead of real file's _id
      // to secure files from reverse engineering on the AWS client
      
      //run through each of the uploaded files
      _.each(fileRef.versions, function (vRef, version) {

        let filePath = 'files/' + (Random.id()) + '-' + version + '.' + fileRef.extension;

        //console.log('Starting server upload: ', vRef);
        //console.log('uploading here: ', vRef.path);
        //console.log('file path: ', filePath);

        //create a file stream to read it in
        let fileBuffer = fs.readFileSync(vRef.path);

        //create the AWS object
        //You can change the storage class from the documentation, STANDARD_IA is the best deal for low access files
        //Key is the file name we are creating on AWS, so it will be like files/XXXXXXXXXXXXXXXXX-original.XXXX
        //Body is the file stream we are sending to AWS
        s3.putObject(
          {
            ServerSideEncryption: 'AES256',
            StorageClass: 'STANDARD_IA',
            Bucket: Meteor.settings.s3.bucket,
            Key: filePath,
            Body: fileBuffer,
            ContentType: vRef.type,
          }, Meteor.bindEnvironment(function (error, response) {
            
            console.log('uploaded file[' + vRef.path + '] to [' + filePath + ']');

            if (error) {
              console.error(error);
            }
            else {
              let upd = {
                $set: {}
              };
              
              //update our collection with the file storage location inside AWS
              upd['$set']['versions.' + version + '.meta.pipeFrom'] = Meteor.settings.s3.cfdomain + '/' + filePath;
              upd['$set']['versions.' + version + '.meta.pipePath'] = filePath;

              self.collection.update({
                _id: fileRef._id
              }, upd, function (error) {
                if (error) {
                  console.error(error);
                }
                // Unlink original files from FS after successful upload to AWS:S3
                else {
                  self.unlink(self.collection.findOne(fileRef._id), version);
                }
              });
            }
          })
        );
      });
    },

      //this runs when anyone tries to access files
      //to make sure only the user can access it or administrators
      //IsUserAdmin you need to create for your own purposes, or remove it
    'protected': function (fileObj) {
      console.log('Running protected mode - file download');
      //console.log('Protected file object: ', fileObj);

      //if we are not logged in, deny the file access
      if (!this.userId) {
        return false;
      }

      //if the logged in user owns the file, or an admin is trying to access it allow it
      if (this.userId === fileObj.userId || IsUserAdmin(this.userId, 'File Download')) {
        return true;
      }
      console.log('protected mode false - file download', this.userId, fileObj);
      return false;
    },

    //some checks before we send it to AWS, make sure the meta userId was put in there (we do that on the client)
    //check the file sizes too
    onBeforeUpload: function () {

      if (!this.userId || !this.file.meta) {
        return 'Must be logged in';
      }

      if (this.userId !== this.file.meta.userId) {
        return 'Permissions error';
      }

      if (this.file.size <= 1024 * 1024 * 25) {
        return true;
      } else {
        return 'Max. file size is 25MB you\'ve tried to upload ' + (Meteor.Files.filesize(this.file.size));
      }
    },


    //run this beofore they can download the file
    //its going to pipe it from AWS S3
    interceptDownload: function (http, fileRef, version) {
      let path;

      if (fileRef && fileRef.versions && fileRef.versions[version] && fileRef.versions[version].meta && fileRef.versions[version].meta.pipePath) {
        path = fileRef.versions[version].meta.pipePath;
      }

      //console.log('Download path: ', path, version);

      if (path) {
        //pipe the request from S3 through us and direct into the http socket
        //need to set the header so the file shows up properly

        //this is needed if you want to view the files in the browser
        //set the content type and lenth to what we recorded
        http.response.setHeader('content-type', fileRef.type || 'application/pdf');
        http.response.setHeader('content-length', fileRef.size || 0);


        //get the file/key and pipe it into out http response
        s3.getObject({
          Bucket: Meteor.settings.s3.bucket,
          Key: path,
        }).createReadStream().on('error', function (err) {
          console.error(err);
        }).pipe(http.response);

        return true;
      }
      else {
        //no path :(
        console.error('Could not find the file path', fileRef, version);
        return false;
      }
    }
  });

//do not allow clients to modify the collection directly
  UserFiles.denyClient();


// Intercept File's collection remove method
// to remove file from S3
  _origRemove = UserFiles.remove;

  
  UserFiles.remove = function (search) {

    let cursor = this.collection.find(search);

    cursor.forEach(function (fileRef) {


      _.each(fileRef.versions, function (vRef) {
        'use strict';

        let filePath;
        if (vRef && vRef.meta && vRef.meta.pipePath) {
          filePath = vRef.meta.pipePath;
        }

        if (filePath) {
          //remove the object from S3 first, then we will call the original collection remove
          s3.deleteObject({
            Bucket: Meteor.settings.s3.bucket,
            Key: filePath,
          }, function (error, response) {
            if (error) {
              console.error(error);
            }
          });
        }
      });
    });

    //remove original file from database
    _origRemove.call(this, search);
  };



  //a publication to send out the files a user owns
  Meteor.publish('files.all', function () {
    return UserFiles.find({userId: this.userId}).cursor;
  });



  //some example methods on how to rename a file, and removing a file method
  Meteor.methods({
    RenameMeteorFile: function (fileId, newName) {
      'use strict';

      // let validName = /^[^{}<>|]+$/;

      //if there is anything not in this list, then fail
      let validName = /[^a-zA-Z0-9 .:+()\-_%!&]/gi;

      check(fileId, String);
      check(newName, String);

      //if this passes, there are invalid characters
      if (validName.test(newName)) {
        throw new Meteor.Error('Invalid Name', 'You cant do that');
      }

      if (!this.userId) {
        throw new Meteor.Error('Not Logged In', 'You cant do that');
      }


      let file = UserFiles.findOne({
        _id: fileId,
        userId: this.userId
      });

      //console.log('File found for rename: ', file);
      if (file) {
        return UserFiles.update(fileId, {
          $set: {
            'name': newName,
            'meta.originalName': file.name
          }
        });
      }
    },

    RemoveMeteorFile: function (fileId) {
      'use strict';

      check(fileId, String);

      if (!this.userId) {
        throw new Meteor.Error('Not Logged In', 'You cant do that');
      }

      let file = UserFiles.findOne({
        _id: fileId,
        userId: this.userId
      });

      if (!_.isEmpty(file)) {
        UserFiles.remove({_id: file._id});
      }
    }
  });
}

else {
  throw new Meteor.Error(401, 'Missing Meteor file settings');
}
```
#
### Client side example to access the file store
```javascript
import {Meteor} from 'meteor/meteor';
import {FilesCollection} from 'meteor/ostrio:files';

UserFiles = new FilesCollection({
  debug: true,
  collectionName: 'userFiles',
  allowClientCode: false, // Disallow remove files from Client
  onBeforeUpload: function (file) {
    //allow uploads under 25MB
    if (file.size <= 1024 * 1024 * 25) {
      return true;
    }
    else {
      return 'Please upload documents, with size equal or less than 25MB';
    }
  }
});


//This goes in your code once you have the files in place, from a form event
let file = event.currentTarget.files[0];
let uploadInstance = UserFiles.insert({
          file: file,
          meta: {
            userId: Meteor.userId()
          },
          streams: 'dynamic',
          chunkSize: 'dynamic',
          allowWebWorkers: false
        }, false);

```
