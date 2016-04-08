Meteor-Files
========

### About
 - Upload / Read files in Cordova app: __Cordva support__ (Any with support of `FileReader`)
 - Upload file(s) via DDP
    * Ready for small and large files (Note Browser will eat 7%-10% RAM of the file size)
    * Pause / Resume upload
    * Auto-pause when connection to server is interrupted
    * Multi-stream async upload (faster than ever)
 - Serving files
    * Make files `public`, so your proxy server like __nginx__ can serve them
    * Protect/Restrict access to files
    * Files CRC check (*integrity check*)
 - Write to file system (*FS*)
    * Automatically writes files on FS and special Collection
    * `path`, collection name, schema, chunk size and naming function is under your control
    * Support for file subversions, like thumbnails, audio/video file formats, revisions, and etc.
 - Streaming via HTTP
    * Correct `mime-type` and `Content-Range` headers
    * Correct `206` and `416` responses
    * Following [RFC 2616](https://tools.ietf.org/html/rfc2616)
 - Download via HTTP
    * You able to specify `route`
    * Download is ready for small and large files, with support of progressive (`chunked`) download
 - Store wherever you like
    * You may use `Meteor-Files` as temporary storage
    * After file is uploaded and stored on FS you able to `mv` or `cp` its content
 - Support of non-latin (non-Roman) file names
 - Subscribe on files (*collections*) you need

### ToC:
##### API:
 - [`Meteor.Files` Constructor](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) [*Isomorphic*] - Initialize Files collection
 - [`write()`]() [*Server*] - Write `Buffer` to FS and Files collection
 - [`load()`]() [*Server*] - Write file to FS and Files collection from remote URL
 - [`addFile()`]() [*Server*] - Add local file to Files collection from FS
 - [`findOne()`]() [*Isomorphic*] - Find one file in Files collection
 - [`find()`]() [*Isomorphic*] - Create cursor for Files collection
 - [`get()`]() [*Isomorphic*] - Return results of `findOne()` or `find()` methods
 - [`fetch()`]() [*Isomorphic*] - Return results of `find()` method, as array of Objects
 - [`insert()`](https://github.com/VeliovGroup/Meteor-Files/wiki/Insert-(Upload)) [*Client*] - Upload file to server
 - [`remove()`]() [*Isomorphic*] - Remove files from Files collection and unlink from FS
 - [`unlink()`]() [*Server*] - Unlink file from FS
 - [`link()`]() [*Isomorphic*] - Generate downloadable link
 - [`collection`]() [*Isomorphic*] - `Meteor.Collection` instance
 - [Template helper `fileURL`]() [*Client*] - Generate downloadable link in template

##### Examples:
 - [File subversions]() - Create video file with preview and multiple formats