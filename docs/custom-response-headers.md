#### `FilesCollection` `config.responseHeaders` option (*passed into [Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor)*)
Allows to change default response headers.

##### Default function:
We recommend to keep original function structure, with your modifications
```javascript
function responseHeaders (responseCode, fileRef, versionRef) {
  var headers = {};
  switch (responseCode) {
    case '206':
      headers['Pragma'] = 'private';
      headers['Trailer'] = 'expires';
      headers['Transfer-Encoding'] = 'chunked';
      break;
    case '400':
      headers['Cache-Control'] = 'no-cache';
      break;
    case '416':
      headers['Content-Range'] = "bytes */" + versionRef.size;
  }
  headers['Connection'] = 'keep-alive';
  headers['Content-Type'] = versionRef.type || 'application/octet-stream';
  headers['Accept-Ranges'] = 'bytes';
  return headers;
};
```

##### Adding custom header example:
We recommend to pass `responseHeaders` as a <em>Function</em>, response headers __should be conditional__
```javascript
// As function (keep original function with additions):
var Uploads = new FilesCollection({
  responseHeaders: function(responseCode, fileRef, versionRef, version) {
    var headers = {};
    switch (responseCode) {
      case '206':
        headers['Pragma'] = 'private';
        headers['Trailer'] = 'expires';
        headers['Transfer-Encoding'] = 'chunked';
        break;
      case '400':
        headers['Cache-Control'] = 'no-cache';
        break;
      case '416':
        headers['Content-Range'] = "bytes */" + versionRef.size;
    }
    headers['Connection'] = 'keep-alive';
    headers['Content-Type'] = versionRef.type || 'application/octet-stream';
    headers['Accept-Ranges'] = 'bytes';
    headers['Access-Control-Allow-Origin'] = '*';// <-- Custom header
    return headers;
  }
});

// As object (not recommended):
var Uploads = new FilesCollection({
  responseHeaders: {
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  }
});
```