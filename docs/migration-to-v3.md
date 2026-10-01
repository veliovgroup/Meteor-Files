📦 v3.0.0

- [📦 Packosphere `@3.0.0`](https://packosphere.com/ostrio/files/3.0.0)
- [☄️ AtmosphereJS `@3.0.0`](https://atmospherejs.com/ostrio/files)

### Summary

- ✨ Refactor: Hook options: `protected`, `onBeforeRemove`, `onAfterRemove`, `onInitiateUpload`, `onAfterUpload`, `namingFunction` are now *async*
- 🤝 Refactor: Compatibility with `meteor@3` and other modern packages. Since v3.1.0 the minimum Meteor version is `3.2` (`ostrio:cookies` 3.0.0 needs `fetch@0.1.6`, first shipped with Meteor 3.2)
- ☄️ Refactor: Match `FilesCollection` APIs with new `*Async` methods of `Mongo.Collection`; Deprecate callback APIs on the Server
- 👨‍💻 Refactor: Utilize node's async APIs where suitable
- 👨‍💻 Refactor: Improve pause/resume logic on connection interruption/reconnect
- 📔 Docs: Updated and refactored docs with better examples
- 📔 Docs: Refactored JSDoc matching definitions in TypeScript
- 🤓 Dev: Improved TypeScript support
- 👷‍♂️ Dev: Improved debugging logs
- 👨‍🔬 Tests: Improved test-suite
- 👷‍♂️ Git: CI GitHub Action Workflows for lint and build tests

### Major changes

__FilesCollection__:

- ⚠️ `FilesCollection#remove()` — deprecated on server, use `FilesCollection#removeAsync` instead
- ⚠️ `FilesCollection#findOne()` — deprecated on server, use `FilesCollection#findOneAsync` instead
- ⚠️ `FilesCollection#unlink()` — deprecated on server, use `FilesCollection#unlinkAsync` instead
- ⚠️ `FilesCollection#write()` — deprecated on server, use `FilesCollection#writeAsync` instead
- ⚠️ `FilesCollection#load()` — deprecated on server, use `FilesCollection#loadAsync` instead

__FileCursor__:

- ⚠️ `FileCursor#remove()` — deprecated on server, use `FileCursor#removeAsync` instead

__FilesCursor__:

- ⚠️ `FilesCursor#remove()` — deprecated on server, use `FilesCursor#removeAsync` instead
- ⚠️ `FilesCursor#hasNext()` - deprecated, use `FilesCursor#hasNextAsync` instead
- ⚠️ `FilesCursor#count()` - deprecated, use `FilesCursor#countDocuments` instead
- ⚠️ `FilesCursor#countAsync()` - deprecated, use `FilesCursor#countDocuments` instead

__FileUpload__:

- ⚠️ `FileUpload#start()` is now *async*!
- ✨ New `FileUpload#remainingTime` {*ReactiveVar*} with upload remaining time in human-readable format

__Callbacks and hooks__:

- ⚠️ Isomorphic: `this.user()` is deprecated, use `this.userAsync()` instead
- ⚠️ Client: `FileUpload` now always triggers `end` even in the case of successful and failed uploads; *Before: `end` event wasn't called under certain conditions*
- ⚠️ Client: All errors appeared during upload in all hooks and events of `FileUpload` are now instance of `Meteor.Error`; *Before: Errors had mixed type or were simply text*
- ⚠️ Client: Errors are the same now (type, code, text, reason, details) within DDP and HTTP protocols; *Before: DDP and HTTP protocols had different errors*
- ⚠️ Client: The next *private* events were removed from `UploadInstance` Class: `upload`, `sendEOF`, `prepare`, `sendChunk`, `proceedChunk`

### New methods

__FilesCollection__:

- ✨ Client: `FilesCollection#insertAsync()`
- ✨ Isomorphic: `FilesCollection#updateAsync()`
- ✨ Isomorphic: `FilesCollection#removeAsync()`
- ✨ Isomorphic: `FilesCollection#findOneAsync()`
- ✨ Isomorphic: `FilesCollection#countDocuments()`
- ✨ Isomorphic: `FilesCollection#estimatedDocumentCount()`
- ✨ Server: `FilesCollection#unlinkAsync()`
- ✨ Server: `FilesCollection#writeAsync()`
- ✨ Server: `FilesCollection#loadAsync()`

__FileUpload__:

- ✨ New `FileUpload#remainingTime` {*ReactiveVar*} with upload remaining time in human-readable format

__FileCursor__:

- ✨ Isomorphic: `FileCursor#removeAsync()`
- ✨ Isomorphic: `FileCursor#fetchAsync()`
- ✨ Isomorphic: `FileCursor#withAsync()`

__FilesCursor__:

- ✨ Isomorphic: `FilesCursor#getAsync()`
- ✨ Isomorphic: `FilesCursor#hasNextAsync()`
- ✨ Isomorphic: `FilesCursor#nextAsync()`
- ✨ Isomorphic: `FilesCursor#hasPreviousAsync()`
- ✨ Isomorphic: `FilesCursor#previousAsync()`
- ✨ Isomorphic: `FilesCursor#removeAsync()`
- ✨ Isomorphic: `FilesCursor#fetchAsync()`
- ✨ Isomorphic: `FilesCursor#firstAsync()`
- ✨ Isomorphic: `FilesCursor#lastAsync()`
- ✨ Isomorphic: `FilesCursor#countDocuments()`
- ✨ Isomorphic: `FilesCursor#forEachAsync()`
- ✨ Isomorphic: `FilesCursor#eachAsync()`
- ✨ Isomorphic: `FilesCursor#mapAsync()`
- ✨ Isomorphic: `FilesCursor#currentAsync()`
- ✨ Isomorphic: `FilesCursor#observeAsync()`
- ✨ Isomorphic: `FilesCursor#observeChangesAsync()`

### New features

- ✨ Client: `FileUpload#remainingTime` *ReactiveVar* — returns remaining upload time in `hh:mm:ss` format;

### Other changes

- 🐞 Bug: Fixed #885 — Upload empty file now `end` upload with error
- 🐞 Bug: Fixed #901 — Caused by #894
- 🔧 Security: Fixed #894. The `x_mtok` cookie is set with `sameSite: 'Lax'` and, in production, the `secure` flag. The cookie is not `httpOnly` because the client sets it from JavaScript, see [security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md)
- 🔧 Refactor: Fixed `FileCursor#with` implementation
- ✨ Refactor: `FileUpload#abort` is now `async`
- ✨ Server: `FilesCollection#addFile` is now *async*
- ✨ Server: `FilesCollection#download` is now *async*
- ✨ Server: `WriteStream` Class is now available for import
- ⚙️ Client: `disableUpload` option processed on the client and returns error in the `end`/`error` events, and `onError` hooks. *Before — throws an error upon calling `.insert()` method*

### Dependencies

__release__:

- `eventemitter3@5.0.1`, *was `4.0.7`*
- *removed:* `abort-controller`, now using native `AbortController`
- *removed:* `fs-extra`, now using native `fs`

__dev__:

- *added:* `chai@4.5.0`
- *added:* `sinon@7.5.0`
