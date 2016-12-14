##### `unlink(fileRef [, version, callback])` [*Server*]

Unlink file an its subversions from FS.
This is low-level method. You shouldn't use it, unless you know what you're doing.
Unlike `fs.unlink` if `callback` is not specified it wouldn't throw an exception on error.

 - `fileRef` {*Object*} - Full `fileRef` object, returned from `FilesCollection.findOne().get()`
 - `version` {*String*} - [Optional] If specified, only subversion will be unlinked
 - `callback` {*Function*} - [Optional] Triggered after file is removed. If cursor has multiple files, will be triggered for each file. If file has multiple subversions, will be triggered for each version.
 - Returns {*FilesCollection*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});
Images.unlink(Images.collection.findOne({}));
// OR:
Images.unlink(Images.collection.findOne({}), 'thumbnail');
```