### `find([selector, options])` [*Isomorphic*]

Find and return Cursor for matching documents.

- `selector` {*String*|*Object*} - [Mongo-Style selector](http://docs.meteor.com/api/collections.html#selectors)
- `options` {*Object*} - [Mongo-Style selector Options](http://docs.meteor.com/api/collections.html#sortspecifiers)
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
  imagesCollection.find().cursor;
});

// Get cursor's data:
filesCursor.fetch();
// Get cursor's data (alternative):
filesCursor.get();

// Remove all cursor's records and associated files:
filesCursor.remove(function (error) {
  if (error) {
    console.error('File(s) is not removed!', error);
  }
});
// Remove only Collection records from DB:
imagesCollection.collection.remove();

// Each:
filesCursor.each(function (file) {
  // Only available in .each():
  file.link();
  file.remove();
  file.with(); // <-- Reactive object
});
```
