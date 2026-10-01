### `removeAsync` [*Isomorphic*]

```ts
FilesCollection#removeAsync(selector: MeteorFilesSelector): Promise<number> // Server
FilesCollection#removeAsync(_id: string): Promise<number> // Client
```

Remove records from FilesCollection and files from FS.

- `selector` {*Object*|*String*} - [*Server*] See [Mongo Selectors](https://docs.meteor.com/api/collections.html#selectors)
- `_id` {*String*} - [*Client*] `_id` of the file to remove
- Returns {*Promise<number>*} - Number of removed records

Since v4 the client removes one file per call. Use `files.find(selector).removeAsync()` to remove several files; it calls the server once per `_id`.

The `onAfterRemove` hook can return `true` to skip deleting files from FS, see [constructor options](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md).

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
// [Server] Drop collection's data and remove all associated files from FS
await imagesCollection.removeAsync({});
// Remove particular file, Server and Client
await imagesCollection.removeAsync('Rfy2HLutYK4XWkwhm');
// Equals to above
const file = await imagesCollection.findOneAsync({_id: 'Rfy2HLutYK4XWkwhm'});
await file.removeAsync();


// Direct Collection usage
// Remove record(s) ONLY from collection
await imagesCollection.collection.removeAsync({});
```

*Use onBeforeRemove to avoid unauthorized actions, for more info see [`onBeforeRemove` callback](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeremove-to-avoid-unauthorized-remove)*

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({
  collectionName: 'images',
  allowClientCode: true,
  async onBeforeRemove(cursor) {
    if (!this.userId) {
      return false;
    }

    const records = await cursor.fetchAsync();
    // Allow removal only if the current user owns every file
    return records.every((file) => file.userId === this.userId);
  }
});
```
