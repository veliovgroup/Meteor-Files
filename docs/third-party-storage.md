##### How to use third-party storage

Example below shows how to store and serve uploaded file via third-party storage (*DropBox in this case*). This example also covers file removing from both your application and DropBox.

Prepare: install [dropbox-js](https://github.com/dropbox/dropbox-js):
```shell
npm install --save dropbox
```
Or:
```shell
meteor npm install dropbox
```

Prepare: Get access to DropBox API:
 - Go to https://www.dropbox.com/developers (*Sign(in|up) if required*)
 - Click on [Create your app](https://www.dropbox.com/developers/apps/create)
 - Choose "*Dropbox API*"
 - Choose "*App folder*"
 - Type-in your application name
 - Go to you application's *settings*
 - Click on "*Enable additional users*"
 - Obtain "*App key*" for `key` in `new Dropbox.Client({})`
 - Obtain "*App secret*" for `secret` in `new Dropbox.Client({})`
 - Obtain "*Generated access token*" (Click on "*Generate Access token*") for `token` in `new Dropbox.Client({})`

```javascript
var Dropbox, bound, client, fs, Collections = {};

if (Meteor.isServer) {
  Dropbox = Npm.require('dropbox');
  fs = Npm.require('fs');
  bound = Meteor.bindEnvironment(function(callback) {
    return callback();
  });
  client = new Dropbox.Client({
    key: 'xxx',
    secret: 'xxx',
    token: 'xxxxxxxxxxxxxxxxxx'
  });
}

Collections.files = new FilesCollection({
  debug: false, // Change to `true` for debugging
  throttle: false,
  storagePath: 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,
  onAfterUpload: function(fileRef) {
    // In onAfterUpload callback we will move file to DropBox
    var self;
    self = this;
    fs.readFile(fileRef.path, function(error, data) {
      bound(function() {
        if (error) {
          console.error(error);
        } else {
          // Write file to DropBox
          client.writeFile(fileRef._id + "." + fileRef.extension, data, function(error, stat) {
            bound(function() {
              if (error) {
                console.error(error);
              } else {
                client.makeUrl(stat.path, {
                  long: true,
                  downloadHack: true // Used to get permanent link
                }, function(error, xml) {
                  bound(function() {
                    // Store downloadable in file's meta object
                    self.collection.update({
                      _id: fileRef._id
                    }, {
                      $set: {
                        'meta.pipeFrom': xml.url,
                        'meta.pipePath': stat.path
                      }
                    }, function(error) {
                      if (error) {
                        console.error(error);
                      } else {
                        // Remove file from FS
                        self.unlink(fileRef);
                      }
                    });
                  });
                });
              }
            });
          });
        }
      });
    });
  },
  interceptDownload: function(http, fileRef, version) {
    var path, ref;
    path = fileRef != null ? (ref = fileRef.meta) != null ? ref.pipeFrom : void 0 : void 0;
    if (path) {
      // If file is moved to DropBox
      // We will redirect browser to DropBox
      http.response.writeHead(302, {
        'Location': path
      });
      // Alternatively you can pipe request to DropBox
      // like: `request.get(path).pipe(http.response)`
      // But you need to handle all headers yourself
      // This example just more simple
      http.response.end();
      return true;
    } else {
      // While file is not uploaded to DropBox
      // We will serve file from FS
      return false;
    }
  }
});

if (Meteor.isServer) {
  // Intercept File's collection remove method
  // to remove file from DropBox
  var _origRemove = Collections.files.remove;
  Collections.files.remove = function(search) {
    var cursor;
    cursor = this.collection.find(search);
    cursor.forEach(function(fileRef) {
      var ref;
      if (fileRef != null ? (ref = fileRef.meta) != null ? ref.pipePath : void 0 : void 0) {
        client.remove(fileRef.meta.pipePath, function(error) {
          if (error) {
            console.error(error);
          }
        });
      }
    });
    // Call original method
    _origRemove.call(this, search);
  };
}
```