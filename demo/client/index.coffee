Template.index.onCreated ->
  timer           = false
  self            = @
  @take           = new ReactiveVar 10
  @latest         = new ReactiveVar new Mongo.Cursor
  @loadMore       = new ReactiveVar false
  @filesLength    = new ReactiveVar 0
  @getFilesLenght = ->
    Meteor.clearTimeout timer if timer
    timer = Meteor.setTimeout ->
      Meteor.call 'filesLenght', _app.userOnly.get(), (error, length) ->
        if error
          console.error error
        else
          self.filesLength.set length
        timer = false
        return
      return
    , 512

  observers =
    added: ->
      self.getFilesLenght()
      return
    removed: ->
      self.filesLength.set self.filesLength.get() - 1
      self.getFilesLenght()
      return

  @autorun ->
    if _app.userOnly.get() and Meteor.userId()
      cursor = Collections.files.find {userId: Meteor.userId()}, sort: 'meta.created_at': -1
    else
      cursor = Collections.files.find {}, sort: 'meta.created_at': -1

    cursor.observeChanges observers
    self.latest.set cursor
    return

  @autorun ->
    _app.subs.subscribe 'latest', self.take.get(), _app.userOnly.get(), ->
      self.loadMore.set false
      return
    return
  return

Template.index.onRendered ->
  window.IS_RENDERED = true
  return

Template.index.helpers
  take:        -> Template.instance().take.get()
  latest:      -> Template.instance().latest.get()
  uploads:     -> _app.uploads.get()
  userOnly:    -> _app.userOnly.get()
  loadMore:    -> Template.instance().loadMore.get()
  filesLength: -> Template.instance().filesLength.get()

Template.index.events
  'click [data-load-more]': (e, template) ->
    template.loadMore.set true
    template.take.set template.take.get() + 10
    return