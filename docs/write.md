##### `write(buffer [, opts, callback, proceedAfterUpload])` [*Server*]

Write `Buffer` to FS and add record to Files collection. This function is asynchronous.

 - `buffer` {*Buffer*} - File data as `Buffer`
 - `opts` {*Object*} - Recommended properties:
   - `opts.fileName` {*String*} - File name with extension, like `name.ext`
   - `opts.type` {*String*} - Mime-type, like `image/png`
   - `opts.size` {*Number*} - File size in bytes, if not set file size will be calculated from `Buffer`
   - `opts.meta` {*Object*} - Object with custom meta-data
   - `opts.userId` {*String*} - UserId, default *null*
 - `callback` {*Function*} - Triggered after file is written to FS. With `error`, and `fileRef`, where `fileRef` is a new record from DB
 - proceedAfterUpload {*Boolean*} - Proceed `onAfterUpload` hook (*if defined*) after `Buffer` is written to FS
 - Returns {*Files*} - Current FilesCollection instance

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

fs.readFile('/data/imgs/sample.png', function (error, data) {
  if (error) {
    throw error;
  } else {
    Images.write(data, {
      fileName: 'sample.png',
      type: 'image/png'
    }, function (error, fileRef) {
      if (error) {
        throw error;
      } else {
        console.log(fileRef.name + ' is successfully saved to FS. _id: ' + fileRef._id);
      }
    });
  }
});
```