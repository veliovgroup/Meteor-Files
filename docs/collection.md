##### `Meteor.Files.collection` [*Isomorphic*]

Direct reference to [`Mongo.Collection`](http://docs.meteor.com/#/full/mongo_collection)

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});

// Example 1:
Images.collection.find({}).forEach(function (fileRef) {
  Images.link(fileRef);
});

// Example: Subscribe:
if (Meteor.isClient) {
  Images.collection.subscribe('files.images.all');
}

// Example: Publish:
if (Meteor.isServer) {
  Meteor.publish 'files.images.all', function () {
    Images.collection.find({});
  }
}
```