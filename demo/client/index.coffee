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

  observers =
    added: ->
      self.getFilesLenght()
      return
    removed: ->
      self.getFilesLenght()
      return

  self.data.latest.observe observers
  self.data.userFiles.observe observers

  @autorun ->
    _app.subs.subscribe 'latest', self.take.get()
    return

Template.index.helpers
  take:        -> Template.instance().take.get()
  uploads:     -> _app.uploads.get()
  filesLength: -> Template.instance().filesLength.get()
  shownFiles:  ->
    data = Template.instance().data
    return data.latest.count() + data.userFiles.count()

Template.index.events
  'click [data-load-more]': (e, template) ->
    template.take.set template.take.get() + 10
    return