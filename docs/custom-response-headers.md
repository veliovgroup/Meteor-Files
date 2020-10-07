# Custom Response Headers

- `config.responseHeaders` option (*passed into [`FilesCollection` Constructor](https://github.com/VeliovGroup/Meteor-Files/blob/master/docs/constructor.md)*)

*Allows to change default response headers.*

## Default function:

We recommend to keep original function structure, with your modifications

```js
function responseHeaders (responseCode, fileRef, versionRef) {
  const headers = {};
  switch (responseCode) {
    case '206':
      headers['Pragma'] = 'private';
      headers['Transfer-Encoding'] = 'chunked';
      break;
    case '400':
      headers['Cache-Control'] = 'no-cache';
      break;
    case '416':
      headers['Content-Range'] = 'bytes */' + versionRef.size;
  }
  headers['Connection'] = 'keep-alive';
  headers['Content-Type'] = versionRef.type || 'application/octet-stream';
  headers['Accept-Ranges'] = 'bytes';
  return headers;
}
```

## Adding custom header example:

We recommend to pass `responseHeaders` as a <em>Function</em>, response headers __should be conditional__.

```js
// As function (keep original function with additions):
const Uploads = new FilesCollection({
  responseHeaders(responseCode, fileRef, versionRef, version, http) {
    const headers = {};
    switch (responseCode) {
      case '206':
        headers['Pragma'] = 'private';
        headers['Transfer-Encoding'] = 'chunked';
        break;
      case '400':
        headers['Cache-Control'] = 'no-cache';
        break;
      case '416':
        headers['Content-Range'] = 'bytes */' + versionRef.size;
    }
    headers['Connection'] = 'keep-alive';
    headers['Content-Type'] = versionRef.type || 'application/octet-stream';
    headers['Accept-Ranges'] = 'bytes';
    headers['Access-Control-Allow-Origin'] = '*';// <-- Custom header
    return headers;
  }
});

// As object (not recommended):
const Uploads = new FilesCollection({
  responseHeaders: {
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  }
});
```
