# Custom Response Headers

- `config.responseHeaders` option (*passed into [`FilesCollection` Constructor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md)*)

*Allows to change default response headers.*

`responseHeaders` is an *Object* or a *Function*. A function receives these arguments and returns an *Object* of headers:

- `responseCode` {*String*} - `'200'`, `'206'`, `'400'`, `'416'`
- `fileRef` {*Object*} - File record from MongoDB
- `versionRef` {*Object*} - Requested version of the file, e.g. `fileRef.versions.original`
- `version` {*String*} - Requested version name
- `http` {*Object*} - `{ request, response, params }`

## Default function:

We recommend to keep original function structure, with your modifications

```js
function responseHeaders (responseCode, fileRef, versionRef, version, http) {
  const headers = {};
  switch (responseCode) {
    case '206':
      headers['Pragma'] = 'private';
      break;
    case '400':
      headers['Cache-Control'] = 'no-cache';
      break;
    case '416':
      headers['Content-Range'] = `bytes */${versionRef.size}`;
      break;
    default:
      break;
  }
  headers['Connection'] = 'keep-alive';
  let type = versionRef.type || 'application/octet-stream';
  // Text types without a charset get `; charset=utf-8`
  if (/^(?:text\/[^;\s]+|application\/json|application\/javascript|image\/svg\+xml)\s*(?:;|$)/i.test(type) && !/;\s*charset=/i.test(type)) {
    type = `${type.replace(/[;\s]+$/, '')}; charset=utf-8`;
  }
  headers['Content-Type'] = type;
  headers['Accept-Ranges'] = 'bytes';
  return headers;
}
```

`serve()` sets `Content-Length` (and `Content-Range` on `206`) itself, and removes `Transfer-Encoding` from `200` and `206` responses, because a response with `Content-Length` must not be chunked.

## Adding custom header example:

We recommend to pass `responseHeaders` as a <em>Function</em>, response headers __should be conditional__.

```js
// As function (keep original function with additions):
const UploadsFn = new FilesCollection({
  responseHeaders(responseCode, fileRef, versionRef, version, http) {
    const headers = {};
    switch (responseCode) {
      case '206':
        headers['Pragma'] = 'private';
        break;
      case '400':
        headers['Cache-Control'] = 'no-cache';
        break;
      case '416':
        headers['Content-Range'] = `bytes */${versionRef.size}`;
        break;
      default:
        break;
    }
    headers['Connection'] = 'keep-alive';
    // Add `; charset=utf-8` to text types here, as the default function does
    headers['Content-Type'] = versionRef.type || 'application/octet-stream';
    headers['Accept-Ranges'] = 'bytes';
    headers['Access-Control-Allow-Origin'] = '*';// <-- Custom header
    return headers;
  }
});

// As object (not recommended):
const UploadsObj = new FilesCollection({
  responseHeaders: {
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  }
});
```

## Range requests

The server answers `Range` requests with `206 Partial Content` and `Content-Range`.

- `bytes=START-END` and `bytes=START-` return the requested bytes
- Suffix ranges, `bytes=-N`, return the last `N` bytes
- An `END` beyond the file size is reduced to the last byte
- Reversed (`END < START`) and out-of-range requests (`START` at or after the file size, `bytes=-0`) get `416 Range Not Satisfiable` with `Content-Range: bytes */SIZE`. This applies when the `strict` option is `true` (default). With `strict: false` the server ignores the `Range` header and sends the full content with `200`
- Malformed headers and multi-range requests (`bytes=0-10,20-30`) are not supported. The server ignores `Range` and sends the full content with `200`
- The server ignores `Range` when the stored version `size` is not a non-negative integer

## Security headers

Set `nosniff: true` in the constructor to add `X-Content-Type-Options: nosniff` to file responses. It will default to `true` in v4. To force browsers to download a file instead of rendering it, either request it with `?download=true` or return `Content-Disposition: attachment` from `responseHeaders`. See the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md).
