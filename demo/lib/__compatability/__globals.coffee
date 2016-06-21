@Collections = {}
@_app = NOOP: -> return
Package['kadira:flow-router'] = Package['ostrio:flow-router-extra'];

if Meteor.isClient
  ClientStorage.set('blamed', []) if not ClientStorage.has('blamed') or not _.isArray ClientStorage.get 'blamed'
  ClientStorage.set('unlist', true) if not ClientStorage.has('unlist') or not _.isBoolean ClientStorage.get 'unlist'
  ClientStorage.set('secured', false) if not ClientStorage.has('secured') or not _.isBoolean ClientStorage.get 'secured'

  _app.subs            = new SubsManager()
  _app.blamed          = new ReactiveVar ClientStorage.get 'blamed'
  _app.unlist          = new ReactiveVar ClientStorage.get 'unlist'
  _app.secured         = new ReactiveVar ClientStorage.get 'secured'
  _app.uploads         = new ReactiveVar false
  _app.storeTTL        = 86400000
  _app.storeTTLUser    = 432000000
  _app.showProjectInfo = new ReactiveVar false
  
  Meteor.autorun ->
    ClientStorage.set 'blamed', _app.blamed.get()
    return

  Meteor.autorun ->
    ClientStorage.set 'unlist', _app.unlist.get()
    return

  Meteor.autorun ->
    ClientStorage.set 'secured', _app.secured.get()
    return

  ClientStorage.set('uploadTransport', 'ddp') unless ClientStorage.has 'uploadTransport'
  Template.registerHelper 'filesize', (size = 0) -> filesize size
  Template.registerHelper 'extless', (filename = '') ->
    parts = filename.split '.'
    parts.pop() if parts.length > 1
    return parts.join '.'

  Template._layout.helpers
    showProjectInfo: -> _app.showProjectInfo.get()

  Template._layout.events
    'click [data-show-project-info]': (e, template) ->
      e.preventDefault()
      $('.gh-ribbon').toggle()
      _app.showProjectInfo.set !_app.showProjectInfo.get()
      false

  marked.setOptions
    highlight: (code) ->  hljs.highlightAuto(code).value
    renderer: new marked.Renderer()
    gfm: true
    tables: true
    breaks: false
    pedantic: false
    sanitize: true
    smartLists: true
    smartypants: false