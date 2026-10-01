# Download remote file over HTTP

Download remote file over HTTP to the file system of a *Server*. Download is efficient, runs in chunks writing data as available directly to FS via stream without holding it in RAM. If error or timeout occurred, unfinished file will get removed from file system.

```js
/*
 * @locus Server
 */

await FilesCollection#loadAsync(url [, opts: LoadOpts, proceedAfterUpload: boolean]): Promise<FileObj>;
```

Write file to file system from remote URL (external resource) and add record to FilesCollection

- `url` {*string*} - Full address to file, like `https://example.com/sample.png`
- `opts?` {*LoadOpts*} - *Optional* Recommended properties:
  - `opts.fileName` {*string*} - File name with extension, like `name.ext`. Alias: `opts.name`
  - `opts.headers` {*object*} - Request HTTP headers, to use when requesting the file
  - `opts.meta` {*object*} - Object with custom meta-data
  - `opts.type` {*string*} - Mime-type, like `image/png`, if not set - mime-type will be taken from response headers
  - `opts.size` {*number*} - Ignored. The size is read from the downloaded file on disk
  - `opts.userId` {*string*} - UserId, default: `null`
  - `opts.fileId` {*string*} - id, optional. Sanitized and cut to 20 characters. If not set, a random `_id` is generated
  - `opts.timeout` {*number*} - timeout in milliseconds, default: `360000` (*6 mins*); Set to `0` to disable timeout; *Disabling timeout not recommended, sockets won't get closed until server rebooted*
- `proceedAfterUpload?` {*boolean*} - *Optional* Proceed `onAfterUpload` hook (*if defined*) after external source is loaded to FS
- Returns {*Promise<FileObj>*} - File Object from DB. The stored `size` is the size of the downloaded file on disk
- Rejects with `Meteor.Error 409` if a file with `opts.fileId` already exists, with `Meteor.Error 408` on timeout, and with `Meteor.Error` carrying the HTTP status when the response is not OK. A partial file created by the call is removed on failure

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
