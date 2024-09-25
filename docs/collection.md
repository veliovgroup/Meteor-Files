### `FilesCollection.collection` [*Isomorphic*]

*Direct reference to [`Mongo.Collection`](http://docs.meteor.com/#/full/mongo_collection).*

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

if (Meteor.isServer) {
  /* Set deny/allow rules:
   * Deny all
   * @see http://docs.meteor.com/#/full/deny
   */
  imagesCollection.denyClient();

  /* Allow all
   * @see http://docs.meteor.com/#/full/allow
   */
  imagesCollection.allowClient();

  /* Deny per action
   * @see http://docs.meteor.com/#/full/deny
   */
  imagesCollection.deny({
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
  imagesCollection.allow({
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
imagesCollection.collection.find({}).forEach(function (fileRef) {
  imagesCollection.link(fileRef);
});

// Example: Subscribe:
if (Meteor.isClient) {
  Meteor.subscribe('files.images.all');
}

// Example: Publish:
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find({});
  });
}

// Publish only necessary fields:
// See issue #316
if (Meteor.isServer) {
  Meteor.publish('files.images.all', function () {
    return imagesCollection.collection.find({}, {
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
