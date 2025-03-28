# Use GridFS with `GridFSBucket` as a storage

This example shows how to handle (store, serve, remove) uploaded files via GridFS.
The Javascript Mongo driver (the one that Meteor uses under the hood) allows to define
[so called "Buckets"](http://mongodb.github.io/node-mongodb-native/3.6/api/GridFSBucket.html).

The Buckets are basically named collections for storing the file's metadata and chunkdata.
This allows to *horizontally scale your files* the same way you do with your document collections.

**A note for beginners:** This tutorial is a bit advanced and we try to explain the involved steps as detailed as
possible. If you still need some reference to play with, we have set up an example project. The project
is available via [`files-gridfs-autoform-example`](https://github.com/veliovgroup/files-gridfs-autoform-example)

## About GridFS

The [MongoDB documentation on GridFS](https://docs.mongodb.com/manual/core/gridfs/) defines it as the following:

> GridFS is a specification for storing and retrieving files that exceed the BSON-document size limit of 16 MB.
>  
> Instead of storing a file in a single document, GridFS divides the file into parts, or chunks [1], and stores each
chunk as a separate document. By default, GridFS uses a default chunk size of 255 kB; that is, GridFS divides a file
into chunks of 255 kB with the exception of the last chunk. The last chunk is only as large as necessary.
Similarly, files that are no larger than the chunk size only have a final chunk, using only as much space as needed
plus some additional metadata.

Please note - by default all files will be served with `200` response code, which is fine if you planning to deal
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
}
```

You could later create a bucket, say `allImages`, like so

```javascript
const imagesBucket = createBucket('allImages');
```

It will be used as target when moving images to your GridFS.

### 2. Create a Mongo Object Id handler

For compatibility reasons we need support native Mongo `ObjectId` values. In order to simplify this,
we also wrap this in a function:

```js
import { MongoInternals } from 'meteor/mongo';

export const createObjectId = ({ gridFsFileId }) => new MongoInternals.NpmModules.mongodb.module.ObjectId(gridFsFileId);
```

### 3. Create an upload handler for the bucket

Our `FilesCollection` will move the files to the GridFS using the `onAfterUpload` handler.
In order to stay flexible enough in the choice of the bucket  we use a factory function:

```js
import { Meteor } from 'meteor/meteor';
import fs from 'fs';

export const createOnAfterUpload = (bucket) => {
  return function onAfterUpload (file) {
    const self = this;

    // here you could manipulate your file
    // and create a new version, for example a scaled 'thumbnail'
    // ...

    // then we read all versions we have got so far
    Object.keys(file.versions).forEach((versionName) => {
      const metadata = { ...file.meta, versionName, fileId: file._id };
      const readStream = fs.createReadStream(file.versions[versionName].path).on('open', () => {
        const uploadStream = bucket
          .openUploadStream(file.name, {
            contentType: file.type || 'binary/octet-stream',
            metadata,
          })

        // this is where we upload the binary to the bucket

        readStream.pipe(
          uploadStream
            .on('error', (err) => {
              console.error(err);
              self.unlink(await this.collection.findOneAsync(file._id), versionName);
            })
            .on('finish', async () => {
              const property = `versions.${versionName}.meta.gridFsFileId`
              try {
                await self.collection.updateAsync(file._id, {
                  $set: {
                    [property]: uploadStream.id.toHexString(),
                  },
                })
                self.unlink(await this.collection.findOneAsync(file._id), versionName);
              } catch (error) {
                console.error(error);
              }
            })
          })
        })
      })
    })
  },
};
```

### 4. Create download handler

We also need to handle to retrieve files from GridFS when a download is initiated. We will use the same
factory function as in step 3:

```js
import { createObjectId } from '../createObjectId';

export const createInterceptDownload = (bucket) => {
  return function interceptDownload (http, file, versionName) {
    const { gridFsFileId } = file.versions[ versionName ].meta || {};
    if (gridFsFileId) {
      // opens the download stream using a given gfs id
      // see: http://mongodb.github.io/node-mongodb-native/3.6/api/GridFSBucket.html#openDownloadStream
      const gfsId = createObjectId({ gridFsFileId });
      const readStream = bucket.openDownloadStream(gfsId);

      readStream.on('data', (data) => {
        http.response.write(data);
      });

      readStream.on('end', () => {
        http.response.end('end');
      });

      readStream.on('error', () => {
        // not found probably
        // eslint-disable-next-line no-param-reassign
        http.response.statusCode = 404;
        http.response.end('not found');
      });

      http.response.setHeader('Cache-Control', this.cacheControl);
      
      const dispositionName = "filename=\"" + (encodeURIComponent(file.name)) + "\"; filename=*UTF-8\"" + (encodeURIComponent(file.name)) + "\"; ";
      const dispositionEncoding = 'charset=utf-8';
      http.response.setHeader('Content-Disposition', dispositionType + dispositionName + dispositionEncoding);
    }
    return Boolean(gridFsFileId); // Serve file from either GridFS or FS if it wasn't uploaded yet
  };
};
```

### 5. Create remove handler

Finally we need a handler that removes the chunks from the respective GridFS bucket when the `FilesCollection`
is removing the file handle:

```js
import { createObjectId } from '../createObjectId'

export const createOnAfterRemove = (bucket) => {
  return function onAfterRemove (files) {
    files.forEach(file => {
      Object.keys(file.versions).forEach(versionName => {
        const gridFsFileId = (file.versions[ versionName ].meta || {}).gridFsFileId;
        if (gridFsFileId) {
          const gfsId = createObjectId({ gridFsFileId });
          bucket.delete(gfsId, err => {
             if (err) console.error(err);
          });
        }
      });
    });
  };
};
```

### 6. Create `FilesCollection`

With all our given factories we can flexibly Create a `FilesCollection` instance using a specific bucket.
Let's use the previously mentioned `allImages` bucket to create our `Images` collection:

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

To check uploaded images — open MongoDB shell (`mongosh` or `meteor mongo`) and check the `fs.` collections:

```shell
$ meteor mongo
meteor:PRIMARY> db.Images.find().count()
2 # should be 2 after images have been uploaded

meteor:PRIMARY> db.fs.files.find().count()
0 # should be 0 because our bucket is not "fs" but "allImages"

meteor:PRIMARY> db.allImages.files.find().count()
2 # our bucket has received two images

meteor:PRIMARY> db.allImages.chunks.find().count()
6 # and some more chunk docs
```
