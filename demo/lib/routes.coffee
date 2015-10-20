Router.map ->
  @route 'index',
    fastRender: true
    template: 'index'
    path: '/'
    waitOn: -> _app.subs.subscribe 'latest', 50

  @route 'file',
    fastRender: true
    template: 'file'
    path: '/:_id'
    waitOn: -> _app.subs.subscribe 'file', @params._id
    data: -> Collections.files.collection.findOne @params._id
    title: -> 
      file = @data()
      return "View File: #{file.name}" if @params._id and file