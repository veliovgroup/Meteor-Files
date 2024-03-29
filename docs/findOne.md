### `findOne([selector, options])` [*Isomorphic*]

Finds the first document that matches the selector, as ordered by sort and skip options.

- `selector` {*String*|*Object*} - [Mongo-Style selector](http://docs.meteor.com/api/collections.html#selectors)
- `options` {*Object*} - [Mongo-Style selector Options](http://docs.meteor.com/api/collections.html#sortspecifiers)
- Returns {*[FileCursor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md)*}

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
// Set cursor:
const file = imagesCollection.findOne({_id: 'Rfy2HLutYK4XWkwhm'});
// Generate downloadable link:
file.link();
// Get cursor's data as plain Object:
file.get();
file.get('_id'); // <-- returns sub-property value, if exists
// Get cursor's data as reactive Object
file.with();
// Get cursor as array:
file.fetch();
// Remove record from collection and file from FS
file.remove(function (error) {
  if (error) {
    console.error('File wasn\'t removed', error);
  }
});


// Direct Collection usage:
imagesCollection.collection.findOne({_id: 'Rfy2HLutYK4XWkwhm'});
// Remove record from collection:
imagesCollection.collection.remove({_id: 'Rfy2HLutYK4XWkwhm'});
```
