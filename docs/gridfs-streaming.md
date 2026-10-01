# GridFS streaming (`206` partial content)

By default, files served from GridFS return a `200` response code. This is not the best solution in terms of performance and resource usage.

A `206` partial content response is better. For video and audio it allows time-seeking, for large files it allows resumable downloads. On the server side it reduces memory and CPU consumption.

The code below uses [`interceptDownload`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) to replace the default file-serving behavior. It is based on the code suggested by [@j1016h](https://github.com/j1016h). It assumes the setup from [GridFS with `GridFSBucket`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-bucket-integration.md): a `bucket` made by `createBucket()`, and `gridFsFileId` stored in `versions.<name>.meta`. Use it at your own risk, or take it and modify it to meet your needs.

Byte ranges differ between HTTP and the bucket API:

- HTTP `Range: bytes=START-END` is inclusive on both ends
- `bucket.openDownloadStream(id, { start, end })` includes `start` and excludes `end`. To read the HTTP range `START-END`, pass `{ start: START, end: END + 1 }`

```js
import { createObjectId } from '../createObjectId';

/**
 * Resolve a `Range` header into an explicit, inclusive byte range.
 * Returns `null` when the full content must be sent (no header, a malformed header,
 * or a multi-range request), `false` when the range is not satisfiable, and `{ start, end }` otherwise.
 */
const resolveRange = (header, size) => {
  if (!header || header.includes(',')) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) {
    // Malformed header: ignored, same as `.serve()` does
    return null;
  }

  let start;
  let end;
  if (!match[1]) {
    // Suffix range: the last N bytes
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) {
      return false;
    }
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
  }

  return (start >= size || end < start) ? false : { start, end };
};

export const createInterceptDownload = (bucket) => {
  return async function interceptDownload(http, fileRef, versionName) {
    const vRef = fileRef.versions[versionName];
    const gridFsFileId = (vRef.meta || {}).gridFsFileId;
    if (!gridFsFileId) {
      // Not moved to GridFS yet, serve from FS
      return false;
    }

    const range = resolveRange(http.request.headers.range, vRef.size);
    // With `strict: false` an unsatisfiable range gets the full content with `200`, as in `.serve()`
    if (range === false && this.strict !== false) {
      http.response.writeHead(416, { 'Content-Range': `bytes */${vRef.size}` });
      http.response.end();
      return true;
    }

    const id = createObjectId({ gridFsFileId });
    let stream;
    if (range) {
      // Bucket `end` is exclusive, HTTP range `end` is inclusive
      stream = bucket.openDownloadStream(id, { start: range.start, end: range.end + 1 });
      // Let `.serve()` build the same `206` response headers
      http.request.headers.range = `bytes=${range.start}-${range.end}`;
    } else {
      stream = bucket.openDownloadStream(id);
      delete http.request.headers.range;
    }

    stream.on('error', (error) => {
      console.error('[interceptDownload] GridFS stream error', error);
      if (!http.response.headersSent) {
        http.response.statusCode = 404;
      }
      http.response.end();
    });

    // `.serve()` sets Content-Disposition, Content-Type, Cache-Control,
    // `Content-Range`, and the `200` or `206` status
    await this.serve(http, fileRef, vRef, versionName, stream);
    return true;
  };
};
```
