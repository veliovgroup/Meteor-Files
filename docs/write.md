### `write(buffer [, opts, callback, proceedAfterUpload])` [*Server*]

Write `Buffer` to FS and add record to Files collection. This function is asynchronous.

- `buffer` {*Buffer*} - File data as `Buffer`
- `opts` {*Object*} - Recommended properties:
  - `opts.fileName` {*String*} - File name with extension, like `name.ext`
  - `opts.type` {*String*} - Mime-type, like `image/png`
  - `opts.size` {*Number*} - File size in bytes, if not set file size will be calculated from `Buffer`
  - `opts.meta` {*Object*} - Object with custom meta-data
  - `opts.userId` {*String*} - UserId, default *null*
  - `opts.fileId` {*String*} - id, optional - if not set - Random.id() will be used
- `callback` {*Function*} - Triggered after file is written to FS. With `error`, and `fileRef`, where `fileRef` is a new record from DB
- `proceedAfterUpload` {*Boolean*} - Proceed `onAfterUpload` hook (*if defined*) after `Buffer` is written to FS
- Returns {*Files*} - Current FilesCollection instance

```js
import fs from 'fs';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

fs.readFile('/data/imgs/sample.png', (error, data) => {
  if (error) {
    throw error;
  } else {
    imagesCollection.write(data, {
      fileName: 'sample.png',
      fileId: 'abc123myId', //optional
      type: 'image/png'
    }, (writeError, fileRef) => {
      if (writeError) {
        throw writeError;
      } else {
        console.log(`${fileRef.name} is successfully saved to FS. _id: ${fileRef._id}`);
      }
    });
  }
});
```
