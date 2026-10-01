### `writeAsync` [*Server*]

Write `Buffer` to FS and add record to Files collection. This function is asynchronous.

```ts
FilesCollection#writeAsync(buffer: Buffer, opts?: WriteOpts, proceedAfterUpload?: boolean): Promise<FileObj>;
```

- `buffer` {*Buffer*} - File data as `Buffer`
- `opts` {*object*} - Recommended properties:
  - `opts.fileName` {*string*} - File name with extension, like `name.ext`. Alias: `opts.name`
  - `opts.type` {*string*} - Mime-type, like `image/png`
  - `opts.size` {*number*} - File size in bytes, if not set file size will be calculated from `Buffer`
  - `opts.meta` {*object*} - Object with custom meta-data
  - `opts.userId` {*string*} - UserId, default *null*
  - `opts.fileId` {*string*} - id, optional. Sanitized and cut to 20 characters. If not set, a random `_id` is generated
- `proceedAfterUpload` {*boolean*} - Proceed `onAfterUpload` hook (*if defined*) after `Buffer` is written to FS
- Returns {*Promise<FileObj>*} - newly created file's object from DB
- Rejects with `Meteor.Error 409` if a file with `opts.fileId` already exists. The existing file is not overwritten

```js
import { readFile } from 'node:fs/promises';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({collectionName: 'images'});

try {
  const data = await readFile('/data/imgs/sample.png');
  const fileRef = await imagesCollection.writeAsync(data, {
    fileName: 'sample.png',
    fileId: 'abc123myId',
    type: 'image/png'
  });
  console.log(`${fileRef.name} is successfully saved to FS. _id: ${fileRef._id}`);
} catch (error) {
  console.error('Failed to save image:', error);
}
```
