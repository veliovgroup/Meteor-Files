# Meteor-Files Documentation

Explore documentation and examples for files' upload and its custom integration into Meteor.js application

## ToC:

Browse [documentation directory](https://github.com/veliovgroup/Meteor-Files/tree/master/docs) or navigate using lost of links below.

- [About Meteor-Files package](#about)
- [API](#api)
- [Examples](#examples)
- [Demos](#demos)
- [Related packages](#related-packages)

## About:

Meteor-Files library features and highlights

- Event-driven API
- [TypeScript Definitions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/typescript-definitions.md)
- Upload / Read files in Cordova app: __Cordova support__ (Any with support of `FileReader`)
- File upload:
  - Upload via *HTTP* or *DDP*, [read about difference](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/about-transports.md#about-upload-transports)
  - Ready for small and large files (optimized RAM usage)
  - Pause / Resume upload
  - Auto-pause when connection to server is interrupted
  - Parallel multi-stream async upload (*faster than ever*)
  - Support of non-Latin (non-Roman) file names
- [Use third-party storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md):
  - [AWS S3 Bucket Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md)
  - [DropBox Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/dropbox-integration.md)
  - [GridFS using `GridFSBucket`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-bucket-integration.md#use-gridfs-with-gridfsbucket-as-a-storage)
  - [GridFS using `gridfs-stream` (legacy)](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-integration.md)
  - Google Drive
  - [Google Cloud Storage Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/google-cloud-storage-integration.md)
  - any other with JS/REST API
- Get upload speed
- Get remaining upload time
- Serving files (download):
  - Custom download `route`
  - Download compatible with small and large files, including progressive (`chunked`) download
  - Correct `mime-type` and `Content-Range` headers
  - Correct `206` and `416` responses
  - Following [RFC 2616](https://tools.ietf.org/html/rfc2616)
  - Control access to files
  - Files CRC check (*integrity check*)
  - Serve public files with a server like __nginx__
- Write to file system (`fs.`):
  - Automatically writes files on FS and special Collection
  - `path`, collection name, schema, chunk size and naming function is under your control
  - Support for file subversions, like thumbnails, audio/video file formats, revisions, and etc.
- Store wherever you like:
  - You may use `Meteor-Files` as temporary storage
  - After file is uploaded and stored on FS you able to `mv` or `cp` its content, see [3rd-party storage integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md) examples
- Subscribe on files (*collections*) you need

### API:

- [`FilesCollection` Constructor](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md) [*Isomorphic*]
- [`insert()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md) [*Client*] - Upload file(s) from client to server
  - [`FileUpload#pipe()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md#piping)
- [`write()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/write.md) [*Server*] - Write `Buffer` to FS and FilesCollection
- [`load()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/load.md) [*Server*] - Write file to FS and FilesCollection from remote URL
- [`addFile()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/addFile.md) [*Server*] - Add local file to FilesCollection from FS
- [`findOne()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOne.md) [*Isomorphic*] - Find one file in FilesCollection; Returns [`FileCursor`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md)
- [`find()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/find.md) [*Isomorphic*] - Create cursor for FilesCollection; Returns [`File__s__Cursor`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)
- [`remove()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/remove.md) [*Isomorphic*] - Remove files from FilesCollection and "unlink" (e.g. remove) from FS
- [`unlink()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/unlink.md) [*Server*] - "Unlink" (e.g. remove) file from FS
- [`link()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/link.md) [*Isomorphic*] - Generate downloadable link
- [`collection`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md) [*Isomorphic*] - `Meteor.Collection` instance
- [Template helper `fileURL`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/template-helper.md) [*Client*] - Generate downloadable link in a template
- Initialize FilesCollection
  - [SimpleSchema Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#attach-schema-isomorphic)
  - [Collection `deny` rules](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#deny-collection-interaction-on-client-server)
  - [Collection `allow` rules](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#allow-collection-interaction-on-client-server)
  - [Control upload access](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeupload-to-avoid-unauthorized-upload)
  - [Control remove access](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeremove-to-avoid-unauthorized-remove)
  - [Custom response headers](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md#custom-response-headers) for CORS or anything else
- [`FileCursor` Class](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) - Instance of this class is returned from [`.findOne()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOne.md) method
  - `remove(callback)` - {*undefined*} - Remove document
  - `link()` - {*String*} - Returns downloadable URL to File
  - `get(property)` - {*Object*|*mix*} - Returns current document as a plain Object
  - `fetch()` - {[*Object*]}- Returns current document as plain Object in Array
  - `with()` - {*FileCursor*} - Returns reactive version of current FileCursor
- [`FilesCursor` Class](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md) - Instance of this class is returned from [`.find()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/find.md) method
  - `fetch()` - {*[Object]*} - Returns all matching document(s) as an Array
  - `count()` - {*Number*} - Returns the number of documents that match a query
  - `remove(callback)` - {*undefined*} - Removes all documents that match a query
  - `forEach(callback, context)` - {*undefined*} - Call `callback` once for each matching document
  - `each()` - {*[FileCursor]*} - Returns an Array of `FileCursor` made for each document on current Cursor
  - `observe(callbacks)` - {*Object*} - Functions to call to deliver the result set as it changes
  - `observeChanges(callbacks)` - {*Object*} - Watch a query. Receive callbacks as the result set changes
  - [See all methods](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)
- [Default Collection Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema)
  - [Attach SimpleSchema and Collection2](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#attach-schema-recommended)
  - [Extend Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#extend-default-schema)
  - [Override Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#pass-your-own-schema-not-recommended)

### Demos:

- [Simplest upload app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)
- [Simplest streaming app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)
- [Simplest download button](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)
- [Fully-featured file sharing app](https://github.com/veliovgroup/meteor-files-website#file-sharing-web-app) — [live: __files.veliov.com__](https://files.veliov.com)

### Examples:

- `docs` [Third-party storage (AWS S3, DropBox, GridFS and Google Storage)](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md)
- `code-sample` [File subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md) - Create video file with preview and multiple formats
- `code-sample repo` [cURL/POST upload](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)
- `tutorial` [MUP/Docker Persistent Storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/meteorup-usage.md) - Deploy via MeteorUp to Docker container with persistent `storagePath`
- `tutorial` [React.js usage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/react-example.md) - React with a progress bar and component with links to view, re-name, and delete the files
- `tutorial` [Migrating from CollectionFS/CFS](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/convert-from-cfs-to-meteor-files.md) - Live conversion from the depreciated CFS to Meteor-Files (*Amazon S3 specifically, but applies to all*)
- `tutorial` [Getting `FilesCollection` instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection-instances.md#filescollection-instances-and-mongocollection-instances) - Retrieve the *FilesCollection* by it's underlying `Mongo.Collection` instance
- `tutorial` [Migrating / moving GridFS stored files](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-migration.md) - Three step way of moving/copying/syncing GridFS-stored files between multiple Meteor applications
- `tutorial` [GridFS streaming](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-streaming.md) - Implement `206` partial content response
- __Post-processing:__
  - `tutorial` [Create Thumbnails](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/image-processing.md)
  - `tutorial` [Image post-processing using AWS Lambda](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md#further-image-jpeg-png-processing-with-aws-lambda)
  - `code-sample` [Resize, create thumbnail](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/server/image-processing.js#L19)

### Related packages:

- [`pyfiles` (meteor-python-files)](https://github.com/veliovgroup/meteor-python-files) Python Client for Meteor-Files package
- [`meteor-autoform-file`](https://github.com/veliovgroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)
