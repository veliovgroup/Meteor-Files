@Collections = {}
@_app = NOOP: -> return

if Meteor.isClient
  ClientStorage.set('blamed', []) if not ClientStorage.has('blamed') or not _.isArray ClientStorage.get('blamed')
  _app.subs         = new SubsManager()
  _app.blamed       = new ReactiveVar ClientStorage.get 'blamed'
  _app.uploads      = new ReactiveVar false
  _app.storeTTL     = 86400000
  _app.storeTTLUser = 432000000
  
  Meteor.autorun ->
    ClientStorage.set 'blamed', _app.blamed.get()
    return

  ClientStorage.set('myFiles', []) if not ClientStorage.has('myFiles') or not _.isArray ClientStorage.get('myFiles')
  _app.myFiles = new ReactiveVar ClientStorage.get 'myFiles'
  Meteor.autorun ->
    ClientStorage.set 'myFiles', _app.myFiles.get()
    return

  ClientStorage.set('uploadTransport', 'ddp') unless ClientStorage.has 'uploadTransport'
  Template.registerHelper 'filesize', (size = 0) -> filesize size
  Template.registerHelper 'extless', (filename = '') ->
    parts = filename.split '.'
    parts.pop() if parts.length > 1
    return parts.join '.'

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