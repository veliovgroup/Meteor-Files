# Uncomment for DropBox usage
# Read: https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage
# if Meteor.isServer
#   Dropbox = Npm.require 'dropbox'
#   fs      = Npm.require 'fs'
#   bound   = Meteor.bindEnvironment (callback) -> return callback()
#   client  = new (Dropbox.Client)({
#     key: 'XXX'
#     secret: 'XXX'
#     token: 'XXXXXXXXX'
#   })

Collections.files = new FilesCollection
  debug:            false
  throttle:         false
  chunkSize:        1024*1024
  storagePath:      'assets/app/uploads/uploadedFiles'
  collectionName:   'uploadedFiles'
  allowClientCode:  false
  onBeforeUpload:   -> if @file.size <= 1024 * 1024 * 128 then true else "Max. file size is 128MB you've tried to upload #{filesize(@file.size)}"
  downloadCallback: (fileObj) -> 
    if @params?.query.download is 'true'
      Collections.files.collection.update fileObj._id, $inc: 'meta.downloads': 1
    return true
  # Uncomment for DropBox usage
  # onAfterUpload:    (fileRef) ->
  #   self = @
  #   fs.readFile fileRef.path, (error, data) -> bound ->
  #     if error
  #       console.error error
  #     else
  #       # Write file to DropBox
  #       client.writeFile "#{fileRef._id}.#{fileRef.extension}", data, (error, stat) -> bound ->
  #         if error
  #           console.error error
  #         else
  #           # Generate downloadable link
  #           client.makeUrl stat.path, {long: true, downloadHack: true}, (error, xml) -> bound ->
  #             # Store downloadable in file's meta object
  #             self.collection.update {_id: fileRef._id}, {$set: {'meta.pipeFrom': xml.url, 'meta.pipePath': stat.path}}, (error) ->
  #               if error
  #                 console.error error
  #               else
  #                 # Remove file from FS
  #                 self.unlink fileRef
  # interceptDownload: (http, fileRef) ->
  #   path = fileRef?.meta?.pipeFrom
  #   if path
  #     # If file is moved to DropBox
  #     # We will redirect browser to DropBox
  #     http.response.writeHead 302, 'Location': path
  #     http.response.end()
  #     return true
  #   else
  #     # While file is not uploaded to DropBox
  #     # We will serve file from FS
  #     return false

if Meteor.isServer
  Collections.files.denyClient()
  Collections.files.collection.attachSchema Collections.files.schema
  Collections.files.collection._ensureIndex {'meta.expireAt': 1}, {expireAfterSeconds: 0, background: true}

  # Uncomment for DropBox usage
  # Intercept File's collection remove method
  # to remove file from DropBox
  # _origRemove = Collections.files.remove
  # Collections.files.remove = (search) ->
  #   cursor = @collection.find search
  #   cursor.forEach (fileRef) ->
  #     if fileRef?.meta?.pipePath
  #       client.remove fileRef.meta.pipePath, (error) ->
  #         if error
  #           console.error error
  #   # Call original method
  #   _origRemove.call @, search

  # Remove all files on server load/reload, useful while testing/development
  # Meteor.startup -> Collections.files.remove {}

  # Remove files along with MongoDB records two minutes before expiration date
  # Although we have 'expireAfterSeconds' index on 'meta.expireAt' field,
  # it won't remove files themselves.
  Meteor.setInterval ->
    Collections.files.remove 'meta.expireAt': $lte: new Date((+new Date) + 120000)
  ,
    120000

  Meteor.publish 'latest', (take = 50)->
    check take, Number
    Collections.files.collection.find {}
    ,
      limit: take
      sort: 'meta.created_at': -1
      fields:
        _id: 1
        name: 1
        size: 1
        meta: 1
        isVideo: 1
        isAudio: 1
        isImage: 1
        isText: 1
        extension: 1

  Meteor.publish 'file', (_id)->
    check _id, String
    Collections.files.collection.find _id

  Meteor.methods
    'filesLenght': -> Collections.files.collection.find({}).count()