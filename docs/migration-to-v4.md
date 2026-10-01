# Migration to v4

ostrio:files 4.0.0 requires Meteor 3.2 or newer, like 3.1.0. This page lists every breaking change and what to change in your app. The [upgrade checklist](#upgrade-checklist) at the end sums up the steps.

## Breaking changes

### Removed

- `FilesCursor#hasNext()` is removed. Use `await cursor.hasNextAsync()`.
- `FilesCursor#countAsync()` is removed. Use `await cursor.countDocuments()`.
- `findOne()` moved from the isomorphic core to the client class. On the server it still throws `Meteor.Error(404)`; use `findOneAsync()`.
- The default `x_mtok` lookup supports only a `Map` in `Meteor.server.sessions` (Meteor 3).

### Changed defaults

- `allowClientCode` defaults to `false` on the server and the client. Set `allowClientCode: true` on both sides, together with a server `onBeforeRemove`, if clients remove files.
- `nosniff` defaults to `true`: responses carry `X-Content-Type-Options: nosniff`. Set `nosniff: false` to restore the 3.x behavior.
- `Content-Disposition` is `inline` only for `image/*` (except `image/svg+xml`), `video/*`, `audio/*`, `application/pdf`, and `text/plain`. Other files download as `attachment`. Return `Content-Disposition` from `responseHeaders` to change it.

### Changed behavior

- `FileUpload#pipe()` functions run in the order they were added (first `pipe()` call runs first). v3 ran the last added pipe first. Reverse your `pipe()` calls if you chain more than one.
- Client `remove()` and `removeAsync()` accept only a String `_id`, and the `_FilesCollectionRemove_<name>` method rejects anything else. `FilesCursor#remove()` and `#removeAsync()` on the client remove the matching files one `_id` at a time. The removal is not atomic.
- Only the server names files. Remove `namingFunction` from client code (it is ignored with a warning). The server ignores `FSName` sent by v3 clients.
- `namingFunction` receives one object `{ file, fileId, userId }` in upload Start, `writeAsync()`, and `loadAsync()`. v3 passed the upload options in Start and the call options in `writeAsync()`/`loadAsync()`.
- The server keeps only `name`, `type`, `size`, and `meta` from the client `file` object. Other top-level keys are dropped. Move custom upload data into `meta`.
- The stored `type`, `mime`, `mime-type`, `versions.original.type`, and `is*` flags come from the file content (first 4100 bytes), not from the uploader. Text is stored as `text/plain`, except when the uploader sent one of `text/plain`, `text/csv`, `text/markdown`, `text/tab-separated-values`, `text/calendar`, `text/vtt`, or `application/json`. SVG, HTML, XML, CSS, and JavaScript are therefore stored as `text/plain`. Unknown binary formats are stored as `application/octet-stream`. Office files and other zip, OLE, and mp4 based formats keep the uploader's type when it names a known format of the detected container. Set `trustClientMimeType: true` to keep the 3.x behavior. `writeAsync()`, `loadAsync()`, and `addFile()` detect the type when `opts.type` is not set.
- `serve()` is `async` and returns a Promise. Without a `readableStream` it reads the file through the storage adapter (`FSStorage` by default, same files as before). Await it if your code runs after it, for example in an `interceptDownload` recipe.
- `unlinkAsync()` and `removeAsync()` remove files through the storage adapter. `unlink()` (deprecated) still unlinks local paths only.
- Uploads that were in progress during the upgrade from 3.x get `410` on their next chunk and must start again. 4.0 records written chunks in the upload record and does not guess from the file size.
- An upload has at most 100000 chunks. The client raises `chunkSize` for larger files. A Start with more chunks gets `400`.

## Deprecations

- `protected: true` logs a warning at startup and will be removed in v5. Pass a function, for example `protected(fileObj) { return !!fileObj && fileObj.userId === this.userId; }`.

## New options

- `trustClientMimeType` (server, default `false`): keep the type sent by the uploader instead of detecting it from content.
- `downloadTokenSecret` (server) and `createDownloadToken()`: sign download links that work without the `x_mtok` cookie. Pass the token to `link(fileRef, version, uriBase, { token })`. See the [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md#signed-download-links).
- `storage` (server): the adapter that stores, serves, and removes finished files. `FSStorage` is the default, `GridFSStorage` keeps files in MongoDB GridFS. See the [`storage` option](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md).

## Upgrade checklist

1. Move `namingFunction` to the server constructor and change it to `({ file, fileId, userId })`.
2. Set `allowClientCode: true` and `onBeforeRemove` only if clients remove files, and pass an `_id` to `remove()`.
3. Check code that reads `type` or `isImage` after upload: the server now detects them from content.
4. Check links to files that are not images, video, audio, PDF, or plain text: they download as attachments.
5. Reverse chained `pipe()` calls.
6. Replace `protected: true` with a function.
7. Ask users to restart uploads that were running during the deploy.
