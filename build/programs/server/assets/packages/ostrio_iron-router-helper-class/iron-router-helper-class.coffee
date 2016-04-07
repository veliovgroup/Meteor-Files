class IronRouterHelper
  constructor: (@router) ->
    @currentRoute ?= {}
    @currentController ?= {}

    self = @
    @router.onRun ->
      self.currentRoute = @
      self.getController()
      @next()

    @router.onBeforeAction ->
      self.currentRoute = @
      self.getController()
      @next()

  getController: ->
    @currentController = switch
      when @currentRoute.route.findControllerConstructor then @currentRoute.route.findControllerConstructor()
      when @currentRoute.route.findController then @currentRoute.route.findController()
      else null