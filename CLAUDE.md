# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ostrio:files` is an Atmosphere package for Meteor 3.2 or newer (`ostrio:cookies` needs `fetch@0.1.6`, first shipped in 3.2) that uploads files from the client to the server and serves them back. It is published from this repo root through `package.js`, not through npm. `package.json` holds only dev tooling. Runtime npm deps go in `Npm.depends` inside `package.js`, and both the `onUse` and `onTest` blocks must declare them.

## Commands

```shell
meteor npm install
npm run lint                 # ESLint 9 flat config (eslint.config.mjs)
npm run typecheck            # tsc --noEmit -p . && tsd (index.test-d.ts)
npm run test:mocha           # meteor test-packages ./ --driver-package meteortesting:mocha --once
npm run test:mocha:watch     # same, re-runs on change
npm run test:browser         # server + browser suite (playwright), TEST_SERVER=0 skips server tests
npx playwright install chromium                 # once, downloads the browser test:browser uses
npm run test:mocha -- --port 3456              # use another port when 3000 is busy
MOCHA_GREP="_checkAccess" npm run test:mocha   # run tests whose name matches (works with meteortesting:mocha)
meteor test-packages ./ --driver-package meteortesting:mocha --once --release 3.5.2   # pin a Meteor release
```

Tests are mocha (`chai`, `sinon`). `tests/server.js` is the server entry point and imports these files. Add a new server test file there.

- `core.test.js`: `FilesCollectionCore`, `link()`, `formatFileURL`
- `cursor.test.js`: `FileCursor` and `FilesCursor`, including the server-side sync method errors
- `helpers.test.js`: `lib.js` helpers
- `server.test.js`: server API, `_checkAccess`, `loadAsync`, `writeAsync`, `serve()`, `WriteStream`
- `security.test.js`: upload ownership, path and file identity checks, size limits, Range, HTTP errors, idempotent EOF
- `browser-fixtures.js`: server half of the browser suite (`mfBrowserTests` collection, `mfTest.*` methods)

`tests/client.js` is the browser entry point. It runs only under `npm run test:browser`, which drives headless Chromium through `meteortesting:browser-tests` and the `playwright` devDependency.

Run all three of lint, typecheck, and tests before finishing. `.versions` is not updated by `test-packages`. When dependencies change, regenerate it from a throwaway app (`meteor create --bare /tmp/x`, add `ostrio:files` and `meteortesting:mocha` with `METEOR_PACKAGE_DIRS` pointing at this repo's parent, copy the resolved versions, drop the `ostrio:files` line). `meteor publish` also rewrites it.

## Architecture

The package entry points differ by side. `server.js` and `client.js` each export a `FilesCollection` that extends `FilesCollectionCore` (`core.js`). The core holds the isomorphic parts: `find`/`findOneAsync`, `link()`, `_dataToSchema`, `_getExt`, and a schema built on top of a regular `Mongo.Collection` (`this.collection`).

Upload flow (client → server):
1. Client `insert()`/`insertAsync()` creates an `UploadInstance` (`upload.js`). It reads the file in `chunkSize` slices, optionally through a Web Worker (`worker.min.js`, also inlined as a blob in `client.js`). The `FileUpload` object returned to user code wraps the instance with reactive `progress`/`state` and `pause`/`continue`/`abort`.
2. There are two transports, picked by `transport: 'ddp' | 'http'`:
   - DDP: Meteor methods named in `_methodNames` (`_FilesCollectionStart_<name>`, `_Write_`, `_Abort_`, `_Remove_`).
   - HTTP: POST to `${downloadRoute}/${collectionName}/__upload` with `x-start`, `x-eof`, `x-chunkid`, `x-fileid`, and `x-mtok` headers, handled in the `WebApp` middleware in `server.js`.
3. Both transports converge in `_startUpload` (which calls `_prepareUpload`) and `_writeUpload` (server). An in-progress upload lives in `_preCollection` (TTL index, `continueUploadTTL`) and in `_currentUploads[fileId]`, a `WriteStream` (`write-stream.js`) that writes chunks at offset `(chunkId-1)*chunkSize` into one file handle. On EOF, `_finishUpload` inserts the final document into `this.collection` and emits `afterUpload`.

Download flow: the same `WebApp` middleware matches `${downloadRoute}/${collectionName}/${_id}/${version}/${name}` (or the `public` variant). Then `_checkAccess` runs (the `protected` option), then `download()`, then `serve()`, which handles Range/206/416, `responseHeaders`, and `Content-Disposition`, and streams with `fs.createReadStream`. Hooks along this path: `interceptRequest`, `interceptDownload`, `downloadCallback`.

Auth on HTTP routes: by default the client sets an `x_mtok` cookie (via `ostrio:cookies`) to `Meteor.connection._lastSessionId`. The server maps it to a userId through `Meteor.server.sessions` (`_getUserId`, `_getUserDefault`). That lookup is in-process memory, so multi-instance deployments need sticky sessions. `config.getUser` replaces this lookup.

Storage is the filesystem only. Files live under `storagePath` (default `assets/app/uploads/<collectionName>`). Each document's `versions.<name>.path` points at a file on disk. Integrations with 3rd-party storage (S3, GridFS, and others) are recipes in `docs/` that move files in `onAfterUpload` and serve them through `interceptDownload`.

`cursor.js`: `FileCursor` wraps one document, `FilesCursor` wraps a Mongo cursor. On the server only the `*Async` methods work, because Meteor 3 server cursors are async. The sync methods throw there.

`lib.js`: shared `helpers` (type checks, `clone`, `sanitize`), `fixJSONParse`/`fixJSONStringify` (Date round-trip for `meta` over HTTP), and `formatFileURL`.

Types are published in `index.d.ts` through `zodern:types`. Keep the file in sync with any option or method change, including the `check()` patterns in the server and client constructors.

## Conventions and invariants

- The server API is async only. Use `*Async` collection methods. The sync `findOne` on the server throws on purpose.
- Every constructor option is validated with `check()` in the server and client constructors. A new option goes in the `check()` block, in the client `allowedParams` list (`client.js`) if the client accepts it, in the JSDoc, in `index.d.ts`, and in `docs/constructor.md`.
- Never trust client-supplied `file.*` fields (strip `RESERVED_FILE_KEYS`), `FSName`, `chunkId`, `chunkSize`, or `fileId`. Chunk size is 1 byte to 16 MiB. HTTP bodies are capped: Start 1 MiB, EOF 64 KiB, chunk is base64 of `chunkSize` plus slack.
- Ownership: Write, EOF, and `_Abort` must go through `_getUploadSession(fileId, userId)`. The stored `userId` must match the caller (`403`). `_Abort` on an unknown or foreign id is `404`. A repeated EOF is answered only for an authenticated owner (`_findFinishedUpload`).
- File identity: Start creates the file with `O_CREAT|O_EXCL` and stores `dev` and `ino` in `_preCollection`. Resume and idle reopen use `O_RDWR` only and compare the identity (`410` missing, `409` replaced). `WriteStream#abort()` unlinks only its own file.
- Path containment is enforced at upload time only: the final path must resolve inside `storagePath(result)` (`_isPathInside`). `serve()` and `unlinkAsync()` trust stored paths, so never let clients write `path` or `versions` (`allowClient()` is unsafe).
- Never send server paths to the client (`_toClientFileObj`). HTTP errors use `{error, reason, isClientSafe?}`, with a generic reason for `5xx`.
- Sync cursor methods throw `Meteor.Error(404)` on the server (`clientOnly()` in `cursor.js`). `link()` uses stored `_downloadRoute`/`_collectionName` only when safe and encodes ids.
- Logging goes through `this._debug(...)`. It is gated by the `debug` option.
- Commit messages use the emoji-prefixed style seen in `git log`, for example `🐛 fix: …` or `📦 vX.Y.Z`.

## Docs

The user docs are `README.md` and `docs/*.md`, indexed by `docs/readme.md`. `AUDIT-2026-08-25.md` is the most recent external security and quality audit.
