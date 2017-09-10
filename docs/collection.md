##### `FilesCollection.collection` [*Isomorphic*]

*Direct reference to [`Mongo.Collection`](http://docs.meteor.com/#/full/mongo_collection).*

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

if (Meteor.isServer) {
  /* Set deny/allow rules:
   * Deny all
   * @see http://docs.meteor.com/#/full/deny
   */
  Images.denyClient();

  /* Allow all
   * @see http://docs.meteor.com/#/full/allow
   */
  Images.allowClient();

  /* Deny per action
   * @see http://docs.meteor.com/#/full/deny
   */
  Images.deny({
    insert: function() {
      return false;
    },
    update: function() {
      return true;
    },
    remove: function() {
      return false;
    }
  });

  /* Allow per action
   * @see http://docs.meteor.com/#/full/allow
   */
  Images.allow({
    insert: function() {
      return true;
    },
    update: function() {
      return false;
    },
    remove: function() {
      return true;
    }
  });
}

// Example 1:
Images.collection.find({}).forEach(function (fileRef) {
  Images.link(fileRef);
});

// Example: Subscribe:
if (Meteor.isClient) {
  Meteor.subscribe('files.images.all');
}

// Example: Publish:
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return Images.collection.find({});
  });
}

// Publish only necessary fields:
// See issue #316
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return Images.collection.find({}, {
      fields: {
        extension: 1,
        _downloadRoute: 1,
        _collectionName: 1,
        'versions.versionName.extension': 1 // <-- Required only for file's version .link(version), and if extension is different from original file
      }
    });
  });
}
```