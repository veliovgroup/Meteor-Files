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
  allowClientCode:  true
  protected: (fileObj) ->
    if not fileObj.meta?.secured
      return true
    else if fileObj.meta?.secured and @userId is fileObj.userId
      return true
    return false
  onBeforeRemove: (cursor) ->
    file = cursor.get()?[0]
    return true if file and file?.userId is @userId
    return false
  onBeforeUpload: ->
    return if @file.size <= 1024 * 1024 * 128 then true else "Max. file size is 128MB you've tried to upload #{filesize(@file.size)}"
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
      makeUrl = (stat, fileRef, version, triesUrl = 0) ->
        client.makeUrl stat.path, {long: true, downloadHack: true}, (error, xml) -> bound ->
          # Store downloadable in file's meta object
          if error
            if triesUrl < 10
              Meteor.setTimeout ->
                makeUrl stat, fileRef, version, ++triesUrl
              , 2048
            else
              console.error error, {triesUrl}
          else if xml
            upd = $set: {}
            upd['$set']["versions.#{version}.meta.pipeFrom"] = xml.url
            upd['$set']["versions.#{version}.meta.pipePath"] = stat.path
            Collections.files.collection.update {_id: fileRef._id}, upd, (error) ->
              if error
                console.error error
              else
                Collections.files.unlink Collections.files.collection.findOne(fileRef._id), version
              return
          else
            if triesUrl < 10
              Meteor.setTimeout ->
                makeUrl stat, fileRef, version, ++triesUrl
              , 2048
            else
              console.error "client.makeUrl doesn't returns xml", {triesUrl}
          return
        return

      writeToDB = (fileRef, version, data, triesSend = 0) ->
        client.writeFile "#{fileRef._id}-#{version}.#{fileRef.extension}", data, (error, stat) -> bound ->
          if error
            if triesSend < 10
              Meteor.setTimeout ->
                writeToDB fileRef, version, data, ++triesSend
              , 2048
            else
              console.error error, {triesSend}
          else
            # Generate downloadable link
            makeUrl stat, fileRef, version
          return
        return

      readFile = (fileRef, vRef, version, triesRead = 0) ->
        fs.readFile vRef.path, (error, data) -> bound ->
          if error
            if triesRead < 10
              readFile fileRef, vRef, version, ++triesRead
            else
              console.error error
          else
            # Write file to DropBox
            writeToDB fileRef, version, data
          return
        return

      sendToDB = (fileRef) ->
        _.each fileRef.versions, (vRef, version) ->
          readFile fileRef, vRef, version
          return
        return

    if !!~['png', 'jpg', 'jpeg'].indexOf (fileRef.extension or '').toLowerCase()
      _app.createThumbnails Collections.files, fileRef, (fileRef) ->
        if useDropBox
          sendToDB Collections.files.collection.findOne fileRef._id
        return
    else
      if useDropBox
        sendToDB fileRef
    return

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
    return
  ,
    120000

  Meteor.publish 'latest', (take = 10)->
    check take, Number
    return Collections.files.collection.find {
      $or: [{
        'meta.unlisted': false
        'meta.secured': false
        'meta.blamed': $lt: 3
      },{
        'meta.blamed': $exists: false
        'meta.unlisted': $exists: false
        'meta.secured': $exists: false
      },{
        'meta.blamed': $lt: 3
        'meta.unlisted': $exists: false
        'meta.secured': $exists: false
      },{
        'meta.unlisted': true
        'meta.secured': true
        userId: @userId
      },{
        'meta.unlisted': true
        userId: @userId
      }]
    }, {
      limit: take
      sort: 'meta.created_at': -1
      fields:
        _id: 1
        name: 1
        size: 1
        meta: 1
        isPDF: 1
        isText: 1
        isJSON: 1
        isVideo: 1
        isAudio: 1
        isImage: 1
        userId: 1
        'versions.thumbnail40.path': 1
        extension: 1
        _collectionName: 1
        _downloadRoute: 1
    }

  Meteor.publish 'file', (_id)->
    check _id, String
    return Collections.files.collection.find {
        $or: [{
          _id: _id
          'meta.secured': false
        },{
          _id: _id
          'meta.secured': $exists: false
        },{
          _id: _id
          'meta.secured': true
          userId: @userId
        }]
      }, {
        fields:
          _id: 1
          name: 1
          size: 1
          type: 1
          meta: 1
          isPDF: 1
          isText: 1
          isJSON: 1
          isVideo: 1
          isAudio: 1
          isImage: 1
          extension: 1
          _collectionName: 1
          _downloadRoute: 1
      }

  Meteor.methods
    filesLenght: ->
      return Collections.files.collection.find({
        $or: [{
          'meta.unlisted': false
          'meta.secured': false
          'meta.blamed': $lt: 3
        },{
          'meta.blamed': $exists: false
          'meta.unlisted': $exists: false
          'meta.secured': $exists: false
        },{
          'meta.blamed': $lt: 3
          'meta.unlisted': $exists: false
          'meta.secured': $exists: false
        },{
          'meta.unlisted': true
          'meta.secured': true
          userId: @userId
        },{
          'meta.unlisted': true
          userId: @userId
        }]
      }).count()

    unblame: (_id) ->
      check _id, String
      Collections.files.collection.update {_id}, {$inc: 'meta.blamed': -1}, _app.NOOP
      return true

    blame: (_id) ->
      check _id, String
      Collections.files.collection.update {_id}, {$inc: 'meta.blamed': 1}, _app.NOOP
      return true

    changeAccess: (_id) ->
      check _id, String
      if Meteor.userId()
        file = Collections.files.collection.findOne {_id, userId: Meteor.userId()}
        if file
          Collections.files.collection.update _id, {$set: 'meta.unlisted': if file.meta.unlisted then false else true}
          return true
      throw new Meteor.Error 401, 'Access denied!'

    changePrivacy: (_id) ->
      check _id, String
      if Meteor.userId()
        file = Collections.files.collection.findOne {_id, userId: Meteor.userId()}
        if file
          Collections.files.collection.update _id, {$set: 'meta.unlisted': true, 'meta.secured': if file.meta.secured then false else true}
          return true
      throw new Meteor.Error 401, 'Access denied!'