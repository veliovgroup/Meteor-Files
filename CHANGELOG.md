# 4.0.0

## What's new

This release adds signed download links, storage adapters with a built-in GridFS adapter, content-based file type detection, and uploads that resume after a server restart. It also tightens defaults: clients can not remove files, responses carry `nosniff`, risky types download as attachments, and only the server names files. Read "Major changes" before you upgrade, and follow the [migration guide to v4](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v4.md).

## Major changes

- ⚠️ Remove `FilesCursor#hasNext()` and `FilesCursor#countAsync()`. Use `hasNextAsync()` and `countDocuments()`.
- ⚠️ Move `findOne()` from `FilesCollectionCore` to the client class. The server class still throws `Meteor.Error(404)`. Use `findOneAsync()`.
- ⚠️ Support only a `Map` in `Meteor.server.sessions` (Meteor 3) in the default `x_mtok` lookup. A plain object throws.
- ⚠️ Default `allowClientCode` to `false`. Clients can not call `remove()` unless `allowClientCode: true` is set on the server and the client. Set `onBeforeRemove` when you enable it.
- ⚠️ Accept only a String `_id` in client `remove()` and `removeAsync()`. Use `find(selector).removeAsync()` to remove several files. It removes one `_id` per server call and is not atomic.
- ⚠️ Send `X-Content-Type-Options: nosniff` by default. Set `nosniff: false` to turn it off.
- ⚠️ Serve files `inline` only for `image/*` (not SVG), `video/*`, `audio/*`, `application/pdf`, and `text/plain`. Other files get `Content-Disposition: attachment`. Set `Content-Disposition` in `responseHeaders` to change it.
- ⚠️ Run `FileUpload#pipe()` functions in the order they were added. The first `pipe()` call runs first. Reverse chained `pipe()` calls written for 3.x.
- ⚠️ Name files on the server only. The client `namingFunction` option and the `FSName` field are ignored. Set `namingFunction` on the server. It receives `{ file, fileId, userId }` in upload Start, `writeAsync()`, and `loadAsync()`.
- ⚠️ Keep only `name`, `type`, `size`, and `meta` from the client `file` object. Send custom data in `meta`.
- ⚠️ Store `type`, `mime`, `versions.original.type`, and the `is*` flags from the file content instead of the uploader's claim. Text keeps the uploader's type only for a short list of passive types (`text/plain`, `text/csv`, `text/markdown`, `text/tab-separated-values`, `text/calendar`, `text/vtt`, `application/json`), other text is stored as `text/plain`. Set `trustClientMimeType: true` to store the uploader's type as in 3.x.
- ⚠️ Make `serve()` async. Await it when code runs after it. `unlinkAsync()` and `removeAsync()` remove files through the storage adapter (`FSStorage` by default, same files as before). Custom adapters receive `{ source }` as the 4th `put()` argument and must keep the caller's file when `source` is `'addFile'`.
- ⚠️ Restart uploads that were in progress during the upgrade from 3.x. They get `410` on their next chunk. Start rejects more than 100000 chunks with `400`, and the client raises `chunkSize` to stay below.

## Other Changes

### Added

- ✨ Add signed download links. Set `downloadTokenSecret`, call `createDownloadToken()`, and pass the token to `link(fileRef, version, uriBase, { token })`. Tokens work without the `x_mtok` cookie and on any server instance. A token opens one file version in one collection, and token downloads get `Cache-Control: private` until the token expires.
- ✨ Add storage adapters with the `storage` option. `FSStorage` is the default and `GridFSStorage` keeps files in MongoDB GridFS.
- ✨ Add content-based type detection from a built-in signature table, and the `trustClientMimeType` option.
- ✨ Resume uploads after a server restart. The server records every written chunk in the upload record.
- ✨ Add a browser test suite to CI on Meteor 3.2.2 and 3.5.2.

### Fixed

- 🔧 Record written chunks instead of guessing them from the file size after a restart. A hole before the last written chunk no longer passes as complete.
- 🔧 Make one database read per protected download.

### Changed

- 👨‍💻 Deprecate `protected: true`. It logs a warning at startup and will be removed in v5. Pass a function.

### Docs

- 📔 Add the [migration guide to v4](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v4.md) with an upgrade checklist.
- 📔 Rewrite the S3 recipe as a storage adapter and lead the GridFS guide with the built-in adapter.
- 📔 Update the security guide for the new defaults, signed links, and content-based types.
- 📔 Await `serve()` in the GridFS and Google Cloud Storage recipes.

### Tests

- 🧪 Cover the client upload state machine in a browser with the `playwright` driver of `meteortesting:mocha`.

### Dependencies

- 📦 Add `playwright` as a dev dependency for browser tests. The runtime dependency list is unchanged.

# 3.1.0

## What's new

This release closes several upload and download security holes, fixes the client upload state machine, and supports Meteor 3.2 to 3.5. Read "Major changes" before you upgrade. See the new [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md).

## Major changes

- ⚠️ Require Meteor 3.2 or newer. `ostrio:cookies` 3.0.0 needs `fetch@0.1.6`, which first ships with Meteor 3.2.
- ⚠️ Restart uploads that were in progress during the upgrade from 3.0.x. The server answers `403` or `410` for upload records created by 3.0.x.
- ⚠️ Return HTTP upload errors as `{ error: <status code>, reason, isClientSafe? }` instead of `{ error: "<text>" }`. `5xx` responses have a generic `reason`.
- ⚠️ Limit upload sizes. `chunkSize` is at most 16 MiB. HTTP Start bodies, including `meta`, are at most 1 MiB. HTTP EOF bodies are at most 64 KiB. HTTP chunk bodies are at most the Base64 size of `chunkSize` plus 4 KiB.
- ⚠️ Reject `FileUpload` pipes that grow a chunk. A pipe must return Base64 that decodes to the same number of bytes as its input, so per-chunk encryption with an IV, a tag, or padding fails on the first chunk. Move such transforms to `onAfterUpload` on the server.
- ⚠️ Emit only `error` and `end` when an upload fails. `pause`, `abort`, and `onAbort` now fire only when `abort()` is called.
- ⚠️ Throw `Meteor.Error 404` from the synchronous `FilesCursor` methods (`get`, `fetch`, `first`, `last`, `next`, `previous`, `hasNext`, `count`, `forEach`, `each`, `map`, `current`, `remove`) and from `FileCursor#with()` and `FileCursor#remove()` on the server. They returned Promises or wrong values before. Use the `*Async` methods.
- ⚠️ Reject `writeAsync()` and `loadAsync()` with `409` when `opts.fileId` already exists. Before, they overwrote the existing file.
- ⚠️ Reject an upload Start with `file.size` `0` with `400`. An empty upload has no chunk to send and never finished. The client already refused empty files.
- ⚠️ Stop retrying a chunk after 10 consecutive network failures and end the upload with an error. Before, the client retried without limit.

## Other Changes

### Fixed

- 🔧 Accept Write, EOF, and abort requests only from the user who started the upload.
- 🔧 Stop `_Abort` from removing finished files. It removes only the unfinished upload record and its partial file, and answers `404` for unknown or foreign upload ids.
- 🔧 Remove the partial file when an upload is aborted after a server restart. The server removes it only when device, inode, and birth time match the file the upload created. Without a stored birth time (file systems that do not report it), device and inode must match.
- 🔧 Prevent an upload from overwriting or deleting another file. Start returns `409` if the file id, the target path, or a pending upload path already exists, and creates the file exclusively.
- 🔧 Fail an upload with `410` or `409` when its file was removed or replaced on disk. The server compares device, inode, and birth time on every reopen.
- 🔧 Sanitize `namingFunction` output per path segment and require the final path to stay inside `storagePath`.
- 🔧 Ignore client-supplied reserved file fields: `_id`, `fileId`, `path`, `_storagePath`, `_downloadRoute`, `_collectionName`, `versions`, `userId`, `public`, extension, mime, and type flags.
- 🔧 Store the real size on disk, and reject chunks beyond the declared size.
- 🔧 Validate chunk size, chunk count, `chunkId`, and chunk length.
- 🔧 Reject oversized HTTP request bodies with `413` before buffering them.
- 🔧 Run the same `check()` on HTTP Start as on DDP Start.
- 🔧 Stop sending server paths to the client in Start and EOF responses.
- 🔧 Destroy download streams when the client disconnects. Stream errors return a generic `500`.
- 🔧 Match routes by URL pathname, so a query string or a route prefix can no longer match another route.
- 🔧 Encode `Content-Disposition` with an ASCII `filename` and an RFC 8187 `filename*`. The ASCII fallback replaces `%` with `_`.
- 🔧 URI-encode `_id`, version, extension, and collection name in `link()` and the `fileURL` helper, and never produce protocol-relative URLs.
- 🔧 Return an empty string from `link()` and the `fileURL` helper for a file without `_id`, for example the file passed to `end` after a rejected upload. It returned `/undefined/original/undefined.txt` before.
- 🔧 Set the `x_mtok` cookie as `secure` on https pages.
- 🔧 Ignore inherited keys in the session lookup and fail closed.
- 🔧 Skip `__proto__`, `constructor`, and `prototype` in `fixJSONParse` and `fixJSONStringify`.
- 🔧 Limit a numeric `protected` result to `400`-`599`.
- 🔧 Return the stored file on a repeated EOF only to the authenticated owner, so a lost EOF response no longer fails a finished upload.
- 🔧 Answer an EOF that arrives while the first EOF of the same upload is still running (for example after a DDP reconnect) with the result of the first one instead of `408`.
- 🔧 Accept an object in `responseHeaders`.
- 🔧 Serve suffix ranges (`bytes=-N`) and the last byte, clamp the range end to the file size, and return `200` for multi-range requests. Unsatisfiable ranges return `416` when `strict` is `true` and `200` when it is `false`.
- 🔧 Send `Content-Length` on `206` responses that `serve()` reads from disk, instead of `Transfer-Encoding: chunked`. A response never carries both headers.
- 🔧 Send `206` responses from a custom `readableStream` chunked, without `Content-Length`, because `serve()` can not know how many bytes the stream sends. A `Content-Length` set in `responseHeaders` is kept. A `200` still gets `Content-Length` from the stored size, as in 3.0.
- 🔧 Give up a Start or EOF request, or a chunk answered with `502`, `503`, or `504`, after 5 failed attempts, as documented. Before, it took 6.
- 🔧 Make the integrity-check `400` response reachable again.
- 🔧 Stop `loadAsync()` from throwing inside a timer. It opens the file only after a successful fetch, takes `size` from disk, and removes only partial files it created.
- 🔧 Make `writeAsync()` create the directory and always close the file handle.
- 🔧 Complete an upload when all chunk ids arrived instead of guessing from the file size. Uploads resume after a server restart.
- 🔧 Return `503` when a chunk write fails.
- 🔧 Make `WriteStream#end()` return `false` for aborted or incomplete streams, and stop `abort()` from deleting a finished file.
- 🔧 Remove the uploaded file when the database insert fails, and rethrow insert errors.
- 🔧 Run `namingFunction` and `storagePath` once per upload, at Start.
- 🔧 Run `onInitiateUpload` after the server checked that the target does not exist.
- 🔧 Find public route ids that contain `-`.
- 🔧 Set `extensionWithDot` to an empty string for files without extension.
- 🔧 Treat a `responseHeaders` function that returns nothing as `{}`.
- 🔧 Catch version unlink failures and log index creation errors.
- 🔧 Treat a file that is already gone as removed in `unlinkAsync()` and `removeAsync()`. The server logs one debug line without a stack trace.
- 🔧 Send one client request at a time: Start, chunks in order, then EOF. Network failures, `502`, `503`, and `504` retry with backoff from 500 ms up to 10 s.
- 🔧 Prevent the client from sending a chunk before Start succeeds, and fire `end` and `uploaded` only after a successful EOF.
- 🔧 Send Start when `continue()` follows a pause before Start.
- 🔧 Stop `abort()` from causing an unhandled rejection when the server answers `404`.
- 🔧 Pass the `reason` of HTTP `4xx` responses to `error`, `onError`, and `end`.
- 🔧 Call `error` and `end` once per failed upload. A throwing callback is reported with `console.error` and does not stop the others.
- 🔧 Keep a manual pause when the connection drops and comes back.
- 🔧 Omit the `x-mtok` header when there is no session instead of sending the string `"null"`.
- 🔧 Fix Base64 padding for chunk sizes not divisible by 4.
- 🔧 Stop `insert()` and `insertAsync()` from changing the config object passed by the user.
- 🔧 Keep `meta` Dates as Dates after an HTTP upload.
- 🔧 Start the worker, the `beforeunload` listener, timers, and trackers only after `onBeforeUpload` passes, and always clean them up.
- 🔧 Post worker errors to the main thread and share one Blob URL between collections.
- 🔧 Stop the client constructor from crashing on `new FilesCollection()`.
- 🔧 Update the `x_mtok` cookie after reconnect and login without overwriting the app's `onReconnect` hook.
- 🔧 Reject client `removeAsync()` with `401` when `allowClientCode` is `false`.
- 🔧 Accept `null`, `undefined`, and `FileCursor` in `link()`.
- 🔧 Accept the same selectors in `countDocuments()` as in `find()`, including ObjectID.
- 🔧 Honor `limit` and `skip` in `hasNextAsync()` and `lastAsync()`.
- 🔧 Stop `estimatedDocumentCount()` from failing in debug mode.
- 🔧 Fix typos in JSDoc and error messages.
- 🔧 Match `index.d.ts` to the runtime API. Many options and method signatures were missing or wrong.
- 🔧 Keep uploads, downloads, and writes running when a custom `debug` function throws. The error goes to the console.
- 🔧 Throw from `_dataToSchema()` when `storagePath` resolves to a Promise that was not awaited, so a Promise never lands in a stored document.

### Added

- ✨ Add the `allowedCordovaOrigins` option on Server and Client, passed to `ostrio:cookies`. Cordova and Meteor-Desktop need it for query-string cookies. The Server default is the value of `allowedOrigins`.
- ✨ Add the `uploadIdleTimeout` Server option (milliseconds, default `900000`). It closes file handles of idle uploads, and the next chunk reopens them.
- ✨ Add the `nosniff` Server option. It sets `X-Content-Type-Options: nosniff` (default `false`, planned to default to `true` in v4).
- ✨ Warn on server start when `allowClientCode` is on and `onBeforeRemove` is not set.
- ✨ Add `userAsync()` to the client `_getUser()` result.
- ✨ Allow the `debug` option to be a function. The server and client pass log arguments to it instead of the console. Thanks to @jankapunkt, #907.
- ✨ Allow the `storagePath` function to be `async`. `collection.storagePath(fileObj)` returns a Promise in this case, so `await` it. Thanks to @codeonprod, #909.

### Changed

- 👨‍💻 Use the stored `_downloadRoute` and `_collectionName` in `link()` when they are safe, otherwise the collection's own values. A stored route with `?`, `#`, or an encoded `.`, `/`, or `\` (`%2e`, `%2f`, `%5c`) is not safe.
- 👨‍💻 Answer `?play=true` requests without a `Range` header with `200` and the whole file, as RFC 9110 requires. Requests with `Range` still get `206`.
- 👨‍💻 Add `; charset=utf-8` to the default `Content-Type` of `text/*`, `application/json`, `application/javascript`, and `image/svg+xml` files without a charset, so text files display correctly inline. Text files in another encoding, such as a Latin-1 CSV, need their charset set through `responseHeaders`.
- 👨‍💻 Ask the user to check the connection when one chunk fails 10 times in a row, and name a chunk larger than `chunkSize` (for example from a pipe) as one possible cause.
- 👨‍💻 Export types from `index.d.ts` at the top level. The old `declare module` wrapper exported nothing.
- 👨‍💻 Keep `FileUpload` pipes in reverse order of registration. This changes in v4.
- 🤫 Ignore `docs/audits/` in git.

### Docs

- 📔 Add a security guide.
- 📔 Rename the migration doc to `migration-to-v3.md`.
- 📔 Rewrite the AWS S3 (`@aws-sdk/client-s3` v3), Dropbox, Google Cloud Storage, GridFS, and `sharp` thumbnail guides with async APIs and correct Range handling.
- 📔 Document `updateAsync`, `countDocuments`, `estimatedDocumentCount`, `serve`, `download`, `allow`/`deny`, the exported helpers, and the `progress` event arguments.
- 📔 Document upload rules, limits, and the HTTP error body in `about-transports.md`.
- 📔 Document the event order: `abort()` emits `pause`, then `abort`, and no `end`. A failed upload emits `error`, then `end`. Document that `abort()` does not cancel an EOF or HTTP Start request that is already sent.
- 📔 Document that a custom `readableStream` passed to `serve()` for a `Range` request should contain exactly the requested bytes, and when `serve()` sets `Content-Length`.
- 📔 Fix wrong defaults, broken links, typos, and samples that did not run on Meteor 3.
- 📔 Add `CLAUDE.md` with commands, architecture notes, and invariants for contributors and coding agents.
- 📔 Update the README, the docs index, and `CONTRIBUTING.md`: Meteor 3.2 requirement, links to the security and migration guides, and `Isomorphic` instead of `Anywhere` in API labels.
- 📔 Document the `debug` function and the async `storagePath` option in `docs/constructor.md`, and `await` `storagePath()` in the `sharp` thumbnail guide.

### Tests

- 🧪 Add `tests/security.test.js` for upload ownership, path safety, request limits, Range parsing, and access checks.
- 🧪 Port Tinytest helpers to mocha and fix tests that passed without asserting.
- 🧪 Cover `Content-Length` on `200` and `206` for files and custom streams, `HEAD`, `?play=true`, default charsets, racing EOFs (also anonymous), abort after restart (also for records without file identity), `link()` without `_id`, encoded routes, and unlink of missing files.
- 🧪 Check types with `tsc` and `tsd` (`npm run typecheck`).
- 🧪 Cover the `debug` function option and async `storagePath` (Promise return, rejection, startup, `writeAsync`, `loadAsync`).
- 🏗️ Run lint, typecheck, and tests in CI on Meteor 3.2.2 and 3.5.2.
- 🏗️ Replace `.eslintrc` with an ESLint 9 flat config, without the deprecated `no-extra-semi` and `no-native-reassign` rules.

### Dependencies

- 📦 `ostrio:cookies` 3.0.0
- 📦 `eventemitter3` 5.0.4
- 📦 `meteortesting:mocha` 3.4.0, `chai` 6, `sinon` 22 for tests
- 📦 Update the dev dependency lockfile (`js-yaml`, ESLint 9, TypeScript 5.9, `tsd`) and the package `npm-shrinkwrap.json`

For the full changelog see [releases on GitHub](https://github.com/veliovgroup/Meteor-Files/releases).
