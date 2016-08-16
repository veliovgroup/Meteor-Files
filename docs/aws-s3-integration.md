##### Use AWS:S3 As Storage

Example below shows how to store and serve uploaded file via S3. This example also covers file removing from both your application and S3.

See [real, production code](https://github.com/VeliovGroup/Meteor-Files/blob/master/demo/lib/files.collection.coffee)

Prepare: install [knox](https://github.com/Automattic/knox):
```shell
npm install --save knox
```
Or:
```shell
meteor npm install knox
```

Important notice about [supported regions in knox](https://github.com/Automattic/knox#region) package: 
As of this writing, valid values for the `region` option are:

 * US Standard (default): `us-standard`
 * US West (Oregon): `us-west-2`
 * US West (Northern California): `us-west-1`
 * EU (Ireland): `eu-west-1`
 * Asia Pacific (Singapore): `ap-southeast-1`
 * Asia Pacific (Tokyo): `ap-northeast-1`
 * South America (Sao Paulo): `sa-east-1`


Prepare: Get access to AWS S3:
 - Go to http://aws.amazon.com/s3/ (*Sign(in|up) if required*)
 - Click on [Create Bucket](https://console.aws.amazon.com/s3/home)
 - Follow steps __1-3__ from [this docs](https://github.com/Lepozepo/S3#create-your-amazon-s3)
 - Create new [CloudFront Distribution](https://console.aws.amazon.com/cloudfront/home)
    * Select __Web__ as delivery method
    * In __Origin Domain Name__ select your previously created S3 Bucket
    * Click __Create Distribution__
    * After *Distribution* is *Deployed* pick __Domain Name__ for `cfdomain`

```javascript
var knox, bound, client, Request, cfdomain, Collections = {};

if (Meteor.isServer) {
  // Fix CloudFront certificate issue
  // Read: https://github.com/chilts/awssum/issues/164
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

  knox    = Npm.require('knox');
  Request = Npm.require('request');
  bound = Meteor.bindEnvironment(function(callback) {
    return callback();
  });
  cfdomain = 'https://xxx.cloudfront.net'; // <-- Change to your Cloud Front Domain
  client = knox.createClient({
    key: 'xxx',
    secret: 'yyy',
    bucket: 'zzz',
    region: 'jjj'
  });
}

Collections.files = new FilesCollection({
  debug: false, // Change to `true` for debugging
  throttle: false,
  storagePath: 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,
  onAfterUpload: function(fileRef) {
    // In onAfterUpload callback we will move file to AWS:S3
    var self = this;
    _.each(fileRef.versions, function(vRef, version) {
      // We use Random.id() instead of real file's _id 
      // to secure files from reverse engineering
      // As after viewing this code it will be easy
      // to get access to unlisted and protected files
      var filePath = "files/" + (Random.id()) + "-" + version + "." + fileRef.extension;
      client.putFile(vRef.path, filePath, function(error, res) {
        bound(function() {
          var upd;
          if (error) {
            console.error(error);
          } else {
            upd = {
              $set: {}
            };
            upd['$set']["versions." + version + ".meta.pipeFrom"] = cfdomain + '/' + filePath;
            upd['$set']["versions." + version + ".meta.pipePath"] = filePath;
            self.collection.update({
              _id: fileRef._id
            }, upd, function(error) {
              if (error) {
                console.error(error);
              } else {
                // Unlink original files from FS
                // after successful upload to AWS:S3
                self.unlink(self.collection.findOne(fileRef._id), version);
              }
            });
          }
        });
      });
    });
  },
  interceptDownload: function(http, fileRef, version) {
    var path, ref, ref1, ref2;
    path = (ref = fileRef.versions) != null ? (ref1 = ref[version]) != null ? (ref2 = ref1.meta) != null ? ref2.pipeFrom : void 0 : void 0 : void 0;
    if (path) {
      // If file is moved to S3
      // We will pipe request to S3
      // So, original link will stay always secure
      Request({
        url: path,
        headers: _.pick(http.request.headers, 'range', 'accept-language', 'accept', 'cache-control', 'pragma', 'connection', 'upgrade-insecure-requests', 'user-agent')
      }).pipe(http.response);
      return true;
    } else {
      // While file is not yet uploaded to S3
      // We will serve file from FS
      return false;
    }
  }
});

if (Meteor.isServer) {
  // Intercept File's collection remove method
  // to remove file from S3
  var _origRemove = Collections.files.remove;

  Collections.files.remove = function(search) {
    var cursor = this.collection.find(search);
    cursor.forEach(function(fileRef) {
      _.each(fileRef.versions, function(vRef) {
        var ref;
        if (vRef != null ? (ref = vRef.meta) != null ? ref.pipePath : void 0 : void 0) {
          client.deleteFile(vRef.meta.pipePath, function(error) {
            bound(function() {
              if (error) {
                console.error(error);
              }
            });
          });
        }
      });
    });
    // Call original method
    _origRemove.call(this, search);
  };
}
```