##### `remove(selector)` [*Isomorphic*]

*Remove records from FilesCollection and files from FS.*

 - `selector` {*Object*} - See [Mongo Selectors](http://docs.meteor.com/#selectors)
 - `cb` {*Function*} - Callback, with one `error` argument
 - Returns {*FilesCollection*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

// Usage:
// Drop collection's data and remove all associated files from FS
Images.remove({});
// Remove particular file
Images.remove({_id: 'Rfy2HLutYK4XWkwhm'});
// Equals to above
Images.findOne({_id: 'Rfy2HLutYK4XWkwhm'}).remove({});


// Direct Collection usage
// Remove record(s) ONLY from collection
Images.collection.remove({})

// Using callback
Images.remove({_id: 'Rfy2HLutYK4XWkwhm'}, function (error) {
  if (error) {
    console.error("File wasn't removed, error: " + error.reason)
  } else {
    console.info("File successfully removed");
  }
});
```

```javascript
// Using onBeforeRemove to avoid unauthorized actions
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeRemove: function (cursor) {
    var records = cursor.fetch();

    if (records && records.length) {
      if (this.userId) {
        var user = this.user();
        // Assuming user.profile.docs is array 
        // with file's records _id(s)

        for (var i = 0, len = records.length; i < len; i++) {
          file = records[i];
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