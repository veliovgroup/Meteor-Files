### `unlinkAsync` [*Server*]

Unlink file an its subversions from FS.

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
await imagesCollection.unlinkAsync(await Images.collection.findOneAsync({}));
// Unlink a version of the file:
await imagesCollection.unlinkAsync(await Images.collection.findOneAsync({}), 'thumbnail');
```
