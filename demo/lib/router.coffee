Router.configure
  layoutTemplate: '_layout'
  loadingTemplate: '_loading'
  notFoundTemplate: '_404'
  title: 'Meteor Files: Upload, Stream and Manage files'

Router.plugin 'dataNotFound', notFoundTemplate: Router.options.notFoundTemplate