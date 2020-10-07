### `remove(selector[, cb])` [*Isomorphic*]

Remove records from FilesCollection and files from FS.

- `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
- `cb` {*Function*} - Callback, with one `error` argument
- Returns {*FilesCollection*} - Current FilesCollection instance

```js
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({collectionName: 'Images'});

// Usage:
// Drop collection's data and remove all associated files from FS
Images.remove({});
// Remove particular file
Images.remove({_id: 'Rfy2HLutYK4XWkwhm'});
// Equals to above
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).remove();


// Direct Collection usage
// Remove record(s) ONLY from collection
Images.collection.remove({});

// Using callback
Images.remove({_id: 'Rfy2HLutYK4XWkwhm'}, (error) => {
  if (error) {
    console.error(`File wasn't removed, error:  ${error.reason}`);
  } else {
    console.info('File successfully removed');
  }
});
```

*Use onBeforeRemove to avoid unauthorized actions, for more info see [onBeforeRemove callback](https://github.com/VeliovGroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeremove-to-avoid-unauthorized-remove)*

```js
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeRemove(cursor) {
    const records = cursor.fetch();

    if (records && records.length) {
      if (this.userId) {
        const user = this.user();
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
