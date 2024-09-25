# CFS -> Meteor-Files migration guide

*Convert from the now depreciated CollectionFS (CFS) package to this Meteor-Files Package.*

## Brief:

- This is a quick way to migrate files from one collection to the other
- In this example a "schema update" file is used, each time Meteor starts, it checks a known collection for the database version. This way it will update things, without doing it twice
- Script in this example is used for Amazon S3, you can replace new Meteor-Files storage at your option with (local, Dropbox, etc.)
- Old package: [`CollectionFS/Meteor-CollectionFS`](https://github.com/CollectionFS/Meteor-CollectionFS)

## Run this once on startup (__and only once!__)

After this completes, you can remove any of the `cfs:*` packages

__Note__: this creates copies of the files on your local server, make sure there is enough storage space for them!!
I use docker containers, so the files get wiped out on the next container deployment which is why we don't bother deleting them.

```js
let bound = Meteor.bindEnvironment(function (callback) {
  return callback();
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// s3 specific configuration, knox npm must be installed
let client = knox.createClient({
  key: Meteor.settings.s3.key,
  secret: Meteor.settings.s3.secret,
  bucket: Meteor.settings.s3.bucket,
  region: Meteor.settings.s3.region
});


// This is CFS file collection, change Docs to whatever name used in your code - Images, etc.
// run through every single document/file that is stored in CFS and move one by one to Meteor-Files.
Docs.find().forEach(function (fileObj) {
  //console.log('File: ', fileObj.userId);

  // This directory must be writable on server, so a test run first
  // We are going to copy the files locally, then move them to S3
  let fileName    = './assets/app/uploads/' + fileObj.name();
  let newFileName = fileObj.name();

  // This is "example" variable, change it to the userId that you might be using.
  let userId   = fileObj.userId;

  let fileType = fileObj.type();
  let fileSize = fileObj.size();

  var readStream  = fileObj.createReadStream('images');
  var writeStream = fs.createWriteStream(fileName);

  writeStream.on('error', function (err) {
    console.log('Writing error: ', err, fileName);
  });

  // Once we have a file, then upload it to our new data storage
  readStream.on('end', () => {

    console.log('Ended: ', fileName);
    // UserFiles is the new Meteor-Files/FilesCollection collection instance

    UserFiles.addFile(fileName, {
      fileName: newFileName,
      type: fileType,
      meta: {
        userId: userId // not really needed, I use it for tampering detection
      },
      userId: userId,
      size: fileSize
    }, (err, fileRef) => {
      if (err) {
        console.log(err);
      } else {
        console.log('File Inserted: ', fileRef._id);

        // Set the userId again
        UserFiles.update({_id: fileRef._id}, {$set: {userId: userId}});
        let version = 'original';


        // Move to S3 - replace with your storage location
        let filePath = "files/" + (Random.id()) + "-" + version + "." + fileRef.extension;

        client.putFile(fileName, filePath, {"x-amz-server-side-encryption": "AES256"}, function (error, res) {
          bound(function () {
            let upd;

            if (error) {
              console.error(error);
            } else {
              upd = {
                $set: {}
              };

              upd['$set']["versions." + version + ".meta.pipeFrom"] = Meteor.settings.s3.cfdomain + '/' + filePath;
              upd['$set']["versions." + version + ".meta.pipePath"] = filePath;

              // Update the location and unlink the file from the FS
              UserFiles.update({
                _id: fileRef._id
              }, upd, function (error) {

                if (error) {
                  console.error(error);
                } else {
                  // Unlink original files from FS
                  // after successful upload to AWS:S3
                  UserFiles.unlink(UserFiles.findOne(fileRef._id), version);
                }
              });
            }
          });
        });
      }
    });
  });

  readStream.on('error', (error) => {
    console.log('Error: ', fileName, error);
  });

  readStream.pipe(writeStream);
});
```
