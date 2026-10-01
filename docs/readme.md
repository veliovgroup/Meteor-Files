# Meteor-Files Documentation

Explore documentation and examples for files' upload and its custom integration into Meteor.js application

## ToC:

Browse [documentation directory](https://github.com/veliovgroup/Meteor-Files/tree/master/docs) or navigate using a list of links below.

- [About Meteor-Files package](#about)
- [Security guide](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/security.md)
- [Migration to v3](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/migration-to-v3.md)
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
  - Google Drive, use its [JS/REST API](https://developers.google.com/drive/api/guides/about-sdk) the same way as other storages
  - [Google Cloud Storage Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/google-cloud-storage-integration.md)
  - any other with JS/REST API
- Get upload speed
- Get remaining upload time
- Serving files (download):
  - Custom download `route`
  - Download compatible with small and large files, including `Range` requests for streaming and resumable downloads
  - Correct `mime-type` and `Content-Range` headers
  - Correct `206` and `416` responses
  - Following [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
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
- [Template helper `fileURL`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/template-helper.md) [*Client*] - Generate downloadable link in a template
- Initialize FilesCollection
  - [SimpleSchema Integration](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#attach-schema-isomorphic)
  - [Collection `deny` rules](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#deny-collection-interaction-on-client-server)
  - [Collection `allow` rules](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#allow-collection-interaction-on-client-server)
  - [Control upload access](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeupload-to-avoid-unauthorized-upload)
  - [Control remove access](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/constructor.md#use-onbeforeremove-to-avoid-unauthorized-remove)
  - [Custom response headers](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md#custom-response-headers) for CORS or anything else
- [`FileCursor` Class](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md) - Instance of this class is returned from [`.findOneAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOneAsync.md) method
  - `removeAsync()` - {*Promise<FileCursor>*} - Remove document, resolves to the same `FileCursor`
  - `link()` - {*string*} - Returns downloadable URL to File
  - `get(property)` - {*object*|*mix*} - Returns current document as a plain object
  - `fetchAsync()` - {*Promise<object[]>*} - Resolves to current document as plain object in Array
  - `with()` - {*FileCursor*} - [*Client*] Returns reactive version of current FileCursor
  - [__See all *FileCursor* methods__](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md)
- [`FilesCursor` Class](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md) - Instance of this class is returned from [`.find()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/find.md) method
  - `fetchAsync()` - {*Promise<object[]>*} - Returns all matching document(s) as an Array
  - `countDocuments()` - {*Promise<Number>*} - Returns the number of documents that match a query (`countAsync()` is deprecated)
  - `removeAsync()` - {*Promise<number>*} - Removes all documents that match a query, resolves to a number of removed records
  - `forEachAsync(callback, context)` - {*Promise<FilesCursor>*} - Call `callback` once for each matching document
  - `eachAsync()` - {*Promise<FileCursor[]>*} - Resolves to Array of `FileCursor` made for each document on current Cursor
  - `observeAsync(callbacks)` - {*Promise< object >*} - Functions to call to deliver the result set as it changes
  - `observeChangesAsync(callbacks)` - {*Promise< object >*} - Watch a query. Receive callbacks as the result set changes
  - [__See all *FilesCursor* methods__](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)
- [Default Collection Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema)
  - [Extend Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#extend-default-schema)
  - [Override Schema](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#pass-your-own-schema-not-recommended)

### Other `FilesCollection` methods:

- [`updateAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#updateasync) [*Isomorphic*] - Update records, wraps `Mongo.Collection#updateAsync`
- [`countDocuments()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#countdocuments) [*Isomorphic*] - Count records matching a selector
- [`estimatedDocumentCount()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#estimateddocumentcount) [*Isomorphic*] - Fast estimated count of all records
- [`download()` and `serve()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#download-and-serve) [*Server*] - Respond to a download request from custom routes
- [`allow`, `deny`, `allowClient`, `denyClient`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#allow-deny-allowclient-denyclient) [*Isomorphic*] - Collection access rules
- [Exported helpers and `WriteStream`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md#exported-helpers-and-writestream)
- [`FileUpload` events and `progress` arguments](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md)
- [TypeScript definitions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/typescript-definitions.md)

### Demos:

- [Simplest upload app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-upload)
- [Simplest streaming app](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-streaming)
- [Simplest download button](https://github.com/veliovgroup/Meteor-Files-Demos/tree/master/demo-simplest-download-button)
- [Fully-featured file sharing app](https://github.com/veliovgroup/meteor-files-website#file-sharing-web-app), [live: __files.veliov.com__](https://files.veliov.com)

### Examples:

- `docs` [Third-party storage (AWS S3, DropBox, GridFS and Google Storage)](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/3rd-party-storage.md)
- `code-sample` [File subversions](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/file-subversions.md) - Create video file with preview and multiple formats
- `code-sample repo` [cURL/POST upload](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)
- `tutorial` [MUP/Docker Persistent Storage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/meteorup-usage.md) - Deploy via MeteorUp to Docker container with persistent `storagePath`
- `tutorial` [React.js usage](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/react-example.md) - React with a progress bar and component with links to view, re-name, and delete the files
- `tutorial` [Migrating from CollectionFS/CFS](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/convert-from-cfs-to-meteor-files.md) - Live conversion from the deprecated CFS to Meteor-Files (*Amazon S3 specifically, but applies to all*)
- `tutorial` [Getting `FilesCollection` instance](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection-instances.md#filescollection-instances-and-mongocollection-instances) - Retrieve the *FilesCollection* by its underlying `Mongo.Collection` instance
- `tutorial` [Migrating / moving GridFS stored files](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-migration.md) - Three step way of moving/copying/syncing GridFS-stored files between multiple Meteor applications
- `tutorial` [GridFS streaming](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/gridfs-streaming.md) - Implement `206` partial content response
- __Post-processing:__
  - `tutorial` [Create Thumbnails](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/image-processing.md)
  - `tutorial` [Image post-processing using AWS Lambda](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md#further-image-jpeg-png-processing-with-aws-lambda)
  - `code-sample` [Resize, create thumbnail](https://github.com/veliovgroup/meteor-files-website/blob/master/imports/server/image-processing.js#L19)

### Related packages:

- [`pyfiles` (meteor-python-files)](https://github.com/veliovgroup/meteor-python-files) Python Client for Meteor-Files package
- [`meteor-autoform-file`](https://github.com/veliovgroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)
