# Link; or get downloadable URL

Use [`fileUrl`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/template-helper.md) helper with Blaze to get *downloadable* URL to a file.

There are two options to get *downloadable* URL to the uploaded file using `.link()` method:

- Using `.link()` method of [*FilesCollection* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) — __No need to have a subscription__
- Using `.link()` method of [*FileCursor* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) — Use it when you have a subscription or local static collection

## FilesCollection#link

Use `.link()` method of [*FileCursor* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) to create *downloadable* link from *file's* plain object. To get an *Object* use `FilesCollection#collection.findOne({})` of for example inside [`end` event](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md) on the *Client* and [`onAfterUpload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) on the *Server*

```js
FilesCollection#link(fileRef, version, URIBase); // [*Isomorphic*]
```

- `fileRef` {*Object*} - Object returned from MongoDB collection or [after upload](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/client/upload/upload-form.js#L194-L205)
- `version` {*String*|*void 0*} - [OPTIONAL] File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
- `URIBase` {*String*} - [OPTIONAL] base URI (domain), default: `ROOT_URL` or `MOBILE_ROOT_URL` on *Cordova*.
- Returns {*String*} - Absolute URL to file

## FileCursor#link

Use `.link()` method of [*FileCursor* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) to create *downloadable* link from a cursor returned for example from [`FilesCollection#findOne({})`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOne.md)

```js
FileCursor#link(version, URIBase); // [*Isomorphic*]
```

- `version` {*String*|*void 0*} - [OPTIONAL] File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
- `URIBase` {*String*} - [OPTIONAL] base URI (domain), default: `ROOT_URL` or `MOBILE_ROOT_URL` on *Cordova*.
- Returns {*String*} - Full URL to file

## Required fields:

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({collectionName: 'images'});

imagesCollection.findOne({}, {
  fields: {
    _id: 1,
    public: 1,
    versions: 1, // <-- only when versioning is used
    extension: 1,
    _downloadRoute: 1,
    _collectionName: 1
  }
});
```

## Examples

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({collectionName: 'images'});

// Usage:
imagesCollection.collection.find({}).forEach(function (fileRef) {
  imagesCollection.link(fileRef);
});

imagesCollection.findOne({}).link();
// Get thumbnail subversion
imagesCollection.findOne({}).link('thumbnail');
// Equals to above
const fileRef = imagesCollection.collection.findOne({});
imagesCollection.link(fileRef);

// Change domain:
imagesCollection.link(fileRef, 'original', 'https://other-domain.com/');
// Relative path to domain:
imagesCollection.link(fileRef, 'original', '/');
```
