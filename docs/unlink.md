##### `unlink(fileRef [, version])` [*Server*]

Unlink file an its subversions from FS.
This is low-level method. You shouldn't use it, unless you know what you're doing.

 - `fileRef` {*Object*} - Full `fileRef` object, returned from `FilesCollection.findOne().get()`
 - `version` {*String*} - [Optional] If specified, only subversion will be unlinked
 - Returns {*FilesCollection*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});
Images.unlink(Images.collection.findOne({}));
// OR:
Images.unlink(Images.collection.findOne({}), 'thumbnail');
```