FlowRouter.globals.push
  title: 'Meteor Files: Upload, Stream and Manage files'

FlowRouter.notFound =
  action: -> 
    @render '_layout', '_404'
    return
  title: '404: Page not found'

new FlowRouterTitle FlowRouter