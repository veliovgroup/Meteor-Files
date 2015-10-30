Collections.files = new Meteor.Files 
  debug:            false
  throttle:         256*256*64
  chunkSize:        256*256*4
  storagePath:      'assets/app/uploads/uploadedFiles'
  collectionName:   'uploadedFiles'
  allowClientCode:  false
  onBeforeUpload:   -> if @size <= 100000 * 10 * 128 then true else "Max. file size is 128MB you've tried to upload #{filesize(@size)}"
  downloadCallback: (fileObj) -> 
    if @params?.query.download is 'true'
      Collections.files.collection.update fileObj._id, $inc: 'meta.downloads': 1

if Meteor.isServer
  Collections.files.collection.deny
    insert: -> true
    update: -> true
    remove: -> true

  Collections.files.collection._ensureIndex {'meta.expireAt': 1}, {expireAfterSeconds: 0, background: true}

  Meteor.startup -> Collections.files.remove {}

  Meteor.publish 'latest', (take = 50)->
    check take, Number
    Collections.files.collection.find {}
    ,
      limit: take
      sort: 'meta.created_at': -1
      fields:
        _id: 1
        name: 1
        type: 1
        meta: 1
        isVideo: 1
        isAudio: 1
        isImage: 1

  Meteor.publish 'file', (_id)->
    check _id, String
    Collections.files.collection.find _id

  Meteor.methods
    'filesLenght': -> Collections.files.collection.find({}).count()