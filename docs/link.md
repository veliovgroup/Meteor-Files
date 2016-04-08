##### `link(fileRef [, version, isPublic])` [*Isomorphic*]

Create downloadable link.

 - `fileRef` {*Object*} - Object returned from MongoDB collection, like: `Meteor.Files.collection.findOne({})`
 - `version` {*String*} - File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
 - `isPublic` {*Boolean*} - Set to `true` for public collections
 - Returns {*String*} - Full URL to file

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});

// Usage:
Images.collection.find({}).forEach(function (fileRef) {
  Images.link(fileRef);
});

Images.findOne({}).link();
// Get thumbnail subversion
Images.findOne({}).link('thumbnail');
// Equals to above
var fileRef = Images.collection.findOne({});
Images.link(fileRef, 'thumbnail');
```