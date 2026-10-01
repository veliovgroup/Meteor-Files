### `remove(selector[, cb])` [*Client*]

> __Deprecated.__ The callback API works on the Client only. There is no synchronous `remove()` on the Server. Use [`removeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/removeAsync.md) everywhere.

Remove records from FilesCollection and files from FS. Requires `allowClientCode: true` (default), and `onBeforeRemove` should authorize the user.

- `selector` {*Object*|*String*} - See [Mongo Selectors](https://docs.meteor.com/api/collections.html#selectors)
- `cb` {*Function*} - Callback, with `error` and the number of removed records
- Returns {*FilesCollection*} - Current FilesCollection instance

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage (Client):
// Remove particular file
imagesCollection.remove({_id: 'Rfy2HLutYK4XWkwhm'});
// Equals to above
imagesCollection.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).remove();

// Using callback
imagesCollection.remove({_id: 'Rfy2HLutYK4XWkwhm'}, (error) => {
  if (error) {
    console.error(`File wasn't removed, error:  ${error.reason}`);
  } else {
    console.info('File successfully removed');
  }
});
```

*Use onBeforeRemove to avoid unauthorized actions, for more info see [onBeforeRemove callback](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeremove-to-avoid-unauthorized-remove)*

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
