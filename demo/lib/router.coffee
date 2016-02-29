Router.onAfterAction -> 
  Meteor.isReadyForSpiderable = true if @ready()

Router.configure
  layoutTemplate: '_layout'
  loadingTemplate: '_loading'
  notFoundTemplate: '_404'
  title: 'Temporary free file storage'

Router.plugin 'dataNotFound', notFoundTemplate: Router.options.notFoundTemplate