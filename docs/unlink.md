##### `unlink(fileRef)` [*Server*]

Unlink file an its subversions from FS.
This is low-level method. You shouldn't use it, unless you know what you're doing.

 - `fileRef` {*Object*} - Full `fileRef` object, returned from `Meteor.Files.findOne().get()`
 - Returns {*Files*} - Current Meteor.Files instance

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});
Images.unlink(Images.collection.findOne({}));
```