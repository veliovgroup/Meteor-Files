##### `load(url [, opts, callback, proceedAfterUpload])` [*Server*]
*Write file to FS from remote URL (external resource) and add record to FilesCollection*

 - `url` {*String*} - Full address to file, like `scheme://example.com/sample.png`
 - `opts` {*Object*} - Recommended properties:
   - `opts.fileName` {*String*} - File name with extension, like `name.ext`
   - `opts.meta` {*Object*} - Object with custom meta-data
   - `opts.type` {*String*} - Mime-type, like `image/png`, if not set - mime-type will be taken from response headers
   - `opts.size` {*Number*} - File size in bytes, if not set - file size will be taken from response headers
 - `callback` {*Function*} - Triggered after first byte is received. With `error`, and `fileRef`, where `fileRef` is a new record from DB
 - proceedAfterUpload {*Boolean*} - Proceed `onAfterUpload` hook (*if defined*) after external source is loaded to FS
 - Returns {*FilesCollection*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

Images.load('https://raw.githubusercontent.com/VeliovGroup/Meteor-Files/master/logo.png', {
  fileName: 'logo.png',
  meta: {}
});
```