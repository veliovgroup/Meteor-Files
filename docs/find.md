##### `find([selector, options])` [*Isomorphic*]

Find and return Cursor for matching documents.

  - `selector` {*String*|*Object*} - [Mongo-Style selector](http://docs.meteor.com/api/collections.html#selectors)
  - `options` {*Object*} - [Mongo-Style selector Options](http://docs.meteor.com/api/collections.html#sortspecifiers)
  - Returns {*[FilesCursor](https://github.com/VeliovGroup/Meteor-Files/wiki/FilesCursor)*}

```js
import { Meteor }          from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({collectionName: 'Images'});

// Usage:
// Set cursor:
const filesCursor = Images.find();

// Get Mongo cursor:
Meteor.publish('images', function() {
  Images.find().cursor;
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
Images.collection.remove();

// Each:
filesCursor.each(function (file) {
  // Only available in .each():
  file.link();
  file.remove();
  file.with(); // <-- Reactive object
});
```
