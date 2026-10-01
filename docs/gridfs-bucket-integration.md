# Use GridFS with `GridFSBucket` as a storage

This example shows how to handle (store, serve, remove) uploaded files via GridFS.
The Javascript Mongo driver (the one that Meteor uses under the hood) allows to define
[so called "Buckets"](https://mongodb.github.io/node-mongodb-native/6.0/classes/GridFSBucket.html).

The Buckets are basically named collections for storing the file's metadata and chunkdata.
This allows to *horizontally scale your files* the same way you do with your document collections.

For a working reference, see the example project [`files-gridfs-autoform-example`](https://github.com/veliovgroup/files-gridfs-autoform-example).

## About GridFS

The [MongoDB documentation on GridFS](https://docs.mongodb.com/manual/core/gridfs/) defines it as the following:

> GridFS is a specification for storing and retrieving files that exceed the BSON-document size limit of 16 MB.
>
> Instead of storing a file in a single document, GridFS divides the file into parts, or chunks [1], and stores each
chunk as a separate document. By default, GridFS uses a default chunk size of 255 kB; that is, GridFS divides a file
into chunks of 255 kB with the exception of the last chunk. The last chunk is only as large as necessary.
Similarly, files that are no larger than the chunk size only have a final chunk, using only as much space as needed
plus some additional metadata.

Please note - by default all files will be served with `200` response code, which is fine if you are planning to deal
only with small files, or not planning to serve files back to users (*use only upload and storage*).
For support of `206` partial content see [this article](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-streaming.md).

### 1. Create a `GridFSBucket` factory

Before we can use a bucket, we need to define it with a given name.
This is similar to creating a collection using a name for documents.

The following code is a helper function to create a bucket. It can easily be extended to accept more options:

```js
import { MongoInternals } from 'meteor/mongo';

export const createBucket = (bucketName) => {
  const options = bucketName ? {bucketName} : (void 0);
  return new MongoInternals.NpmModules.mongodb.module.GridFSBucket(MongoInternals.defaultRemoteCollectionDriver().mongo.db, options);
};
```

You could later create a bucket, say `allImages`, like so

```javascript
const imagesBucket = createBucket('allImages');
```

It will be used as target when moving images to your GridFS.

### 2. Create a Mongo Object Id handler

For compatibility reasons we need to support native Mongo `ObjectId` values. In order to simplify this, we also wrap this in a function:

```js
import { MongoInternals } from 'meteor/mongo';

export const createObjectId = ({ gridFsFileId }) => new MongoInternals.NpmModules.mongodb.module.ObjectId(gridFsFileId);
```

### 3. Create an upload handler for the bucket

Our `FilesCollection` will move the files to the GridFS using the `onAfterUpload` handler. In order to stay flexible enough in the choice of the bucket we use a factory function:

```js
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

export const createOnAfterUpload = (bucket) => {
  return async function onAfterUpload(file) {
    // Process all versions of the uploaded file
    for (const versionName of Object.keys(file.versions)) {
      const metadata = { ...file.meta, versionName, fileId: file._id };
      const uploadStream = bucket.openUploadStream(file.name, {
        contentType: file.type || 'binary/octet-stream',
        metadata,
      });

      try {
        await pipeline(fs.createReadStream(file.versions[versionName].path), uploadStream);
        await this.collection.updateAsync(file._id, {
          $set: {
            [`versions.${versionName}.meta.gridFsFileId`]: uploadStream.id.toHexString(),
          },
        });
        // Unlink the original file from FS only after the file is stored in GridFS
        await this.unlinkAsync(await this.collection.findOneAsync(file._id), versionName);
      } catch (error) {
        // The file stays on FS, so it is still served from there
        console.error(error);
      }
    }
  };
};
```

### 4. Create download handler

We also need to handle to retrieve files from GridFS when a download is initiated. We will use the same
factory function as in step 3. The handler uses `serve()` to set `Content-Disposition`, `Content-Type`, and `Cache-Control` headers. It deletes the `Range` header so `serve()` replies with `200` and the whole file. For `206` partial content see [GridFS streaming](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-streaming.md).

```js
import { createObjectId } from '../createObjectId';

export const createInterceptDownload = (bucket) => {
  return function interceptDownload (http, file, versionName) {
    const vRef = file.versions[versionName];
    const { gridFsFileId } = vRef.meta || {};
    if (!gridFsFileId) {
      // Serve file from FS, as it wasn't moved to GridFS yet
      return false;
    }

    // opens the download stream using a given gfs id
    // see: https://mongodb.github.io/node-mongodb-native/6.0/classes/GridFSBucket.html#openDownloadStream
    const readStream = bucket.openDownloadStream(createObjectId({ gridFsFileId }));
    readStream.on('error', () => {
      // not found probably
      if (!http.response.headersSent) {
        http.response.statusCode = 404;
      }
      http.response.end();
    });

    delete http.request.headers.range;
    this.serve(http, file, vRef, versionName, readStream);
    return true;
  };
};
```

### 5. Create remove handler

Finally we need a handler that removes the chunks from the respective GridFS bucket when the `FilesCollection` is removing the file handle:

```js
import { createObjectId } from '../createObjectId'

export const createOnAfterRemove = (bucket) => {
  return async function onAfterRemove (files) {
    for (const file of files) {
      for (const versionName of Object.keys(file.versions)) {
        const gridFsFileId = (file.versions[versionName].meta || {}).gridFsFileId;
        if (gridFsFileId) {
          try {
            await bucket.delete(createObjectId({ gridFsFileId }));
          } catch (error) {
            console.error(error);
          }
        }
      }
    }
  };
};
```

### 6. Create `FilesCollection`

With all our given factories we can flexibly Create a `FilesCollection` instance using a specific bucket. Let's use the previously mentioned `allImages` bucket to create our `Images` collection:

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import { createBucket } from 'path/to/createBucket'
import { createOnAfterUpload } from 'path/to/createOnAfterUpload'
import { createInterceptDownload } from 'path/to/createInterceptDownload'
import { createOnAfterRemove } from 'path/to/createOnAfterRemove'

const imageBucket = createBucket('allImages');

export const imagesCollection = new FilesCollection({
  debug: false, // Change to `true` for debugging
  collectionName: 'images',
  allowClientCode: false,
  onBeforeUpload(file) {
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) return true;
    return 'Please upload image, with size equal or less than 10MB';
  },
  onAfterUpload: createOnAfterUpload(imageBucket),
  interceptDownload: createInterceptDownload(imageBucket),
  onAfterRemove: createOnAfterRemove(imageBucket)
});

if (Meteor.isServer) {
  imagesCollection.denyClient();
  
  // demo / testing only:
  Meteor.publish('files.images.all', () => imagesCollection.collection.find({}));
}

if (Meteor.isClient) {
  Meteor.subscribe('files.images.all');
}
```

### 7. Upload images and Check your mongo shell

To check uploaded images, open MongoDB shell (`mongosh` or `meteor mongo`) and check the `fs.` collections:

```shell
$ meteor mongo
meteor:PRIMARY> db.images.countDocuments()
2 # should be 2 after images have been uploaded

meteor:PRIMARY> db.fs.files.countDocuments()
0 # should be 0 because our bucket is not "fs" but "allImages"

meteor:PRIMARY> db.allImages.files.countDocuments()
2 # our bucket has received two images

meteor:PRIMARY> db.allImages.chunks.countDocuments()
6 # and some more chunk docs
```
