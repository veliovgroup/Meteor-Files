### `unlinkAsync` [*Server*]

Remove file and its subversions through the [storage adapter](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) (`remove()`). With the default `FSStorage` it unlinks the files from FS. A file that is already gone counts as removed.

```ts
FilesCollection#unlinkAsync(fileRef: FileObj, version?: string): Promise<FilesCollection>
```

> [!WARNING]
> __This is low-level method. You shouldn't use it__, unless you know what you're doing.

- `fileRef` {*object*} - Full `fileRef` object, returned from `(await FilesCollection.findOneAsync()).get()`
- `version` {*string*} - [Optional] If specified, only subversion will be unlinked
- Returns {*promise<FilesCollection>*} - Current FilesCollection instance

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});
await imagesCollection.unlinkAsync(await imagesCollection.collection.findOneAsync({}));
// Unlink a version of the file:
await imagesCollection.unlinkAsync(await imagesCollection.collection.findOneAsync({}), 'thumbnail');
```
