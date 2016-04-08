##### `new Meteor.Files([config])` [*Isomorphic*]
*Initialize Meteor.Files collection*.

`config` is __optional__ object with next properties:
 - `storagePath` {*String*} - Storage path on file system
    * Default value: `assets/app/uploads`. Relative to running script
 - `collectionName` {*String*} - Collection name
    * Default value: `MeteorUploadFiles`
 - `cacheControl` {*String*} - Set `Cache-Control` header, default: `public, max-age=31536000, s-maxage=31536000`
 - `throttle` {*Number* | *false*} - Throttle download speed in *bps*, by default is `false`
 - `downloadRoute` {*String*} - Server Route used to retrieve files
    * Default value: `/cdn/storage`
 - `schema` {*Object*} - Collection Schema. Use to change schema rules, for example make `extension`, required. [Default value](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema)
 - `chunkSize` {*Number*} - Upload chunk size
    * Default value: `272144`
 - `namingFunction` {*Function*} - Function which returns `String`
    * Default value: `String.rand`
 - `permissions` {*Number*} - FS-permissions (access rights) in octal, like `0755` or `0777`
    * Default value: `0755`
 - `integrityCheck` {*Boolean*} - CRC file check
    * Default value: `true`
 - `strict` {*Boolean*} - Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified
    * Default value: `false`
 - `downloadCallback` {*Function*} - Called right before initiate file download, with next context and only one argument `fileObj`:
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
    * __Note:__ `integrityCheck` is __not__ guaranteed!
    * __Note:__ `play` and force `download` features is __not__ guaranteed!
 - `onBeforeUpload` {*Function*} - Callback triggered right before upload on __client__ and right after recieving a chunk on __server__, with __no arguments__:
    * Context of the function is {*Object*}, with:
      - `extension`, alias `ext`
      - `mime-type`, alias `type`
      - `size`
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `onbeforeunloadMessage` {*String* or *Function*} - Message shown to user when closing browser's window or tab, while upload in the progress
    * Default value: `'Upload in a progress... Do you want to abort?'`
 - `allowClientCode` {*Boolean*} - Allow to run `remove()` from client, default: `true`
 - `debug` {*Boolean*} - Turn on/of debugging and extra logging
    * Default value: `false`

```javascript
var Images;
Images = new Meteor.Files({
  storagePath: 'assets/app/uploads/Images',
  downloadRoute: '/files/images'
  collectionName: 'Images',
  chunkSize: 1024*2048,
  throttle: 1024*512,
  permissions: 0o777,
  allowClientCode: false,
  cacheControl: 'public, max-age=31536000',
  onbeforeunloadMessage: function () {
    i18n.get('_app.abortUpload'); // See 'ostrio:i18n' package
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
      Images.collection.update(fileObj._id, {$inc: {'meta.downloads': 1}});
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