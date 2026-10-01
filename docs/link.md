# Link; or get downloadable URL

Use [`fileURL`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/template-helper.md) helper with Blaze to get *downloadable* URL to a file.

There are two options to get *downloadable* URL to the uploaded file using `.link()` method:

- Using `.link()` method of [*FilesCollection* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md). __No need to have a subscription__
- Using `.link()` method of [*FileCursor* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md). Use it when you have a subscription or local static collection

## FilesCollection#link

Use `.link()` method of *FilesCollection* instance to create *downloadable* link from *file's* plain object. To get an *Object* use `await FilesCollection#collection.findOneAsync({})`, for example inside [`end` event](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md) on the *Client* and [`onAfterUpload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) on the *Server*

```js
FilesCollection#link(fileRef, version, URIBase, opts); // [*Isomorphic*]
```

- `fileRef` {*Object*} - Object returned from MongoDB collection or [after upload](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/client/upload/upload-form.js#L194-L205)
- `version` {*String*|*void 0*} - [OPTIONAL] File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
- `URIBase` {*String*} - [OPTIONAL] base URI (domain), default: `ROOT_URL` or `MOBILE_ROOT_URL` on *Cordova*.
- `opts` {*Object*} - [OPTIONAL]
  - `opts.token` {*String*} - Token from the server `createDownloadToken()`, appended as `?token=`. See [Signed download links](#signed-download-links)
- Returns {*String*} - Absolute URL to file. Returns an empty string for `null`/`undefined`, for a file object without `_id` (for example the file of a rejected upload), and when no safe route is available

## How the URL is built

- The route and collection name stored in the document (`_downloadRoute`, `_collectionName`) are used when they are safe: the route is a local path (starts with a single `/`, without `..`, `//`, `@`, `:`, `\`, `?`, `#`, encoded `.`, `/`, or `\` (`%2e`, `%2f`, `%5c`), whitespace, or control characters) and the name has only letters, digits, `_`, `.`, and `-`
- Otherwise the `downloadRoute` and `collectionName` of the collection instance are used. The method returns an empty string if neither is available (for a public file the collection name is not needed)
- `_id`, version name, extension, and collection name are URI-encoded

## FileCursor#link

Use `.link()` method of [*FileCursor* instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) to create *downloadable* link from a cursor returned for example from [`FilesCollection#findOneAsync({})`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOneAsync.md)

```js
FileCursor#link(version, URIBase, opts); // [*Isomorphic*]
```

- `version` {*String*|*void 0*} - [OPTIONAL] File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
- `URIBase` {*String*} - [OPTIONAL] base URI (domain), default: `ROOT_URL` or `MOBILE_ROOT_URL` on *Cordova*.
- `opts` {*Object*} - [OPTIONAL] same as `FilesCollection#link`, `{ token }`
- Returns {*String*} - Full URL to file

## Required fields:

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({collectionName: 'images'});

await imagesCollection.findOneAsync({}, {
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
const fileRefs = await imagesCollection.collection.find({}).fetchAsync();
fileRefs.forEach((fileRef) => {
  imagesCollection.link(fileRef);
});

const file = await imagesCollection.findOneAsync({});
file.link();
// Get thumbnail subversion
file.link('thumbnail');
// Equals to above
const fileRef = await imagesCollection.collection.findOneAsync({});
imagesCollection.link(fileRef);

// Change domain:
imagesCollection.link(fileRef, 'original', 'https://other-domain.com/');
// Relative path to domain:
imagesCollection.link(fileRef, 'original', '/');
```

## Signed download links

With `downloadTokenSecret` set on the server, `createDownloadToken()` returns a token that opens one `_id` and one version in this collection until it expires. Pass it as `{ token }` to get a link that works without the `x_mtok` cookie and on any server instance with the same secret. The token's `userId` becomes `this.userId` in `protected` and `http.userId` in `downloadCallback`. An invalid or expired token gets `403`. A token download gets `Cache-Control: private, max-age=<seconds until the token expires>` unless `responseHeaders` sets `Cache-Control`. See the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md#signed-download-links).

```js
// Shared code. `Meteor.settings.private` is undefined on the client
const files = new FilesCollection({
  collectionName: 'files',
  downloadTokenSecret: Meteor.isServer ? Meteor.settings.private.filesTokenSecret : undefined,
  protected(fileObj) {
    return !!fileObj && fileObj.userId === this.userId;
  },
});

// Server only: `createDownloadToken()` does not exist on the client
Meteor.methods({
  async 'files.downloadLink'(fileId) {
    check(fileId, String);
    const file = await files.findOneAsync({ _id: fileId, userId: this.userId });
    if (!file) {
      throw new Meteor.Error(404, 'Not found');
    }
    const token = files.createDownloadToken(file, { userId: this.userId, expiresIn: 600 });
    return files.link(file, 'original', undefined, { token });
  },
});
```
