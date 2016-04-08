##### `remove(selector)` [*Isomorphic*]

Remove records from collection and files from FS.

 - `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
 - Returns {*Files*} - Current Meteor.Files instance

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});

// Usage:
// Drop collection's data and remove all associated files from FS
Images.remove({});
// Remove particular file
Images.remove({_id: 'Rfy2HLutYK4XWkwhm'});
// Equals to above
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).remove();


// Direct Collection usage
// Remove record(s) from collection
Images.collection.remove({})
```