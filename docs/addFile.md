##### `addFile(path [, opts, callback])` [*Server*]

Add local file to Files collection from FS

 - `path` {*String*} - Full path to file, like `/var/www/files/sample.png`
 - `opts` {*Object*} - Recommended properties:
   - `opts.fileName` {*String*} - File name with extension, like `name.ext`
   - `opts.meta` {*Object*} - Object with custom meta-data
   - `opts.type` {*String*} - Mime-type, like `image/png`
   - `opts.size` {*Number*} - File size in bytes, if not set - size will be calculated from file
 - `callback` {*Function*} - Triggered after new record is added to Collection. With `error`, and `fileRef`, where `fileRef` is a new record from DB
 - Returns {*Files*} - Current Meteor.Files instance

```javascript
var Images = new Meteor.Files({collectionName: 'Images'});

Images.addFile('/var/www/files/sample.png', {
  fileName: 'sample.png',
  type: 'image/png',
  meta: {}
});
```