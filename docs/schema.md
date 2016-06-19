##### Schema

*Below is default Files collection schema. Please keep default schema structure when extending it!. To pass your own schema use* `schema` *property when passing config to* [`FilesCollection`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) *constructor.*

For more info see [Collection2](https://github.com/aldeed/meteor-collection2) and [simple-schema](https://atmospherejs.com/aldeed/simple-schema) packages.

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
  isText: {
    type: Boolean
  },
  isJSON: {
    type: Boolean
  },
  isPDF: {
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
  public: {
    type: Boolean,
    optional: true
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
    optional: true
  },
  versions: {
    type: Object,
    blackbox: true
  }
};
```

#### Attach schema (*Recommended*):
*Although this package comes with schema it isn't enabled (attached) by default (since v1.5.0), you're free to use it or not. To attach schema you need to install [Collection2](https://github.com/aldeed/meteor-collection2) and [simple-schema](https://atmospherejs.com/aldeed/simple-schema) packages separately.*
```javascript
this.Images = new FilesCollection({ collectionName: 'Images'});
Images.collection.attachSchema(new SimpleSchema(Images.schema));
```

#### Extend default schema:
```javascript
var mySchema = _.extend(defaultSchema, {
  myProp: {
    type: String
  }
});

this.Images = new FilesCollection({
  collectionName: 'Images',
  schema: new SimpleSchema(mySchema)
});
```

#### Pass your own schema (*not recommended*):
```javascript
var mySchema = { /* Your schema here */ };

this.Images = new FilesCollection({
  collectionName: 'Images',
  schema: new SimpleSchema(mySchema)
});
```