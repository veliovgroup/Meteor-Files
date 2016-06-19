Template.index.onCreated ->
  self            = @
  @take           = new ReactiveVar 10
  @filesLength    = new ReactiveVar 0
  @getFilesLenght = ->
    Meteor.call 'filesLenght', (error, length) ->
      if error
        console.error error
      else
        self.filesLength.set length
      return
    return
  @getFilesLenght()

  @autorun -> 
    _app.subs.subscribe 'latest', self.take.get()
    return

Template.index.helpers
  take:        -> Template.instance().take.get()
  uploads:     -> _app.uploads.get()
  filesLength: -> Template.instance().filesLength.get()

Template.index.events
  'click #loadMore': (e, template) ->
    template.take.set template.take.get() + 10
    return