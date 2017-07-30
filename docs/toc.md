Meteor-Files
========

<table>
  <tbody>
    <tr>
      <td>
        <a href="https://themeteorchef.com/blog/giant-cotton-apron-awards-show"><img src="https://raw.githubusercontent.com/VeliovGroup/Meteor-Files-Demos/master/GCAA.png"></a>
      </td>
      <td>
        This package is the <strong><a href="https://themeteorchef.com/blog/giant-cotton-apron-awards-show" target="_blank">GCAA Winner 2016</a></strong>. Big thanks to Benjamin Willems and Ryan Glover (<em>The Chef</em>) and all <a href="https://themeteorchef.com" target="_blank">The Meteor Chef</a> team!
      </td>
    </tr>
  </tbody>
</table>

Please see our experimental [webrtc-data-channel](https://github.com/VeliovGroup/Meteor-Files/tree/webrtc-data-channel) branch. Feedback is highly appreciated!

### About:
 - Event-driven API
 - Upload / Read files in Cordova app: __Cordva support__ (Any with support of `FileReader`)
 - Upload via *HTTP*, [*RTC/DC*](https://github.com/VeliovGroup/Meteor-Files/tree/webrtc-data-channel) or *DDP*, [read about difference](https://github.com/VeliovGroup/Meteor-Files/wiki/About-Upload-Transports)
 - File upload:
    * Ready for small and large files (RAM used only for chunk reading - [read about `chunkSize`](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload)))
    * Pause / Resume upload
    * Auto-pause when connection to server is interrupted
    * Multi-stream async upload (*faster than ever*)
 - [Use third-party storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage):
    * [AWS S3](https://github.com/VeliovGroup/Meteor-Files/wiki/AWS-S3-Integration)
    * [DropBox](https://github.com/VeliovGroup/Meteor-Files/wiki/DropBox-Integration)
    * [GridFS](https://github.com/VeliovGroup/Meteor-Files/wiki/GridFS-Integration)
    * Google Drive
    * [Google Storage](https://github.com/VeliovGroup/Meteor-Files/wiki/Google-Cloud-Storage-Integration)
    * any other with JS/REST API
 - Display upload speed
 - Display remaining upload time
 - Serving files:
    * Make files `public`, so your proxy server like __nginx__ can serve them
    * Protect/Restrict access to files
    * Files CRC check (*integrity check*)
 - Write to file system (*FS*):
    * Automatically writes files on FS and special Collection
    * `path`, collection name, schema, chunk size and naming function is under your control
    * Support for file subversions, like thumbnails, audio/video file formats, revisions, and etc.
 - Streaming via HTTP:
    * Correct `mime-type` and `Content-Range` headers
    * Correct `206` and `416` responses
    * Following [RFC 2616](https://tools.ietf.org/html/rfc2616)
 - Download via HTTP:
    * You able to specify `route`
    * Download is ready for small and large files, with support of progressive (`chunked`) download
 - Store wherever you like:
    * You may use `Meteor-Files` as temporary storage
    * After file is uploaded and stored on FS you able to `mv` or `cp` its content, see [3rd-party storage integration](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage) examples
 - Support of non-Latin (non-Roman) file names
 - Subscribe on files (*collections*) you need

### ToC:
##### API:
 - [`FilesCollection` Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) [*Isomorphic*] - Initialize FilesCollection
   * [SimpleSchema Integration](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor#attach-schema-isomorphic)
   * [Collection `deny` rules](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor#deny-collection-interaction-on-client-server)
   * [Collection `allow` rules](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor#allow-collection-interaction-on-client-server)
   * [Control upload access](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor#use-onbeforeupload-to-avoid-unauthorized-upload)
   * [Control remove access](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor#use-onbeforeremove-to-avoid-unauthorized-remove)
   * [Custom response headers](https://github.com/VeliovGroup/Meteor-Files/wiki/Custom-Response-Headers) for CORS or anything else
 - [`FileCursor` Class](https://github.com/VeliovGroup/Meteor-Files/wiki/FileCursor) - Instance of this class is returned from `.findOne()` method
   * `remove(callback)` - {*undefined*} - Remove document
   * `link()` - {*String*} - Returns downloadable URL to File
   * `get(property)` - {*Object*|*mix*} - Returns current document as a plain Object
   * `fetch()` - {[*Object*]}- Returns current document as plain Object in Array
   * `with()` - {*FileCursor*} - Returns reactive version of current FileCursor
 - [`FilesCursor` Class](https://github.com/VeliovGroup/Meteor-Files/wiki/FilesCursor) - Instance of this class is returned from `.find()` method
   * `fetch()` - {*[Object]*} - Returns all matching document(s) as an Array
   * `count()` - {*Number*} - Returns the number of documents that match a query
   * `remove(callback)` - {*undefined*} - Removes all documents that match a query
   * `forEach(callback, context)` - {*undefined*} - Call `callback` once for each matching document
   * `each()` - {*[FileCursor]*} - Returns an Array of `FileCursor` made for each document on current Cursor
   * `observe(callbacks)` - {*Object*} - Functions to call to deliver the result set as it changes
   * `observeChanges(callbacks)` - {*Object*} - Watch a query. Receive callbacks as the result set changes
   * [See all methods](https://github.com/VeliovGroup/Meteor-Files/wiki/FilesCursor)
 - [Default Collection Schema](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema)
   * [Attach SimpleSchema and Collection2](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema#attach-schema-recommended)
   * [Extend Schema](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema#extend-default-schema)
   * [Override Schema](https://github.com/VeliovGroup/Meteor-Files/wiki/Schema#pass-your-own-schema-not-recommended)
 - [`write()`](https://github.com/VeliovGroup/Meteor-Files/wiki/Write) [*Server*] - Write `Buffer` to FS and FilesCollection
 - [`load()`](https://github.com/VeliovGroup/Meteor-Files/wiki/Load) [*Server*] - Write file to FS and FilesCollection from remote URL
 - [`addFile()`](https://github.com/VeliovGroup/Meteor-Files/wiki/addFile) [*Server*] - Add local file to FilesCollection from FS
 - [`findOne()`](https://github.com/VeliovGroup/Meteor-Files/wiki/findOne) [*Isomorphic*] - Find one file in FilesCollection
 - [`find()`](https://github.com/VeliovGroup/Meteor-Files/wiki/find) [*Isomorphic*] - Create cursor for FilesCollection
 - [`insert()`](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload)) [*Client*] - Upload file to server
   * [`FileUpload.pipe()`](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload)#piping)
 - [`remove()`](https://github.com/VeliovGroup/Meteor-Files/wiki/remove) [*Isomorphic*] - Remove files from FilesCollection and unlink from FS
 - [`unlink()`](https://github.com/VeliovGroup/Meteor-Files/wiki/unlink) [*Server*] - Unlink file from FS
 - [`link()`](https://github.com/VeliovGroup/Meteor-Files/wiki/link) [*Isomorphic*] - Generate downloadable link
 - [`collection`](https://github.com/VeliovGroup/Meteor-Files/wiki/collection) [*Isomorphic*] - `Meteor.Collection` instance
 - [Template helper `fileURL`](https://github.com/VeliovGroup/Meteor-Files/wiki/Template-Helper) [*Client*] - Generate downloadable link in a template
 
##### Examples:
 - [MUP/Docker Persistent Storage](https://github.com/VeliovGroup/Meteor-Files/wiki/MeteorUp-(MUP)-Usage) - Deploy via MeteorUp to Docker container with persistent `storagePath`
 - [Third-party storage (AWS S3, DropBox, GridFS and Google Storage)](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)
 - [cURL/POST upload example](https://github.com/noris666/Meteor-Files-POST-Example) by [@noris666](https://github.com/noris666)
 - [After upload Image Processing - Create Thumbnails](https://github.com/VeliovGroup/Meteor-Files/wiki/Image-Processing)
 - [Resize, create thumbnail for uploaded image](https://github.com/VeliovGroup/Meteor-Files-Demos/blob/master/demo/imports/server/image-processing.js#L19)
 - [File subversions](https://github.com/VeliovGroup/Meteor-Files/wiki/Create-and-Manage-Subversions) - Create video file with preview and multiple formats
 - [React - Example](https://github.com/VeliovGroup/Meteor-Files/wiki/React-Example) - React with a progress bar and component with links to view, re-name, and delete the files
 - [Converting from CollectionFS/CFS](https://github.com/VeliovGroup/Meteor-Files/wiki/Converting-from-CollectionFS) - Live conversion from the depreciated CFS to Meteor-Files (*Amazon S3 specifically, but applies to all*)
 - [Get FilesCollection instance](https://github.com/VeliovGroup/Meteor-Files/wiki/collection-instances) - Retrieve the FilesCollection by it's underlying Mongo.Collection instance

##### Related Packages:
 - [pyfiles (meteor-python-files))](https://github.com/VeliovGroup/meteor-python-files) Python Client for Meteor-Files package
 - [meteor-autoform-file](https://github.com/VeliovGroup/meteor-autoform-file) - Upload and manage files with [autoForm](https://github.com/aldeed/meteor-autoform)

##### Articles:
 - [MongoDB with Replica Set & OpLog setup](https://veliovgroup.com/article/2qsjtNf8NSB9XxZDh/mongodb-replica-set-with-oplog) - Find out how to speed-up *reactivity* in your Meteor application