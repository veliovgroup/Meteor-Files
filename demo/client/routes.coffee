FlowRouter.route '/',
  name: 'index'
  action: (params, queryParams, latest) ->
    @render '_layout', 'index', {latest}
    return
  waitOn: (params) -> [_app.subs.subscribe('latest', 50)]
  whileWaiting: ->
    @render '_layout', '_loading'
    return
  data: -> Collections.files.collection.find {}, sort: 'meta.created_at': -1

FlowRouter.route '/:_id',
  name: 'file'
  title: (params, queryParams, file) -> if file and file.name then "View File: #{file.name}" else '404: Page not found'
  action: (params, queryParams, file) ->
    @render '_layout', 'file', {file}
    return
  waitOn: (params) -> [_app.subs.subscribe('file', params._id)]
  whileWaiting: ->
    @render '_layout', '_loading'
    return
  onNoData: ->
    @render '_layout', '_404'
    return
  data: (params) -> Collections.files.collection.findOne params._id