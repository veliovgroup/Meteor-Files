##### `findOne(selector)` [*Isomorphic*]

Find one file in Files collection. *This method doesn't returns file, it only sets cursor to file (if file exists)*. To get record from collection use `files.collection.findOne({})`.

 - `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
 - Returns {*Files*} - Current Meteor.Files instance

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});

// Usage:
// Set cursor
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'});
// Generate downloadable link:
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).link()
// Get cursor's data
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).get();
// Get cursor as array:
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).fetch()
// Remove record from collection and file from FS
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).remove();


// Direct Collection usage
Images.collection.findOne({_id: 'Rfy2HLutYK4XWkwhm'})
// Remove record from collection
Images.collection.remove({_id: 'Rfy2HLutYK4XWkwhm'})
```