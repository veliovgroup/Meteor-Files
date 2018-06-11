##### `link(fileRef [, version])` [*Isomorphic*]

Create downloadable link.

  - `fileRef` {*Object*} - Object returned from MongoDB collection, like: `FilesCollection.collection.findOne({})`
  - `version` {*String*} - File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
  - Returns {*String*} - Full URL to file

```js
import { FilesCollection } from 'meteor/ostrio:files';
const Images = new FilesCollection({collectionName: 'Images'});

// Usage:
Images.collection.find({}).forEach(function (fileRef) {
  Images.link(fileRef);
});

Images.findOne({}).link();
// Get thumbnail subversion
Images.findOne({}).link('thumbnail');
// Equals to above
const fileRef = Images.collection.findOne({});
Images.link(fileRef, 'thumbnail');
```
