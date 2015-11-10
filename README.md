[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/VeliovGroup/Meteor-Files)

Demo app:
========
 - [Live](http://_.meteor.com)
 - [Source](https://github.com/VeliovGroup/Meteor-Files/tree/master/demo)

ToC:
========
 - [Overview](https://github.com/VeliovGroup/Meteor-Files#meteor-files)
 - [Why this package?](https://github.com/VeliovGroup/Meteor-Files#why-meteor-files)
 - [Install](https://github.com/VeliovGroup/Meteor-Files#install)
 - [API](https://github.com/VeliovGroup/Meteor-Files#api)
   * [new Meteor.Files()](https://github.com/VeliovGroup/Meteor-Files#new-meteorfilesconfig-isomorphic) [*Isomorphic*]
   * [Chunk Streaming](https://github.com/VeliovGroup/Meteor-Files#file-streaming) [*Example*]
   * [Force Download](https://github.com/VeliovGroup/Meteor-Files#file-download) [*Example*]
   * [Schema](https://github.com/VeliovGroup/Meteor-Files#current-schema) [*Isomorphic*]
 - [Template Helper](https://github.com/VeliovGroup/Meteor-Files#template-helper)
   * [Force Download](https://github.com/VeliovGroup/Meteor-Files#to-get-download-url-for-file-you-only-need-fileref-object-so-there-is-no-need-for-subscription) [*Example*]
   * [Get file subversion](https://github.com/VeliovGroup/Meteor-Files#to-get-specific-version-of-the-file-use-second-argument-version) [*Example*]
   * [Thumbnail Example](https://github.com/VeliovGroup/Meteor-Files#to-display-thumbnail) [*Example*]
   * [Video Streaming Example](https://github.com/VeliovGroup/Meteor-Files#to-stream-video) [*Example*]
 - [General Methods](https://github.com/VeliovGroup/Meteor-Files#methods)
   * [Insert (Upload) File(s)](https://github.com/VeliovGroup/Meteor-Files#insertsettings-client) [*Client*] - Upload file to server
   * [Collection](https://github.com/VeliovGroup/Meteor-Files#collection--isomorphic) [*Isomorphic*]
   * [findOne()](https://github.com/VeliovGroup/Meteor-Files#findonesearch--isomorphic) [*Isomorphic*]
   * [find()](https://github.com/VeliovGroup/Meteor-Files#findsearch--isomorphic) [*Isomorphic*]
   * [write()](https://github.com/VeliovGroup/Meteor-Files#writebuffer-options-callback--server) [*Server*] - Write binary code into FS
   * [load()](https://github.com/VeliovGroup/Meteor-Files#loadurl-options-callback--server) [*Server*] - Upload file from remote host

Meteor-Files
========
This package allows to:
 - Upload / Read files in Cordova app: __Cordva support__ (Any with support of `FileReader`)
 - Upload file(s) via DDP
    * Small files
    * Huge files, tested on 100GB (Note Browser will eat 7%-10% RAM of the file size)
    * Pause / Resume upload
    * Auto-pause when connection to server is interrupted
    * Multi-stream async upload (faster than ever)
 - Serving files
    * Set `public` option to `true` to serve files via your proxy server, like __nginx__
    * Set `protected` option to `true` to serve files only to authorized users, or to `function()` to check user's permission
    * Files CRC check (integrity check)
 - Write file in file system
    * Automatically writes uploaded files on FS and special Collection
    * You able to specify `path`, collection name, schema, chunk size and naming function
    * Store multiply versions of the file, like revisions, image thumbnails or video in different formats, and etc.
 - File streaming from server via HTTP
    * Correct `mime-type` and `Content-Range` headers
    * Correct `206` and `416` responses
 - Download uploaded files from server via HTTP
    * You able to specify `route`
    * Download huge files via stream `pipe`, tested on 100GB
    * Fast download for small files
 - Store wherever you like
    * You may use `Meteor-Files` as temporary storage
    * After file is uploaded and stored on FS you able to `mv` or `cp` it's content 
 - Support of non-latin (non-Roman) file names
 - Subscribe on files you need


Why `Meteor-Files`?
========
`cfs` is a good package, but buggy cause it's huge monster which combine everything. In `Meteor-Files` is nothing to broke, it's simply upload/store/retrieve files to/from server. 
 - You need store to GridFS? - Add it yourself
 - You need to check file mime-type or extensions? - Add it yourself
 - You need to resize images after upload? - Add it yourself

Easy-peasy kids, yeah?

Install:
========
```shell
meteor add ostrio:files
```

API
========
###### `new Meteor.Files([config])` [*Isomorphic*]

`config` is __optional__ object with next properties:
 - `storagePath` {*String*} - Storage path on file system
    * Default value: `/assets/app/uploads`
 - `collectionName` {*String*} - Collection name
    * Default value: `MeteorUploadFiles`
 - `cacheControl` {*String*} - Default `Cache-Control` header, by default: `public, max-age=31536000, s-maxage=31536000`
 - `allowUpload` {*Boolean*} - Allow/deny upload method calls from client, default: `true`
 - `throttle` {*Number* | *false*} - Throttle download speed in *bps*, by default is `false`
 - `downloadRoute` {*String*} - Server Route used to retrieve files
    * Default value: `/cdn/storage`
 - `schema` {*Object*} - Collection Schema (*See [__Schema__](https://github.com/VeliovGroup/Meteor-Files#current-schema) section below*). Use to change schema rules, for example make `extension`, required. [Default value](https://github.com/VeliovGroup/Meteor-Files#current-schema)
 - `chunkSize` {*Number*} - Upload chunk size
    * Default value: `272144`
 - `namingFunction` {*Function*} - Function which returns `String`
    * Default value: `String.rand`
 - `permissions` {*Number*} - FS-permissions (access rights) in octal, like `0755` or `0777`
    * Default value: `0777`
 - `integrityCheck` {*Boolean*} - CRC file check
    * Default value: `true`
 - `strict` {*Boolean*} - Strict mode for partial content, if is `true` server will return `416` response code, when `range` is not specified
    * Default value: `false`
 - `downloadCallback` {*Function*} - Called right before initiate file download, with next context and only one argument `fileObj`:
    * `fileObj` - see __Current [schema](https://github.com/VeliovGroup/Meteor-Files#current-schema)__ section below
    * __context__:
      - `@request`
      - `@response`
      - `@user()`
      - `@userId`
    * __Notes__:
      * Function should return {*Boolean*} value, to abort download - return `false`, to allow download - return `true`
 - `protected` {*Boolean*|*Function*} - If `true` - files will be served only to authorized users, if `function()` - you're able to check visitor's permissions in your own way
    * Default value: `false`
    * If function - `function(fileObj)` 
      * __context__ has:
        - `@request` - On __server only__
        - `@response` - On __server only__
        - `@user()`
        - `@userId`
      * __arguments__:
        - `fileObj` {*Object*|*null*} - If requested file exists `fileObj` is [file object](https://github.com/VeliovGroup/Meteor-Files#current-schema), otherwise `fileObj` is null
      * __return__ `true` to continue
      * __return__ `false` to abort or {*Number*} to abort upload with specific response code, default response code is `401`
 - `public` {*Boolean*} - If `true` - files will be stored in folder publicity available for proxy servers, like nginx
    * Default value: `false`
    * Route: `http://example.com/uploads/:collectionName/:fileName`
    * __Note:__ Collection can not be `public` and `protected` at the same time!
    * __Note:__ `integrityCheck` is __not__ guaranteed!
    * __Note:__ `play` and force `download` features is __not__ guaranteed!
 - `onBeforeUpload` {*Function*} - Callback triggered right before upload on __client__ and right after recieving a chunk on __server__, with __no arguments__:
    * Context of the function is {*Object*}, with:
      - `extension`, alias `ext`
      - `mime-type`, alias `type`
      - `size`
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `onbeforeunloadMessage` {*String* or *Function*} - Message shown to user when closing browser's window or tab, while upload in the progress
    * Default value: `'Upload in a progress... Do you want to abort?'`
 - `allowClientCode` {*Boolean*} - Allow to run `remove()` from client
 - `debug` {*Boolean*} - Turn on/of debugging and extra logging
    * Default value: `false`

Usage
========
```coffeescript
myFiles.cacheControl = 'public, max-age=31536000' # Set 'Cache-Control' header for downloads

myFiles = new Meteor.Files
  storagePath: 'assets/app/uploads/myFiles'
  collectionName: 'myFiles'
  chunkSize: 256*128
  permissions: 0o777
  allowClientCode: true
  onbeforeunloadMessage: ->
    i18n.get '_app.abortUpload' # See 'ostrio:i18n' package

fileObject = myFiles.findOne 'recordId'

if Meteor.isClient
  myFiles.collection.subscribe "MeteorFileSubs", postId.get()

if Meteor.isServer
  Meteor.publish "MeteorFileSubs", (postId) ->
    myFiles.collection.find {'meta.postId': postId}

myFiles.insert(file) # Upload file

myFiles.find({'meta.userId': Meteor.userId()}).cursor   # Current collection cursor
myFiles.find({'meta.userId': Meteor.userId()}).get()    # Array of fetched rows
myFiles.find({'meta.userId': Meteor.userId()}).remove() # Remove all files on the cursor

myFiles.remove({'meta.userId': Meteor.userId()}) # Remove all files returned by passed search
myFiles.remove(fileRef._id)                      # Remove file by ID

myFiles.findOne(fileRef._id).get()            # Get fileRef
myFiles.findOne(fileRef._id).link()           # Get download link
myFiles.findOne(fileRef._id).link('version')  # Get download link of specific version
myFiles.link(fileObject)                      # Get download link
myFiles.link(fileObject, 'version')           # Get download link of specific version
myFiles.findOne(fileRef._id).remove()         # Remove file
```

###### File streaming:
To stream file add `?play=true` query to download link.
```coffeescript
audio = new Meteor.Files()

if Meteor.isClient
  Template.my.helpers
    audiofiles: ->
      audio.find({'meta.post': postId}).cursor
```

In template:
```jade
template(name="my")
  ul
    each audiofiles
      li 
        audio(preload="auto" controls="true")
          source(src="{{fileURL this}}?play=true" type="{{type}}")
```

###### File download:
To download file use `fileURL` template helper. Data will be transfered via pipe, - just add `?download=true` query to link, so server will send file directly. Use `?download=true` query for smaller files, for big files - just use plain link without query.
```coffeescript
uploads = new Meteor.Files()

if Meteor.isClient
  Template.my.helpers
    files: ->
      uploads.find({'meta.post': postId}).cursor
```

In template:
```jade
template(name="my")
  ul
    each files
      li 
        a(href="{{fileURL this}}?download=true" target="_parent") name
```


###### Current schema:
```coffeescript
name:
  type: String
type:
  type: String
extension:
  type: String
  optional: true
path:
  type: String
meta:
  type: Object
  blackbox: true
  optional: true
versions:
  type: Object
  blackbox: true

  ###
  Example
  original:
    path: String
    size: Number
    type: String
    extension: String
  ...
  other:
    path: String
    size: Number
    type: String
    extension: String
  ###

userId:
  type: String
  optional: true
isVideo:
  type: Boolean
isAudio:
  type: Boolean
isImage:
  type: Boolean
size:
  type: Number
```

Template Helper
==========
###### To get download URL for file, you only need `fileRef` object, so there is no need for subscription:
```jade
a(href="{{fileURL fileRef}}?download=true" target="_parent" download) {{fileRef.name}}
```

###### To get specific version of the file use second argument `version`:
__Note:__ If requested version of file is not available - the original file will be returned
```jade
a(href="{{fileURL fileRef 'small'}}?download=true" target="_parent" download) {{fileRef.name}}
```

###### To display thumbnail:
__Note:__ If thumbnail (basically version of the file) is not available the original file will be returned
```jade
img(src="{{fileURL fileRef 'thumb'}}" alt="{{fileRef.name}}")
```

###### To stream video:
```jade
video(width="80%" height="auto" controls="controls" poster="{{fileURL fileRef 'videoPoster'}}")
  source(src="{{fileURL fileRef 'ogg'}}?play=true" type="video/ogg")
  source(src="{{fileURL fileRef 'mp4'}}?play=true" type="video/mp4")
  source(src="{{fileURL fileRef 'webm'}}?play=true" type="video/webm")
```

__Note!__: There is no build-in way for image or video resizing, encoding and re-sampling, below example how you can multiple file versions:
```coffeescript
FilesCollection = new Meteor.Files()

if Meteor.isClient
  'change #upload': (e, template) ->
    _.each e.currentTarget.files, (file) ->
      Collections.FilesCollection.insert 
        file: file
        onUploaded: (error, fileObj) ->
          if error
            alert error.message
            throw Meteor.log.warn "File Upload Error", error
          template.$(e.target).val('')
          template.$(e.currentTarget).val('')

          Meteor.call 'convertVideo', fileObj, () ->
            alert "File \"#{fileObj.name}\" successfully uploaded"

        onProgress: _.throttle (progress) ->
          template.$('input#progress').val progress
        ,
          500

        onBeforeUpload: () ->
          if ['ogg', 'mp4', 'avi', 'webm'].inArray(@ext) and @size < 512 * 1048 * 1048
            true
          else
            "Please upload file in next formats: 'ogg', 'mp4', 'avi', 'webm' with size less than 512 Mb. You have tried to upload file with \"#{@ext}\" extension and with \"#{Math.round((@size/(1024*1024)) * 100) / 100}\" Mb"
        streams: 8

if Meteor.isServer
  ###
  @var {object} bound - Meteor.bindEnvironment aka Fiber wrapper
  ###
  bound = Meteor.bindEnvironment (callback) ->
    return callback()

  ###
  @description Require "fs-extra" npm package
  ###
  fs = Npm.require "fs-extra"

  Meteor.methods
    convertVideo: (fileRef) ->
      check fileRef, Object

      sourceFile = ffmpeg(fileRef.path).noProfile()

      formats =
        ogg: true
        mp4: true
        webm: true

      _.each formats, (convert, format) ->
        file = _.clone sourceFile
        bound ->
          version = file.someHowConvertVideoAndReturnFileData(format)
          upd = 
            $set: {}
          upd['$set']['versions.' + name] = 
            path: version.path
            size: version.size
            type: version.type
            extension: version.extension
          FilesCollection.collection.update fileRef._id, upd
      return true
```

Methods
==========
###### `insert(settings)` [*Client*]
`settings` is __required__ object with next properties:
 - `file` {*File*} or {*Object*} - [REQUIRED] HTML5 `files` item, like in change event: `event.currentTarget.files[0]`
 - `meta` {*Object*} - Additional data as object, use later for search
 - `onUploaded` {*Function*} - Callback triggered when upload is finished, with two arguments:
    * `error`
    * `fileRef` - see __Current schema__ section above
 - `onProgress` {*Function*} - Callback triggered when chunk is sent, with only argument:
    * {`progress` *Number*} - Current progress from `0` to `100`
 - `onBeforeUpload` {*Function*} - Callback triggered right before upload is started, with __no arguments__:
    * Context of the function is `File` - so you are able to check for extension, mime-type, size and etc.
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `streams` {*Number*} - Quantity of parallel upload streams
 - `onAbort` {*Function*} - Callback triggered when `abort()` method is called, with only one argument:
    * `file` - File object passed as `file` property to `insert()` method

Returns {*Object*}, with properties:
 - `onPause` {*ReactiveVar*} - Is upload process on the pause?
 - `progress` {*ReactiveVar*} - Upload progress in percents
 - `pause` {*Function*} - Pause upload process
 - `continue` {*Function*} - Continue paused upload process
 - `toggleUpload` {*Function*} - Toggle `continue`/`pause` if upload in the progress
 - `abort` {*Function*} - Abort upload progress, and trigger `onAbort` callback

```coffeescript
# For example we upload file for blog post
post = Posts.findOne(someId) # Get blog post reference
uploads = new Meteor.Files() # Create Meteor.Files instance

if Meteor is client
  # Let's create progress-bar
  currentUploadProgress = new ReactiveVar false
  Template.my.helpers
    progress: ->
      currentUploadProgress.get()

  Template.my.events
    'change #file': (e) ->

      _.each e.currentTarget.files, (file) ->
        uploads.insert
          file: file
          meta:
            post: post._id # Add meta object with reference to blog post

          onUploaded: (error, fileObj) ->
            if not error
              doSomething fileRef.path, post._id, fileRef
            currentUploadProgress.set false
            $(e.target).val('')
          
          onProgress: _.throttle (progress) ->
            currentUploadProgress.set progress
          ,
            500

          onBeforeUpload: () ->
            # Set Allowed Extensions and max file size
            allowedExt = ['mp3', 'm4a']
            allowedMaxSize = 26214400

            if allowedExt.inArray(@ext) and @size < allowedMaxSize # See `ostrio:jsextensions` package
              true
            else
              "Max upload size is #{Math.round((allowedMaxSize/(1024*1024)) * 100) / 100} Mb. Allowed extensions is #{allowedExt.join(', ')}"

          streams: 8
```

Progress bar in template (TWBS):
```jade
template(name="my")
  input.btn.btn-success#file(type="file")

  if progress
    .progress
      .progress-bar.progress-bar-striped.active(style="width:{{progress}}%")
        span.sr-only {{progress}}%
```

###### `collection`  [*Isomorphic*]
Mongo Collection Instance - Use to fetch data. __Do not `remove` or `update`__ this collection

```coffeescript
uploads = new Meteor.Files()

if Meteor.isClient
  # postId.get() is some ReactiveVar or session
  Meteor.subscribe "MeteorFileSubs", postId.get()

if Meteor.isServer
  Meteor.publish "MeteorFileSubs", (postId) ->
    uploads.collection.find {'meta.postId': postId}

uploads.collection.find({'meta.post': post._id})
uploads.collection.findOne('hdjJDSHW6784kJS')
```

###### `findOne(search)`  [*Isomorphic*]
Find one fileObj matched by passed search
 - `search` {*String* or *Object*} - `_id` of the file or `Object`

```coffeescript
uploads = new Meteor.Files()

uploads.findOne('hdjJDSHW6784kJS').get()            # Get fileRef
uploads.findOne('hdjJDSHW6784kJS').remove()         # Remove file
uploads.findOne('hdjJDSHW6784kJS').link('version')  # Get download link

uploads.findOne({'meta.post': post._id}).get()    # Get fileRef
uploads.findOne({'meta.post': post._id}).remove() # Remove file
uploads.findOne({'meta.post': post._id}).link()   # Get download link
```

###### `find(search)`  [*Isomorphic*]
Find multiply fileObj matched by passed search
 - `search` {*String* or *Object*} - `_id` of the file or `Object`

```coffeescript
uploads = new Meteor.Files()

uploads.find({'meta.post': post._id}).cursor   # Current cursor
uploads.find({'meta.post': post._id}).fetch()  # Get cursor as Array (Array of objects)
uploads.find('hdjJDSHW6784kJS').get()          # Get array of fileRef(s)
uploads.find({'meta.post': post._id}).get()    # Get array of fileRef(s)
uploads.find({'meta.post': post._id}).remove() # Remove all files on cursor
```

###### `write(buffer, [options], [callback])` [*Server*]
Write binary data to FS and store in `Meteor.Files` collection
 - `buffer` {*Buffer*} - Binary data
 - `options` {*Object*} - Object with next properties:
    * `type` - File mime-type
    * `size` - File size
    * `meta` - Additional data as object, use later for search
    * `name` or `fileName` - File name
 - `callback(error, fileObj)`

Returns:
 - `fileObj` {*Object*}

```coffeescript
uploads = new Meteor.Files()
buffer = fs.readFileSync 'path/to/file.jpg'
uploads.write buffer
, 
  type: 'image/jpeg'
  name: 'MyImage.jpg'
  meta: 
    post: post._id
,
  (err, fileObj) ->
    # Download File
    window.open uploads.link(fileObj, 'original')+'?download=true', '_parent'
```

###### `load(url, options, callback)` [*Server*]
Upload file via http from remote host to server's FS and store in `Meteor.Files` collection
 - `url` {*String*} - Binary data
 - `options` {*Object*} - Object with next properties:
    * `meta` - Additional data as object, use later for search
    * `name` or `fileName` - File name
 - `callback(error, fileObj)`

Returns:
 - `fileObj` {*Object*}

```coffeescript
uploads = new Meteor.Files()
uploads.load 'http://domain.com/small.png'
, 
  name: 'small.png'
  meta: 
    post: post._id
,
  (err, fileObj) ->
    # Download File
    window.open uploads.link(fileObj, 'original')+'?download=true', '_parent'
```