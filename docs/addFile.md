##### `addFile(path [, opts, callback, proceedAfterUpload])` [*Server*]

*Add local file to FilesCollection from FS.*

*Note: You can not use this method on* `public` *collections. As they supposed to be served without NodeJS (Meteor) participation. But you always can move file to root of your web-server and then add a record to FilesCollection.*

  - `path` {*String*} - Full path to file, like `/var/www/files/sample.png`
  - `opts` {*Object*} - Recommended properties:
    - `opts.fileName` {*String*} - File name with extension, like `name.ext`
    - `opts.meta` {*Object*} - Object with custom meta-data
    - `opts.type` {*String*} - Mime-type, like `image/png`
    - `opts.size` {*Number*} - File size in bytes, if not set - size will be calculated from file
    - `opts.userId` {*String*} - UserId, default *null*
    - `opts.fileId` {*String*} - _id of inserted file, if not set - Random.id() will be used
  - `callback` {*Function*} - Triggered after new record is added to Collection. With `error`, and `fileRef`, where `fileRef` is a new record from DB
  - proceedAfterUpload {*Boolean*} - Proceed `onAfterUpload` hook (*if defined*) after local file is added to `FilesCollection`
  - Returns {*FilesCollection*} - Current FilesCollection instance

```js
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({collectionName: 'Images'});

Images.addFile('/var/www/files/sample.png', {
  fileName: 'sample.png',
  type: 'image/png',
  fileId: 'abc123AwesomeId',
  meta: {}
});
```
