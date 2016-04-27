##### `find(selector)` [*Isomorphic*]

Set cursor in FilesCollection. *This method doesn't returns file, it only sets cursor to files (if files exists)*. To get records from collection use `files.collection.find({}).fetch()`. To get cursor use `files.find({}).cursor`

 - `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
 - Returns {*FilesCollection*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

// Usage:
// Set cursor
Images.find({});
// Get cursor
Images.find({}).cursor
// Get cursor's data
Images.find({}).fetch();
// Get cursor's data (alternative)
Images.find({}).get();
// Remove all cursor's records and associated files
Images.find({}).remove();
// Remove all files and records
Images.remove();

// Direct Collection usage
Images.collection.find({})
// Remove only Collection records from DB
Images.collection.remove({})
```