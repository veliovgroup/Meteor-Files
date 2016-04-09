Collections.files = new Meteor.Files 
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

if Meteor.isServer
  Collections.files.collection.deny
    insert: -> true
    update: -> true
    remove: -> true

  Collections.files.collection._ensureIndex {'meta.expireAt': 1}, {expireAfterSeconds: 0, background: true}
  
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

  Meteor.publish 'file', (_id)->
    check _id, String
    Collections.files.collection.find _id

  Meteor.methods
    'filesLenght': -> Collections.files.collection.find({}).count()