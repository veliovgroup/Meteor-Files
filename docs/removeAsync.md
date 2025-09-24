### `removeAsync` [*Anywhere*]

```ts
FilesCollection#removeAsync(selector: MeteorFilesSelector): Promise<number>
```

Remove records from FilesCollection and files from FS.

- `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
- Returns {*Promise<number>*} - Number of removed records

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
// Drop collection's data and remove all associated files from FS
imagesCollection.removeAsync({});
// Remove particular file
imagesCollection.removeAsync({_id: 'Rfy2HLutYK4XWkwhm'});
// Equals to above
const file = await imagesCollection.findOneAsync({_id: 'Rfy2HLutYK4XWkwhm'})
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
    const records = await cursor.fetchAsync();

    if (records && records.length) {
      if (this.userId) {
        const user = await this.userAsync();

        // Assuming user.profile.docs is array
        // with file's records _id(s)
        for (let i = 0, len = records.length; i < len; i++) {
          const file = records[i];
          if (!~user.profile.docs.indexOf(file._id)) {
            // Return false if at least one document
            // is not owned by current user
            return false;
          }
        }
      }
    }

    return true;
  }
});
```
