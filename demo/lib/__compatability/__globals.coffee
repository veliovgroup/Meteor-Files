@Collections = {}
@_app = 
  subs: new SubsManager()
  storeTTL: 259200000

if Meteor.isClient
  Template.registerHelper 'filesize', (size) -> filesize size

if Meteor.isServer
  Meteor.setInterval ->
    Collections.files.remove 'meta.expireAt': $lte: new Date((+new Date) + 60000 * 2)
  ,
    60000