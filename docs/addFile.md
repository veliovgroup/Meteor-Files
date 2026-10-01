### `addFile(path [, opts, proceedAfterUpload])` [*Server*]

Add local file to FilesCollection from FS.

*Note: You can not use this method on* `public` *collections. As they supposed to be served without NodeJS (Meteor) participation. But you always can move file to root of your web-server and then add a record to FilesCollection.*

- `path` {*String*} - Full path to file, like `/var/www/files/sample.png`
- `opts` {*Object*} - Recommended properties:
  - `opts.fileName` {*String*} - File name with extension, like `name.ext`. If not set, the name is taken from `path`
  - `opts.meta` {*Object*} - Object with custom meta-data
  - `opts.type` {*String*} - Mime-type, like `image/png`
  - `opts.size` {*Number*} - File size in bytes, if not set - size will be calculated from file
  - `opts.userId` {*String*} - UserId, default *null*
  - `opts.fileId` {*String*} - _id of inserted file, sanitized and cut to 20 characters. If not set, a random `_id` is generated
- `proceedAfterUpload` {*Boolean*} - Proceed `onAfterUpload` hook (*if defined*) after local file is added to `FilesCollection`
- Returns {*Promise<FileObj>*} - New record from DB. Throws `Meteor.Error` `400` if the file does not exist and `403` on `public` collections

```js
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

const fileObj = await imagesCollection.addFile('/var/www/files/sample.png', {
  fileName: 'sample.png',
  type: 'image/png',
  fileId: 'abc123AwesomeId',
  meta: {}
});
```
