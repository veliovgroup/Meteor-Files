### `removeAsync` [*Isomorphic*]

```ts
FilesCollection#removeAsync(selector: MeteorFilesSelector): Promise<number>
```

Remove records from FilesCollection and files from FS.

- `selector` {*Object*} - See [Mongo Selectors](https://docs.meteor.com/api/collections.html#selectors)
- Returns {*Promise<number>*} - Number of removed records

The `onAfterRemove` hook can return `true` to skip deleting files from FS, see [constructor options](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md).

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
// Drop collection's data and remove all associated files from FS
await imagesCollection.removeAsync({});
// Remove particular file
await imagesCollection.removeAsync({_id: 'Rfy2HLutYK4XWkwhm'});
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
