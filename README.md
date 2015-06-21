Meteor-Files
========
This package allows to:
 - Upload file(s) via DDP
    * Small files
    * Huge files, tested on 100GB (Note Browser will eat 7%-10% RAM of the file size)
    * Pause / Resume upload
    * Auto-pause when connection to server is interrupted
    * Multi-stream async upload (faster than ever)
 - Write file in file system
    * Automatically writes uploaded files on FS and special Collection
    * You able to specify `path`, collection name, schema, chunk size and naming function
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
###### `new Meteor.Files([config])` [{*Isomorphic*}]

`config` is __optional__ object with next properties:
 - `storagePath` {*String*} - Storage path on file system
    * Default value: `/assets/app/uploads`
 - `collectionName` {*String*} - Collection name
    * Default value: `MeteorUploadFiles`
 - `downloadRoute` {*String*} - Server Route used to retrieve files
    * Default value: `/cdn/storage`
 - `schema` {*Object* - Collection Schema (*Not editable for current release*})
 - `chunkSize` {*Number*} - Upload chunk size
    * Default value: `272144`
 - `namingFunction` {*Function*} - Function which returns `String`
    * Default value: `String.rand`
 - `permissions` {*Number*} - Permissions or access rights in octal, like `0755` or `0777`
 - `onbeforeunloadMessage` {*String* or *Function*} - Message shown to user when closing browser's window or tab, while upload in the progress
 - `allowClientCode` {*Boolean*} - Allow to run `remove()` from client
 - `debug` {*Boolean*} - Turn on/of debugging and extra logging
    * Default value: `false`

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

if Meteor.isClient
  myFiles.collection.subscribe "MeteorFileSubs", postId.get()

if Meteor.isServer
  Meteor.publish "MeteorFileSubs", (postId) ->
    myFiles.collection.find {'meta.postId': postId}

myFiles.insert(file) # Upload file

myFiles.find({'meta.userId': Meteor.userId()}).cursor   # Current collection cursor
myFiles.find({'meta.userId': Meteor.userId()}).get()    # Array of fetched rows
myFiles.find({'meta.userId': Meteor.userId()}).remove() # Remove all files on the cursor

myFiles.remove({'meta.userId': Meteor.userId()})        # Remove all files returned by passed search
myFiles.remove(fileRef._id)           # Remove file by ID

myFiles.findOne(fileRef._id).get()    # Get fileRef
myFiles.findOne(fileRef._id).link()   # Get download link
myFiles.findOne(fileRef._id).remove() # Remove file
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
To get download URL for file, you only need `fileRef` object, so there is no need for subscription:
```jade
a(href="{{fileURL fileRef}}?download=true" target="_parent" download) {{fileRef.name}}
```

To get specific version of the file use second argument `version`:
```jade
a(href="{{fileURL fileRef 'small'}}?download=true" target="_parent" download) {{fileRef.name}}
```

To display thumbnail:
```jade
img(src="{{fileURL fileRef 'thumb'}}" alt="{{fileRef.name}}")
```

To stream video:
```jade
video(width="80%" height="auto" controls="controls" poster="{{fileURL fileRef 'videoPoster'}}")
  source(src="{{fileURL fileRef 'ogg'}}?play=true" type="{{fileRef.versions.ogg.type}}")
  source(src="{{fileURL fileRef 'mp4'}}?play=true" type="{{fileRef.versions.mp4.type}}")
  source(src="{{fileURL fileRef 'webm'}}?play=true" type="{{fileRef.versions.webm.type}}")
```

__Note!__: There is no build-in way for image or video resizing, encoding and re-sampling, below example how you can multiple file versions:
```coffeescript
FilesCollection = new Meteor.Files()

if Meteor.isClient
  'change #upload': (e, template) ->
    _.each e.currentTarget.files, (file) ->
      Collections.PostsFiles.insert 
        file: file
        onUploaded: (error, fileObj) ->
          if error
            toastr.error error.message, "Wrong file"
            throw Meteor.log.warn "File Upload Error", error
  
          template.$(e.target).val('')
          template.$(e.currentTarget).val('')

          Meteor.call 'convertVideo', fileObj, () ->
            alert "\"#{fileObj.name}\" successfully uploaded", "File uploaded"
        onProgress: _.throttle (progress) ->
          template.$('input#progress').val progress
        ,
          500
        onBeforeUpload: () ->
          if ['ogg', 'mp4', 'avi', 'webm'].inArray(@ext) and @size < 512 {* 1048 *} 1048
            true
          else
            "Please upload file in next formats: 'ogg', 'mp4', 'avi', 'webm' with size less than 512 Mb. You have tried to upload file with \"#{@ext}\" extension and with \"#{Math.round((@size/(1024{*1024)) *} 100) / 100}\" Mb"
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
        img = _.clone image
        bound ->
          version = sourceFile.comeHowConvertVideoAndReturnFileData(format)
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
 - `file` {*File*} or {*Object*} - [REQUIRED] HTML5 `files` item, like in change event: `e.currentTarget.files[0]`
 - `meta` {*Object*} - Additional data as object, use later for search
 - `onUploaded` {*Function*} - Callback triggered when upload is finished, with two arguments:
    * `error`
    * `fileRef` - see __Current schema__ section above
 - `onProgress` {*Function*} - Callback triggered when chunk is sent, with only argument:
    {* `progress` *Number*} - Current progress from `0` to `100`
 - `onBeforeUpload` {*Function*} - Callback triggered right before upload is started, with __no arguments__:
    * Context of the function is `File` - so you are able to check for extension, mime-type, size and etc.
    * __return__ `true` to continue
    * __return__ `false` to abort upload
 - `streams` {*Number*} - Quantity of parallel upload streams

Returns {*Object*}, with properties:
 - `onPause` {*ReactiveVar*} - Is upload process on the pause?
 - `progress` {*ReactiveVar*} - Upload progress in pro-cents 
 - `pause` {*Function*} - Pause upload process
 - `continue` {*Function*} - Continue paused upload process
 - `toggleUpload` {*Function*} - Toggle `continue`/`pause` if upload process
  

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
      UIBlock.block i18n.get '_app.uploading' # See 'ostrio:uiblocker' and 'ostrio:i18n' packages

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
            UIBlock.unblock()
          
          onProgress: _.throttle (progress) ->
            currentUploadProgress.set progress
          ,
            500

          onBeforeUpload: () ->
            # Set Allowed Extensions and max file size
            ['mp3', 'm4a'].inArray(@ext) and @size < 26214400 # See `ostrio:jsextensions` package

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
 - `search` {*String* or *Object*} - `_id` of the file or `Object`

```coffeescript
uploads = new Meteor.Files()

uploads.findOne('hdjJDSHW6784kJS').get()    # Get fileRef
uploads.findOne('hdjJDSHW6784kJS').remove() # Remove file
uploads.findOne('hdjJDSHW6784kJS').link()   # Get download link

uploads.findOne({'meta.post': post._id}).get()    # Get fileRef
uploads.findOne({'meta.post': post._id}).remove() # Remove file
uploads.findOne({'meta.post': post._id}).link()   # Get download link
```

###### `find(search)`  [*Isomorphic*]
 - `search` {*String* or *Object*} - `_id` of the file or `Object`

```coffeescript
uploads = new Meteor.Files()

uploads.find({'meta.post': post._id}).cursor   # Current cursor
uploads.find({'meta.post': post._id}).fetch()  # Get cursor as Array (Array of objects)
uploads.find('hdjJDSHW6784kJS').get()          # Get array of fileRef(s)
uploads.find({'meta.post': post._id}).get()    # Get array of fileRef(s)
uploads.find({'meta.post': post._id}).remove() # Remove all files on cursor
```

###### `write(buffer, [options], [callback])`  [*Server*]
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
    window.open uploads.link(fileObj), '_parent'
```