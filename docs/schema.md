##### Schema

*Below is default Files collection schema. Please keep default schema structure when extending it!. To pass your own schema use* `schema` *property when passing config to* [`Meteor.Files`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) *constructor.*

For more info see [Collection2](https://github.com/aldeed/meteor-collection2) package.

```javascript
var defaultSchema = {
  size: {
    type: Number
  },
  name: {
    type: String
  },
  type: {
    type: String
  },
  path: {
    type: String
  },
  isVideo: {
    type: Boolean
  },
  isAudio: {
    type: Boolean
  },
  isImage: {
    type: Boolean
  },
  _prefix: {
    type: String
  },
  extension: {
    type: String,
    optional: true
  },
  _storagePath: {
    type: String
  },
  _downloadRoute: {
    type: String
  },
  _collectionName: {
    type: String
  },
  meta: {
    type: Object,
    blackbox: true,
    optional: true
  },
  userId: {
    type: String,
    optional: true
  },
  updatedAt: {
    type: Date,
    autoValue: function() {
      return new Date();
    }
  },
  versions: {
    type: Object,
    blackbox: true
  }
};
```

Pass your own schema:
```javascript
var Images;
var mySchema = _.extend(defaultSchema, {
  myProp: {
    type: String
  }
});

Images = new Meteor.Files({
  collectionName: 'Images',
  schema: mySchema
});
```