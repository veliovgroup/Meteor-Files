@Collections = {}
@_app = 
  subs: new SubsManager()
  storeTTL: 259200000

if Meteor.isClient
  Template.registerHelper 'filesize', (size) -> filesize size
  Template.registerHelper 'extless', (filename) -> filename.split('.')[0]