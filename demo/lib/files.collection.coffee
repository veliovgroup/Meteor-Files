# DropBox usage:
# Read: https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage
useDropBox = false
if Meteor.isServer
  if process.env?.DROPBOX
    Meteor.settings.dropbox = JSON.parse(process.env.DROPBOX)?.dropbox

  if Meteor.settings.dropbox and Meteor.settings.dropbox.key and Meteor.settings.dropbox.secret and Meteor.settings.dropbox.token
    useDropBox = true
    Dropbox    = Npm.require 'dropbox'
    fs         = Npm.require 'fs'
    bound      = Meteor.bindEnvironment (callback) -> return callback()
    client     = new (Dropbox.Client)({
      key: Meteor.settings.dropbox.key
      secret: Meteor.settings.dropbox.secret
      token: Meteor.settings.dropbox.token
    })

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
  interceptDownload: (http, fileRef, version) ->
    if useDropBox
      path = fileRef?.versions?[version]?.meta?.pipeFrom
      if path
        # If file is moved to DropBox
        # We will redirect browser to DropBox
        http.response.writeHead 302, 'Location': path
        http.response.end()
        return true
      else
        # While file is not yet uploaded to DropBox
        # We will serve file from FS
        return false
    else
      return false

if Meteor.isServer
  Collections.files.denyClient()
  Collections.files.collection.attachSchema Collections.files.schema

  Collections.files.on 'afterUpload', (fileRef) ->
    if useDropBox
      sendToDB = (fileRef) ->
        _.each fileRef.versions, (vRef, version) ->
          fs.readFile vRef.path, (error, data) -> bound ->
            if error
              console.error error
            else
              # Write file to DropBox
              client.writeFile "#{fileRef._id}-#{version}.#{fileRef.extension}", data, (error, stat) -> bound ->
                if error
                  console.error error
                else
                  # Generate downloadable link
                  client.makeUrl stat.path, {long: true, downloadHack: true}, (error, xml) -> bound ->
                    # Store downloadable in file's meta object
                    if error
                      console.error error
                    else if xml
                      upd = $set: {}
                      upd['$set']["versions.#{version}.meta.pipeFrom"] = xml.url
                      upd['$set']["versions.#{version}.meta.pipePath"] = stat.path
                      Collections.files.collection.update {_id: fileRef._id}, upd, (error) ->
                        if error
                          console.error error
                        return
                    return
                return
            return
          return
        Collections.files.unlink fileRef
        return

    Meteor.setTimeout ->
      if !!~fileRef.type.indexOf 'image'
        _app.createThumbnails Collections.files, fileRef, (fileRef) ->
          if useDropBox
            sendToDB Collections.files.collection.findOne fileRef._id
          return
      else
        if useDropBox
          sendToDB fileRef
      return
    , 1024

  # This line now commented due to Heroku usage
  # Collections.files.collection._ensureIndex {'meta.expireAt': 1}, {expireAfterSeconds: 0, background: true}

  # DropBox usage:
  if useDropBox
    # Intercept File's collection remove method
    # to remove file from DropBox
    _origRemove = Collections.files.remove
    Collections.files.remove = (search) ->
      cursor = @collection.find search
      cursor.forEach (fileRef) ->
        if fileRef?.meta?.pipePath
          client.remove fileRef.meta.pipePath, (error) ->
            if error
              console.error error
            return
      # Call original method
      _origRemove.call @, search

  # Remove all files on server load/reload, useful while testing/development
  # Meteor.startup -> Collections.files.remove {}

  # Remove files along with MongoDB records two minutes before expiration date
  # If we have 'expireAfterSeconds' index on 'meta.expireAt' field,
  # it won't remove files themselves.
  Meteor.setInterval ->
    Collections.files.remove {'meta.expireAt': $lte: new Date((+new Date) + 120000)}, _app.NOOP
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
        isText: 1
        isJSON: 1
        isVideo: 1
        isAudio: 1
        isImage: 1
        extension: 1
        _collectionName: 1
        _downloadRoute: 1

  Meteor.publish 'file', (_id)->
    check _id, String
    Collections.files.collection.find _id

  Meteor.methods
    'filesLenght': -> Collections.files.collection.find({}).count()