Meteor.startup ->
  Template.index.onCreated ->
    @take           = new ReactiveVar 50
    @error          = new ReactiveVar false
    @filesLength    = new ReactiveVar 0
    @uploadInstance = new ReactiveVar false
    @getFilesLenght = =>
      Meteor.call 'filesLenght', (error, length) =>
        if error
          console.error error
        else
          @filesLength.set length
    @getFilesLenght()

    @autorun => Meteor.subscribe 'latest', @take.get()

  Template.index.helpers
    take:          -> Template.instance().take.get()
    error:         -> Template.instance().error.get()
    latest:        -> Collections.files.collection.find {}, sort: 'meta.created_at': -1
    removedIn:     -> moment(@meta.expireAt).fromNow()
    filesLength:   -> Template.instance().filesLength.get()
    uploadInstance:-> Template.instance().uploadInstance.get()


  Template.index.events
    'click #pause':    -> @pause()
    'click #continue': -> @continue()
    'click #abort':    -> @abort()
    'click #loadMore': (e, template) -> template.take.set template.take.get() + 50
    'change input[name="userfile"]': (e, template) -> template.$('form#uploadFile').submit()
    'submit form#uploadFile': (e, template) ->
      e.preventDefault()
      template.error.set false
      files = e.currentTarget.userfile.files

      unless files.length
        template.error.set "Please select a file to upload"
        return false

      done = false
      created_at = +new Date
      template.uploadInstance.set Collections.files.insert 
        file: files[0]
        meta: {expireAt: new Date(created_at + _app.storeTTL), created_at, downloads: 0}
        onUploaded: (error, fileObj) ->
          done = true
          unless error
            Router.go 'file', _id: fileObj._id
          else
            template.error.set error.reason
          e.currentTarget.userfile.value = ''
          template.getFilesLenght()
          template.uploadInstance.set false
        onAbort: ->
          done = true
          template.uploadInstance.set false
          e.currentTarget.userfile.value = ''
        onBeforeUpload: -> if @size <= 100000 * 10 * 128 then true else "Max. file size is 128MB you've tried to upload #{filesize(@size)}"
        streams: 8
      false

