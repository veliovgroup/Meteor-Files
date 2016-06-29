### How to use GridFS

Example below shows how to handle (store, serve, remove) uploaded files via GridFS.

#### Preparation

Firstly you need to install [gridfs-stream](https://github.com/aheckmann/gridfs-stream):
```shell
npm install --save gridfs-stream
```

#### Create collection

On the next step you'd need to create a FilesCollection instance like this:

```javascript
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

export const Images = new FilesCollection({
  collectionName: 'images',
  allowClientCode: false,
  debug: Meteor.isServer && process.env.NODE_ENV === 'development',
  onBeforeUpload(file) {
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) return true;
    return 'Please upload image, with size equal or less than 10MB';
  },
});

if (Meteor.isServer) {
  Images.denyClient();
}
```

#### Get required packages and set up gfs instance

Firstly we need to import and set up required variables we'll be using. To do this add
the following at the top at the file:

```javascript
import Grid from 'gridfs-stream'; // We'll use this package to work with GridFS
import fs from 'fs';              // Required to read files intially uploaded via Meteor-Files

// Set up gfs instance
let gfs;
if (Meteor.isServer) {
  const mongo = MongoInternals.NpmModules.mongodb.module; // eslint-disable-line no-undef
  gfs = Grid(Meteor.users.rawDatabase(), mongo);
}
```

#### Store and serve from GridFS

Next thing we need to do is to add onAfterUpload and interceptDownload hooks that would move
file to GridFS once it's uploaded and to serve file from GridFS once it's requested:

```javascript
  onAfterUpload(image) {
    // Move file to GridFS
    Object.keys(image.versions).forEach(versionName => {
      const writeStream = gfs.createWriteStream({
        filename: image.name,
        contentType: image.type,
        metadata: { versionName, imageId: image._id, storedAt: new Date() }, // Optional
      });

      fs.createReadStream(image.versions[versionName].path).pipe(writeStream);

      writeStream.on('close', Meteor.bindEnvironment(file => {
        const property = `versions.${versionName}.meta.gridFsFileId`;

        // If we store the ObjectID itself, Meteor (EJSON?) seems to convert it to a
        // LocalCollection.ObjectID, which GFS doesn't understand.
        this.collection.update(image._id, { $set: { [property]: file._id.toString() } });
        this.unlink(this.collection.findOne(image._id), versionName); // Unlink files from FS
      }));
    });
  },
  interceptDownload(http, image, versionName) {
    const _id = (image.versions[versionName].meta || {}).gridFsFileId;
    if (_id) {
      const readStream = gfs.createReadStream({ _id });
      readStream.on('error', err => { throw err; });
      readStream.pipe(http.response);
    }
    return Boolean(_id); // Serve file from either GridFS or FS if it wasn't uploaded yet
  },
```

#### Handle removing

OK, we can now store files to GridFS and serve them. But what will happen if we decide to
delete an image? An Image document will be deleted, but a GridFS record will stay in db forever!
That's not what we want, right?

So let's fix this:

```javascript
if (Meteor.isServer) {
  // Intercept Image collection remove method to remove file from GridFS
  Images._origRemove = Images.remove;
  Images.remove = function remove(search) {
    this.collection.find(search).fetch().forEach(image => {
      Object.keys(image.versions).forEach(versionName => {
        const _id = (image.versions[versionName].meta || {}).gridFsFileId;
        if (_id) gfs.remove({ _id }, err => { if (err) throw err; });
      });
    });

    // Call original method
    Images._origRemove(search);
  };
}
```

#### Final result

Here's a full listing of what we get in the end:

```javascript
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import Grid from 'gridfs-stream';
import fs from 'fs';

let gfs;
if (Meteor.isServer) {
  const mongo = MongoInternals.NpmModules.mongodb.module; // eslint-disable-line no-undef
  gfs = Grid(Meteor.users.rawDatabase(), mongo);
}

export const Images = new FilesCollection({
  collectionName: 'images',
  allowClientCode: false,
  debug: Meteor.isServer && process.env.NODE_ENV === 'development',
  onBeforeUpload(file) {
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) return true;
    return 'Please upload image, with size equal or less than 10MB';
  },
  onAfterUpload(image) {
    // Move file to GridFS
    Object.keys(image.versions).forEach(versionName => {
      const writeStream = gfs.createWriteStream({
        filename: image.name,
        contentType: image.type,
        metadata: { versionName, imageId: image._id, storedAt: new Date() },
      });

      fs.createReadStream(image.versions[versionName].path).pipe(writeStream);

      writeStream.on('close', Meteor.bindEnvironment(file => {
        const property = `versions.${versionName}.meta.gridFsFileId`;

        // If we store the ObjectID itself, Meteor (EJSON?) seems to convert it to a
        // LocalCollection.ObjectID, which GFS doesn't understand.
        this.collection.update(image._id, { $set: { [property]: file._id.toString() } });
        this.unlink(this.collection.findOne(image._id), versionName); // Unlink files from FS
      }));
    });
  },
  interceptDownload(http, image, versionName) {
    const _id = (image.versions[versionName].meta || {}).gridFsFileId;
    if (_id) {
      const readStream = gfs.createReadStream({ _id });
      readStream.on('error', err => { throw err; });
      readStream.pipe(http.response);
    }
    return Boolean(_id); // Serve file from either GridFS or FS if it wasn't uploaded yet
  },
});

if (Meteor.isServer) {
  Images.denyClient();

  // Intercept Image collection remove method to remove file from GridFS
  Images._origRemove = Images.remove;
  Images.remove = function remove(search) {
    this.collection.find(search).fetch().forEach(image => {
      Object.keys(image.versions).forEach(versionName => {
        const _id = (image.versions[versionName].meta || {}).gridFsFileId;
        if (_id) gfs.remove({ _id }, err => { if (err) throw err; });
      });
    });

    // Call original method
    Images._origRemove(search);
  };
}
```
