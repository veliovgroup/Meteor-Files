### `FilesCollection.collection` [*Isomorphic*]

*Direct reference to [`Mongo.Collection`](https://docs.meteor.com/api/collections.html#Mongo-Collection).*

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

if (Meteor.isServer) {
  /* Set deny/allow rules:
   * Deny all
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
   */
  imagesCollection.denyClient();

  /* Allow all
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
   */
  imagesCollection.allowClient();

  /* Deny per action
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-deny
   */
  imagesCollection.deny({
    insert() {
      return false;
    },
    update() {
      return true;
    },
    remove() {
      return false;
    }
  });

  /* Allow per action
   * @see https://docs.meteor.com/api/collections.html#Mongo-Collection-allow
   */
  imagesCollection.allow({
    insert() {
      return true;
    },
    update() {
      return false;
    },
    remove() {
      return true;
    }
  });
}

// Example 1:
const fileRefs = await imagesCollection.collection.find({}).fetchAsync();
fileRefs.forEach((fileRef) => {
  imagesCollection.link(fileRef);
});

// Example: Subscribe:
if (Meteor.isClient) {
  Meteor.subscribe('files.images.all');
}

// Example: Publish:
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find({});
  });
}

// Publish only necessary fields:
// See issue #316
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find({}, {
      fields: {
        extension: 1,
        _downloadRoute: 1,
        _collectionName: 1,
        'versions.versionName.extension': 1 // <-- Required only for file's version .link(version), and if extension is different from original file
      }
    });
  });
}
```

## Other `FilesCollection` methods

### updateAsync

__[*Isomorphic*]__ `await filesCollection.updateAsync(selector, modifier, options)`. Wraps `Mongo.Collection#updateAsync` and resolves to the number of updated records. `FilesCollection#update()` is the callback-style client-only variant. Use `updateAsync()` on the server.

```js
await imagesCollection.updateAsync(fileId, { $set: { 'meta.processed': true } });
```

### countDocuments

__[*Isomorphic*]__ `await filesCollection.countDocuments(selector?, options?)`. Resolves to the number of records matching `selector`. `selector` is an object or a string (a string is treated as `_id`). `options` are passed to `Mongo.Collection#countDocuments`.

```js
const total = await imagesCollection.countDocuments({ userId: Meteor.userId() });
```

### estimatedDocumentCount

__[*Isomorphic*]__ `await filesCollection.estimatedDocumentCount(options?)`. Resolves to the estimated number of records in the collection. Reads collection metadata instead of scanning documents, so it is faster than `countDocuments()` and ignores selectors.

### download and serve

__[*Server*]__ Use these two methods to answer download requests from your own routes. Most apps never call them, as the package registers the download route itself.

- `await filesCollection.download(http, version = 'original', fileRef)` - Runs `downloadCallback`, then `interceptDownload`, then checks the file on disk and calls `serve()`. Replies with `404` when `fileRef` or the requested version is missing. `http` is `{ request, response, params }`.
- `await filesCollection.serve(http, fileRef, vRef, version = 'original', readableStream = null, responseType = '200', force200 = false)` - Writes the response: sets headers (including `responseHeaders`), handles `Range` requests (`206`/`416`) and streams the file. Pass your own `readableStream` to serve content from a non-filesystem source, as in the [GridFS streaming](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-streaming.md) guide. The [`storage` option](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) does this for you: `serve()` reads through the adapter's `createReadStream()`, as in the [S3 adapter](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md). For a `Range` request, the stream should contain exactly the requested bytes, as `serve()` answers `206` with the parsed `Content-Range`. Otherwise delete `http.request.headers.range` or pass `force200`. On `200`, `serve()` sets `Content-Length` to the stored size, so a custom stream must send the whole file. On `206`, `serve()` sets `Content-Length` only when it reads the file from disk itself, and a custom stream is sent chunked. Set `force200` to `true` to send the full content even if the request has a `Range` header.

For range rules see [custom response headers](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md).

### allow, deny, allowClient, denyClient

__[*Server*]__ Shortcuts for `Mongo.Collection#allow` and `Mongo.Collection#deny`. Each returns the underlying `Mongo.Collection`.

- `filesCollection.allow(rules)` and `filesCollection.deny(rules)` - same `rules` as in Meteor's [`allow`](https://docs.meteor.com/api/collections.html#Mongo-Collection-allow) and [`deny`](https://docs.meteor.com/api/collections.html#Mongo-Collection-deny)
- `filesCollection.allowClient()` - allow `insert`, `update`, and `remove` from client code
- `filesCollection.denyClient()` - deny `insert`, `update`, and `remove` from client code

These rules apply to direct writes to the underlying `Mongo.Collection`. They do not affect uploads, which go through `insertAsync()`, nor `FilesCollection#removeAsync()` from the client. Control those with `onBeforeUpload`, `onBeforeRemove`, and `allowClientCode`, see the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md).

### Events

`FilesCollection` extends [`EventEmitter3`](https://github.com/primus/eventemitter3), so `on()`, `once()`, `off()`, and `emit()` are available. The server emits `afterUpload` with the new file record after an upload or `addFile()`, `writeAsync()`, `loadAsync()` finishes.

```js
imagesCollection.on('afterUpload', (fileObj) => {
  console.log('Uploaded', fileObj._id);
});
```

### Exported helpers and WriteStream

```js
// Client and Server
import { FilesCollection, helpers } from 'meteor/ostrio:files';
// Server only
import { WriteStream } from 'meteor/ostrio:files';
```

- `helpers` - small utility object used internally: type checks (`isObject`, `isString`, `isFunction`, ...), `sanitize(str, max, replacement)`, `clone`, `has`, `omit`, `throttle`. Treat it as internal. It may change between versions.
- `WriteStream` - server-only class that writes upload chunks at their offsets into one file handle. Exported for tests and advanced custom upload handlers. See the class definition in [`write-stream.js`](https://github.com/veliovgroup/Meteor-Files/blob/master/write-stream.js).
