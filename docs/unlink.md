### `unlink(fileRef [, version, callback])` [*Server*]

Unlink file an its subversions from FS.

__This is low-level method. You shouldn't use it__, unless you know what you're doing.

Unlike [`fs.remove`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/remove.md) if `callback` is not specified method wouldn't throw an exception on error.

- `fileRef` {*Object*} - Full `fileRef` object, returned from `FilesCollection.findOne().get()`
- `version` {*String*} - [Optional] If specified, only subversion will be unlinked
- `callback` {*Function*} - [Optional] Triggered after file is removed. If cursor has multiple files, will be triggered for each file. If file has multiple subversions, will be triggered for each version.
- Returns {*FilesCollection*} - Current FilesCollection instance

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({collectionName: 'images'});
imagesCollection.unlink(Images.collection.findOne({}));
// OR:
imagesCollection.unlink(Images.collection.findOne({}), 'thumbnail');
```

