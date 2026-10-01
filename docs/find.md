### `find([selector, options])` [*Isomorphic*]

Find and return Cursor for matching documents.

- `selector` {*String*|*Object*} - [Mongo-Style selector](https://docs.meteor.com/api/collections.html#selectors)
- `options` {*Object*} - [Mongo-Style selector Options](https://docs.meteor.com/api/collections.html#sortspecifiers)
- Returns {*[FilesCursor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)*}

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
// Set cursor:
const filesCursor = imagesCollection.find();

// Get Mongo cursor:
Meteor.publish('images', function() {
  return imagesCollection.find().cursor;
});

// Get cursor's data (Client only, use fetchAsync() on the Server):
filesCursor.fetch();
// Get cursor's data (alternative):
filesCursor.get();
// Get cursor's data (Isomorphic):
const files = await filesCursor.fetchAsync();

// Remove all cursor's records and associated files:
const removed = await filesCursor.removeAsync();
// Remove only Collection records from DB:
await imagesCollection.collection.removeAsync({});

// Each: `eachAsync()` returns an Array of FileCursor instances
const fileCursors = await filesCursor.eachAsync();
for (const file of fileCursors) {
  // Only available on FileCursor items:
  file.link();
  await file.removeAsync();
}
```
