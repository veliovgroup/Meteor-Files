@Collections = {}
@_app = 
  subs: new SubsManager()
  storeTTL: 259200000

if Meteor.isClient
  Template.registerHelper 'filesize', (size) -> filesize size
  Template.registerHelper 'extless', (filename) -> filename.split('.')[0]

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