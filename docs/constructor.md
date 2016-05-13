##### `new FilesCollection([config])` [*Isomorphic*]
*Initialize FilesCollection collection.*

`config` is __optional__ object with next properties:
 - `storagePath` {*String*} - [*SERVER*] Storage path on file system
    * Default value: `assets/app/uploads`. Relative to running script
 - `collectionName` {*String*} - Collection name
    * Default value: `MeteorUploadFiles`
 - `cacheControl` {*String*} - [*SERVER*] Set `Cache-Control` header, default: `public, max-age=31536000, s-maxage=31536000`
 - `throttle` {*Number*|*false*} - [*SERVER*] Throttle download speed in *bps*, by default is `false`
 - `downloadRoute` {*String*} - Server Route used to retrieve files
    * Default value: `/cdn/storage`
 - `schema` {*Object*} - Collection Schema. Use to change schema rules, for example make `extension`, required. [Default value](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema)
 - `chunkSize` {*Number*} - Upload chunk size
    * Default value: `272144`
 - `namingFunction` {*Function*} - Function which returns `String`
    * Default value: `String.rand`
 - `permissions` {*Number*} - FS-permissions (access rights) in octal, like `0755` or `0777`
    * Default value: `0755`
 - `integrityCheck` {*Boolean*} - [*SERVER*] CRC file check
    * Default value: `true`
 - `strict` {*Boolean*} - [*SERVER*] Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified
    * Default value: `false`
 - `downloadCallback` {*Function*} - [*SERVER*] Called right before initiate file download, with next context and only one argument `fileObj`:
    * `fileObj` - see [schema](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema)
    * __context__:
      - `this.request`
      - `this.response`
      - `this.user()`
      - `this.userId`
    * __Notes__:
      * Function should return {*Boolean*} value, return `false` to abort download, and `true` to continue
 - `protected` {*Boolean*|*Function*} - If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way
    * Default value: `false`
    * If function - `function(fileObj)` 
      * __context__ has:
        - `this.request` - On __server only__
        - `this.response` - On __server only__
        - `this.user()`
        - `this.userId`
      * __arguments__:
        - `fileObj` {*Object*|*null*} - If requested file exists `fileObj` is [file object](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema), otherwise `fileObj` is null
      * __return__ `true` to continue
      * __return__ `false` to abort or {*Number*} to abort upload with specific response code, default response code is `401`
 - `public` {*Boolean*} - If `true` - files will be stored in folder publicity available for proxy servers, like nginx
    * Default value: `false`
    * Route: `http://example.com/uploads/:collectionName/:fileName`
    * __Note:__ Collection can not be `public` and `protected` at the same time!
    * __Note:__ `downloadRoute` must be explicitly provided. And pointed to root of web/proxy-server, like `/uploads/`
    * __Note:__ `storagePath` must point to absolute root path of web/proxy-server, like '/var/www/myapp/public/uploads/'
    * __Note:__ `integrityCheck` is __not__ guaranteed!
    * __Note:__ `play` and force `download` features is __not__ guaranteed!
 - `onBeforeUpload` {*Function*} - Callback, triggered right before upload is started on __client__ and right after receiving a chunk on __server__, arguments:
    * `fileData` {*Object*}
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `onBeforeRemove` {*Function*} - [*SERVER*] Callback, triggered right before remove file, arguments:
    * `cursor` {*MongoCursor*} - Current files to be removed on cursor, *if has any*
    * To get user use `this.userId` or `this.user()` in function's context
    * __return__ `true` to continue
    * __return__ `false` to abort
 - `onAfterUpload` {*Function*} - [*SERVER*] Callback, triggered after file is written to FS, with single argument (*alternatively:* `addListener('afterUpload', func)`):
    - `fileRef` {*Object*} - Record from MongoDB
 - `onbeforeunloadMessage` {*String*|*Function*} - [*Client*] Message shown to user when closing browser's window or tab, while upload in the progress
    * Default value: `'Upload in a progress... Do you want to abort?'`
 - `allowClientCode` {*Boolean*} - Allow to run `remove()` from client, default: `true`
 - `debug` {*Boolean*} - Turn on/of debugging and extra logging
    * Default value: `false`
 - `interceptDownload` {*Function*} - [*SERVER*] Intercept download request, so you can serve file from third-party resource, arguments:
    - `http` {*Object*} - Middleware request instance
    - `http.request` {*Object*} - example: `http.request.headers`
    - `http.response` {*Object*} - example: `http.response.end()`
    - `fileRef` {*Object*} - Current file record from MongoDB
    - Return `false` from this function to continue standard behavior
    - Return `true` to intercept incoming request
 - This object has support for next events:
    - `afterUpload` [*Isomorphic*] - Triggered right after file is written to FS, with single argument:
      * `fileRef` {*Object*} - Record from MongoDB

```javascript
var Images;
Images = new FilesCollection({
  storagePath: 'assets/app/uploads/Images',
  downloadRoute: '/files/images'
  collectionName: 'Images',
  chunkSize: 1024*2048,
  throttle: 1024*512,
  permissions: 0o777,
  allowClientCode: false,
  cacheControl: 'public, max-age=31536000',
  onbeforeunloadMessage: function () {
    return 'Upload is still in progress! Upload will be aborted if you leave this page!';
  },
  onBeforeUpload: function (file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.ext)) {
      return true;
    } else {
      return 'Please upload image, with size equal or less than 10MB';
    }
  },
  downloadCallback: function (fileObj) {
    if (this.params?.query.download == 'true') {
      // Increment downloads counter
      Images.update(fileObj._id, {$inc: {'meta.downloads': 1}});
    }
    // Must return true to continue download
    return true;
  },
  protected: function (fileObj) {
    // Check if user is own this file
    if (fileObj.meta.owner === this.userId) {
      return true;
    } else {
      return false;
    }
  }
});
```

### Add extra security:

#### Attach schema [*Isomorphic*]:
*Default schema is stored under* `FilesCollection.schema` *object.*

*To attach schema, use/install [aldeed:collection2](https://github.com/aldeed/meteor-collection2) and [simple-schema](https://atmospherejs.com/aldeed/simple-schema) packages.*

*You're free to modify/overwrite* `FilesCollection.schema` *object.*
```javascript
var Images = new new FilesCollection({/* ... */});
Images.collection.attachSchema(Images.schema);
```

#### Deny collection interaction on client [*Server*]:
*Deny insert/update/remove from client*
```javascript
if (Meteor.isServer) {
  var Images = new new FilesCollection({/* ... */});
  Images.deny({
    insert: function() {
      return true;
    },
    update: function() {
      return true;
    },
    remove: function() {
      return true;
    }
  });

  /* Equal shortcut: */
  Images.denyClient();
}
```

#### Allow collection interaction on client [*Server*]:
*Allow insert/update/remove from client*
```javascript
if (Meteor.isServer) {
  var Images = new new FilesCollection({/* ... */});
  Images.allow({
    insert: function() {
      return true;
    },
    update: function() {
      return true;
    },
    remove: function() {
      return true;
    }
  });

  /* Equal shortcut: */
  Images.allowClient();
}
```

#### Events listeners:
```javascript
var Images = new new FilesCollection({/* ... */});
// Alias addListener
Images.on('afterUpload', function (fileRef) {
  /* ... */
});
```

#### Use onBeforeUpload to avoid unauthorized upload:
```javascript
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeUpload: function () {
    if (this.userId) {
      var user = this.user();
      if (user.profile.role === 'admin') {
        // Allow upload only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return "Not enough rights to upload a file!";
  }
});
```

#### Use onBeforeRemove to avoid unauthorized remove:
*For more info see [remove method](https://github.com/VeliovGroup/Meteor-Files/wiki/remove).*
```javascript
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeRemove: function () {
    if (this.userId) {
      var user = this.user();
      if (user.profile.role === 'admin') {
        // Allow upload only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return false;
  }
});
```