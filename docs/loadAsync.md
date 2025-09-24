# Download remote file over HTTP

Download remote file over HTTP to the file system of a *Server*. Download is efficient, runs in chunks writing data as available directly to FS via stream without holding it in RAM. If error or timeout occurred — unfinished file will get removed from file system.

```js
/*
 * @locus Server
 */

await FilesCollection#loadAsync(url [, opts: LoadOpts, proceedAfterUpload: boolean]): Promise<FileObj>;
```

Write file to file system from remote URL (external resource) and add record to FilesCollection

- `url` {*string*} - Full address to file, like `https://example.com/sample.png`
- `opts?` {*LoadOpts*} - *Optional* Recommended properties:
  - `opts.fileName` {*string*} - File name with extension, like `name.ext`
  - `opts.headers` {*object*} - Request HTTP headers, to use when requesting the file
  - `opts.meta` {*object*} - Object with custom meta-data
  - `opts.type` {*string*} - Mime-type, like `image/png`, if not set - mime-type will be taken from response headers
  - `opts.size` {*number*} - File size in bytes, if not set - file size will be taken from response headers
  - `opts.userId` {*string*} - UserId, default: `null`
  - `opts.fileId` {*string*} - id, optional - if not set - Random.id() will be used
  - `opts.timeout` {*number*} - timeout in milliseconds, default: `360000` (*6 mins*); Set to `0` to disable timeout; *Disabling timeout not recommended, sockets won't get closed until server rebooted*
- `proceedAfterUpload?` {*boolean*} - *Optional* Proceed `onAfterUpload` hook (*if defined*) after external source is loaded to FS
- Returns {*Promise<FileObj>*} - File Object from DB

```js
/*
 * @locus Server
 */

import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({ collectionName: 'images' });

const fileObj = await imagesCollection.loadAsync('https://raw.githubusercontent.com/veliovgroup/Meteor-Files/master/logo.png', {
  fileName: 'logo.png',
  fileId: 'abc123myId', //optional
  timeout: 60000, // optional timeout
  meta: {}
});
```
