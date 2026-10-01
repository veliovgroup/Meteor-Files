# Security guide

Read this page before you ship a `FilesCollection` to production. Defaults favor getting started quickly, not locked-down access.

## Protect downloads

`protected: true` is deprecated since v4 and will be removed in v5. It only checks that the visitor is logged in. Any signed-in user can download any file if they know or guess its URL (an IDOR risk). Pass a function to compare the file owner with the current user:

```js
import { FilesCollection } from 'meteor/ostrio:files';

const files = new FilesCollection({
  collectionName: 'files',
  protected(fileObj) {
    // `fileObj` is `null` if the file does not exist
    if (fileObj && fileObj.userId && fileObj.userId === this.userId) {
      return true;
    }
    // `false` replies with 401, a number replies with that status code
    return 403;
  },
});
```

`fileObj.userId` is set on upload to the user who uploaded the file. Use the `meta` field for sharing rules, e.g. `fileObj.meta.sharedWith.includes(this.userId)`.

## Protect uploads

Uploads are anonymous unless `onBeforeUpload` checks the user. Check `this.userId`, and validate size and type:

```js
const files = new FilesCollection({
  collectionName: 'files',
  onBeforeUpload(fileData) {
    if (!this.userId) {
      return 'Sign in to upload files';
    }
    if (fileData.size > 10485760) {
      return 'Max size is 10MB';
    }
    if (!/^(png|jpe?g)$/i.test(fileData.extension)) {
      return 'Only PNG and JPEG files are allowed';
    }
    return true;
  },
});
```

The server enforces these rules for in-progress uploads:

- Only the user who started an upload can send chunks, the end-of-file message, or abort it. Others get `403`. Aborting an unknown or foreign upload gets `404`. Uploads started without a logged-in user are anonymous and belong to any anonymous caller, so check `this.userId` in `onBeforeUpload` when that matters
- The server keeps only `name`, `type`, `size`, and `meta` from the client `file` object and computes every other field
- `chunkSize` must be an integer from 1 byte to 16 MiB. The declared `size` and the chunk count must agree, chunks must be in range, and the total written can not exceed the declared `size`. The stored `size` is the real size of the file on disk
- HTTP request bodies are limited: 1 MiB for Start (including `meta`), 64 KiB for EOF, and the base64 size of `chunkSize` plus 4 KiB for a chunk. Larger bodies get `413`
- Start returns `409` if the target file already exists, if the file id is already in use, or if another pending upload claims the same path. The server creates the file exclusively, so it never overwrites an existing file
- File names from `namingFunction` are sanitized per path segment, and the final path must resolve inside the `storagePath` of the collection. Otherwise Start returns `400`. Only the server names files: the client `namingFunction` option and the `FSName` field are ignored since v4
- The server remembers the device and inode of the file it created. If the file is removed or replaced before the upload ends, the upload fails with `410` or `409` and the other file is not touched
- The abort call removes only the unfinished upload, never a finished file
- A repeated EOF returns the stored file record only to the authenticated user who owns the upload. Anonymous callers get `408`
- Responses to the client never contain server paths (`path`, `_storagePath`, `versions.*.path`), and HTTP errors with `5xx` status do not expose internal messages
- An open file handle of an idle upload is closed after `uploadIdleTimeout`

Client-supplied values such as `type`, `name`, and `meta` are still untrusted. Verify content in `onAfterUpload`, for example with the `file-type` package.

## Protect removal

`allowClientCode` defaults to `false` since v4, so clients can not remove files. If you set `allowClientCode: true` without `onBeforeRemove`, any client can call `removeAsync()` and delete any file. Pick one of these:

```js
// Option 1: no remove from client code at all (the default)
const files = new FilesCollection({
  collectionName: 'files',
});

// Option 2: allow removal and check the owner
const files2 = new FilesCollection({
  collectionName: 'files2',
  allowClientCode: true,
  async onBeforeRemove(cursor) {
    if (!this.userId) {
      return false;
    }
    const records = await cursor.fetchAsync();
    return records.every((file) => file.userId === this.userId);
  },
});
```

When `allowClientCode` is `true` and `onBeforeRemove` is not set, the server prints a warning at start. Set `allowClientCode: true` on the client constructor too.

Also call `denyClient()` on the server, or define your own `allow`/`deny` rules, so clients can not write to the underlying `Mongo.Collection` directly.

### Do not call `allowClient()` in production

`serve()` and `unlinkAsync()` trust the file paths stored in documents (`versions.*.path`). The server verifies that paths stay inside `storagePath` only when it creates an upload, not later. `allowClient()` lets any client update documents, including `path`, so a client could point a document at another file on the server and then download or delete it. The same applies to any `allow` rule or method that lets users write `path` or `versions` fields. Paths you pass to `addFile()`, `writeAsync()`, and `loadAsync()` are trusted too. Never build them from user input.

## Authentication cookie

HTTP routes identify the user with the `x_mtok` cookie. The client sets it to the current DDP session id, and the server maps it to a user.

- The mapping uses the in-memory DDP sessions of one server process. With several instances behind a load balancer, use sticky sessions, or set the `getUser` option to resolve the user another way (a token or your own cookie)
- The browser sets the cookie from JavaScript, so it is not `httpOnly` and scripts on your page can read it. It has `sameSite: 'Lax'` and, in production, the `secure` flag. Prevent XSS on your pages
- The client sets the cookie to the session id of `Meteor.connection`, also when a collection uses a custom `ddp` connection
- `allowQueryStringCookies` puts the token in URLs, where it can leak to logs, proxies, and `Referer` headers. Enable it only for Cordova and Meteor-Desktop, and set `allowedCordovaOrigins` with it. Do not enable it for web apps

## Content-Type and downloads

The uploader supplies the file `type`, and the server uses it as the `Content-Type` of the response. A file labeled `text/html` is rendered by the browser, which can lead to stored XSS. Reduce the risk:

- `nosniff` is on by default since v4 and adds `X-Content-Type-Options: nosniff` to responses
- Validate the type and extension in `onBeforeUpload`, and verify real content in `onAfterUpload`
- Files are served `inline` only when their type is `image/*` (except `image/svg+xml`), `video/*`, `audio/*`, `application/pdf`, or `text/plain`. Everything else gets `Content-Disposition: attachment`. `?download=true` always forces `attachment`, and [`responseHeaders`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md) can set its own `Content-Disposition`
- Serve user files from a separate domain when possible

## Other options

- `uploadIdleTimeout` (milliseconds, default `900000`) closes the file handle of an idle upload. The next chunk reopens it
- `continueUploadTTL` (seconds, default `10800`) expires unfinished uploads
- `disableUpload: true` or `disableDownload: true` turn off a direction you do not use
- `allowedOrigins` controls CORS for download routes. Keep it restricted
