(function () {

/* Imports */
var _ = Package.underscore._;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var EJSON = Package.ejson.EJSON;
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Iron = Package['iron:core'].Iron;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var CurrentOptions, HTTP_METHODS, RouteController, Route, Router, route;

(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/current_options.js                                                //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/**
 * Allows for dynamic scoping of options variables. Primarily intended to be
 * used in the RouteController.prototype.lookupOption method.
 */
CurrentOptions = new Meteor.EnvironmentVariable;

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/http_methods.js                                                   //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch'
];

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/route_controller.js                                               //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var Controller = Iron.Controller;
var Url = Iron.Url;
var MiddlewareStack = Iron.MiddlewareStack;
var assert = Iron.utils.assert;

/*****************************************************************************/
/* RouteController */
/*****************************************************************************/
RouteController = Controller.extend({
  constructor: function (options) {
    RouteController.__super__.constructor.apply(this, arguments);
    options = options || {};
    this.options = options;
    this._onStopCallbacks = [];
    this.route = options.route;
    this.params = [];

    // Sometimes the data property can be defined on route options,
    // or even on the global router config. And people will expect the
    // data function to be available on the controller instance if it
    // is defined anywhere in the chain. This ensure that if we have
    // a data function somewhere in the chain, you can call this.data().
    var data = this.lookupOption('data');

    if (typeof data === 'function')
      this.data = _.bind(data, this);
    else if (typeof data !== 'undefined')
      this.data = function () { return data; };

    this.init(options);
  }
});

/**
 * Returns an option value following an "options chain" which is this path:
 *
 *   this.options
 *   this (which includes the proto chain)
 *   this.route.options
 *   dynamic variable
 *   this.router.options
 */
RouteController.prototype.lookupOption = function (key) {
  // this.route.options
  // NOTE: we've debated whether route options should come before controller but
  // Tom has convinced me that it's easier for people to think about overriding
  // controller stuff at the route option level. However, this has the possibly
  // counterintuitive effect that if you define this.someprop = true on the
  // controller instance, and you have someprop defined as an option on your
  // Route, the route option will take precedence.
  if (this.route && this.route.options && _.has(this.route.options, key))
    return this.route.options[key];

  // this.options
  if (_.has(this.options, key))
    return this.options[key];

  // "this" object or its proto chain
  if (typeof this[key] !== 'undefined')
    return this[key];

  // see if we have the CurrentOptions dynamic variable set.
  var opts = CurrentOptions.get();
  if (opts && _.has(opts, key))
    return opts[key];

  // this.router.options
  if (this.router && this.router.options && _.has(this.router.options, key))
    return this.router.options[key];
};

RouteController.prototype.configureFromUrl = function (url, context, options) {
  assert(typeof url === 'string', 'url must be a string');
  context = context || {};
  this.request = context.request || {};
  this.response = context.response || {};
  this.url = context.url || url;
  this.originalUrl = context.originalUrl || url;
  this.method = this.request.method;
  if (this.route) {
    // pass options to that we can set reactive: false
    this.setParams(this.route.params(url), options);
  }
};

/**
 * Returns an array of hook functions for the given hook names. Hooks are
 * collected in this order:
 *
 * router global hooks
 * route option hooks
 * prototype of the controller
 * this object for the controller
 *
 * For example, this.collectHooks('onBeforeAction', 'before')
 * will return an array of hook functions where the key is either onBeforeAction
 * or before.
 *
 * Hook values can also be strings in which case they are looked up in the
 * Iron.Router.hooks object.
 *
 * TODO: Add an options last argument which can specify to only collect hooks
 * for a particular environment (client, server or both).
 */
RouteController.prototype._collectHooks = function (/* hook1, alias1, ... */) {
  var self = this;
  var hookNames = _.toArray(arguments);

  var getHookValues = function (value) {
    if (!value)
      return [];
    var lookupHook = self.router.lookupHook;
    var hooks = _.isArray(value) ? value : [value];
    return _.map(hooks, function (h) { return lookupHook(h); });
  };

  var collectInheritedHooks = function (ctor, hookName) {
    var hooks = [];

    if (ctor.__super__)
      hooks = hooks.concat(collectInheritedHooks(ctor.__super__.constructor, hookName));

    return _.has(ctor.prototype, hookName) ?
      hooks.concat(getHookValues(ctor.prototype[hookName])) : hooks;
  };

  var eachHook = function (cb) {
    for (var i = 0; i < hookNames.length; i++) {
      cb(hookNames[i]);
    }
  };

  var routerHooks = [];
  eachHook(function (hook) {
    var name = self.route && self.route.getName();
    var hooks = self.router.getHooks(hook, name);
    routerHooks = routerHooks.concat(hooks);
  });

  var protoHooks = [];
  eachHook(function (hook) {
    var hooks = collectInheritedHooks(self.constructor, hook);
    protoHooks = protoHooks.concat(hooks);
  });

  var thisHooks = [];
  eachHook(function (hook) {
    if (_.has(self, hook)) {
      var hooks = getHookValues(self[hook]);
      thisHooks = thisHooks.concat(hooks);
    }
  });

  var routeHooks = [];
  if (self.route) {
    eachHook(function (hook) {
      var hooks = getHookValues(self.route.options[hook]);
      routeHooks = routeHooks.concat(hooks);
    });
  }

  var allHooks = routerHooks
    .concat(routeHooks)
    .concat(protoHooks)
    .concat(thisHooks);

  return allHooks;
};

/**
 * Runs each hook and returns the number of hooks that were run.
 */
RouteController.prototype.runHooks = function (/* hook, alias1, ...*/ ) {
  var hooks = this._collectHooks.apply(this, arguments);
  for (var i = 0, l = hooks.length; i < l; i++) {
    var h = hooks[i];
    h.call(this);
  }
  return hooks.length;
};

RouteController.prototype.getParams = function () {
  return this.params;
};

RouteController.prototype.setParams = function (value) {
  this.params = value;
  return this;
};

Iron.RouteController = RouteController;

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/route_controller_server.js                                        //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var Fiber = Npm.require('fibers');
var Controller = Iron.Controller;
var Url = Iron.Url;
var MiddlewareStack = Iron.MiddlewareStack;

/*****************************************************************************/
/* RouteController */
/*****************************************************************************/

/**
 * Server specific initialization.
 */
RouteController.prototype.init = function (options) {};

/**
 * Let this controller run a dispatch process. This function will be called
 * from the router. That way, any state associated with the dispatch can go on
 * the controller instance. Note: no result returned from dispatch because its
 * run inside its own fiber. Might at some point move the fiber stuff to a
 * higher layer.
 */
RouteController.prototype.dispatch = function (stack, url, done) {
  var self = this;
  Fiber(function () {
    stack.dispatch(url, self, done);
  }).run();
};

/**
 * Run a route on the server. When the router runs its middleware stack, it
 * can run regular middleware functions or it can run a route. There should
 * only one route object per path as where there may be many middleware
 * functions.
 *
 * For example:
 *
 *   "/some/path" => [middleware1, middleware2, route, middleware3]
 *
 * When a route is dispatched, it tells the controller to _runRoute so that
 * the controller can control the process. At this point we should already be
 * in a dispatch so a computation should already exist.
 */
RouteController.prototype._runRoute = function (route, url, done) {
  var self = this;
  var stack = new MiddlewareStack;

  var onRunHooks = this._collectHooks('onRun', 'load');
  stack = stack.append(onRunHooks, {where: 'server'});

  var beforeHooks = this._collectHooks('onBeforeAction', 'before');
  stack.append(beforeHooks, {where: 'server'});

  // make sure the action stack has at least one handler on it that defaults
  // to the 'action' method
  if (route._actionStack.length === 0) {
    route._actionStack.push(route._path, 'action', route.options);
  }

  stack = stack.concat(route._actionStack);
  stack.dispatch(url, this, done);

  // run the after hooks.
  this.next = function () {};
  this.runHooks('onAfterAction', 'after');
};

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/route.js                                                          //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
var Url = Iron.Url;
var MiddlewareStack = Iron.MiddlewareStack;
var assert = Iron.utils.assert;

/*****************************************************************************/
/* Both */
/*****************************************************************************/
Route = function (path, fn, options) {
  var route = function (req, res, next) {
    var controller = this;
    controller.request = req;
    controller.response = res;
    route.dispatch(req.url, controller, next);
  }

  if (typeof fn === 'object') {
    options = fn;
    fn = options.action;
  }

  options = options || {};

  if (typeof path === 'string' && path.charAt(0) !== '/') {
    path = options.path ? options.path : '/' + path
  }

  // extend the route function with properties from this instance and its
  // prototype.
  _.extend(route, this.constructor.prototype);

  // always good to have options
  options = route.options = options || {};

  // the main action function as well as any HTTP VERB action functions will go
  // onto this stack.
  route._actionStack = new MiddlewareStack;

  // any before hooks will go onto this stack to make sure they get executed
  // before the action stack.
  route._beforeStack = new MiddlewareStack;
  route._beforeStack.append(route.options.onBeforeAction);
  route._beforeStack.append(route.options.before);

  // after hooks get run after the action stack
  route._afterStack = new MiddlewareStack;
  route._afterStack.append(route.options.onAfterAction);
  route._afterStack.append(route.options.after);


  // track which methods this route uses
  route._methods = {};

  if (typeof fn === 'string') {
    route._actionStack.push(path, _.extend(options, {
      template: fn
    }));
  } else if (typeof fn === 'function' || typeof fn === 'object') {
    route._actionStack.push(path, fn, options);
  }

  route._path = path;
  return route;
};

/**
 * The name of the route is actually stored on the handler since a route is a
 * function that has an unassignable "name" property.
 */
Route.prototype.getName = function () {
  return this.handler && this.handler.name;
};

/**
 * Returns an appropriate RouteController constructor the this Route.
 *
 * There are three possibilities:
 *
 *  1. controller option provided as a string on the route
 *  2. a controller in the global namespace with the converted name of the route
 *  3. a default RouteController
 *
 */
Route.prototype.findControllerConstructor = function () {
  var self = this;

  var resolve = function (name, opts) {
    opts = opts || {};
    var C = Iron.utils.resolve(name);
    if (!C || !RouteController.prototype.isPrototypeOf(C.prototype)) {
      if (opts.supressErrors !== true)
        throw new Error("RouteController '" + name + "' is not defined.");
      else
        return undefined;
    } else {
      return C;
    }
  };

  var convert = function (name) {
    return self.router.toControllerName(name);
  };

  var result;
  var name = this.getName();

  // the controller was set directly
  if (typeof this.options.controller === 'function')
    return this.options.controller;

  // was the controller specified precisely by name? then resolve to an actual
  // javascript constructor value
  else if (typeof this.options.controller === 'string')
    return resolve(this.options.controller);

  // is there a default route controller configured?
  else if (this.router && this.router.options.controller) {
    if (typeof this.router.options.controller === 'function')
      return this.router.options.controller;

    else if (typeof this.router.options.controller === 'string')
      return resolve(this.router.options.controller);
  }

  // otherwise do we have a name? try to convert the name to a controller name
  // and resolve it to a value
  else if (name && (result = resolve(convert(name), {supressErrors: true})))
    return result;

  // otherwise just use an anonymous route controller
  else
    return RouteController;
};


/**
 * Create a new controller for the route.
 */
Route.prototype.createController = function (options) {
  options = options || {};
  var C = this.findControllerConstructor();
  options.route = this;
  var instance = new C(options);
  return instance;
};

Route.prototype.setControllerParams = function (controller, url) {
};

/**
 * Dispatch into the route's middleware stack.
 */
Route.prototype.dispatch = function (url, context, done) {
  // call runRoute on the controller which will behave similarly to the previous
  // version of IR.
  assert(context._runRoute, "context doesn't have a _runRoute method");
  return context._runRoute(this, url, done);
};

/**
 * Returns a relative path for the route.
 */
Route.prototype.path = function (params, options) {
  return this.handler.resolve(params, options);
};

/**
 * Return a fully qualified url for the route, given a set of parmeters and
 * options like hash and query.
 */
Route.prototype.url = function (params, options) {
  var path = this.path(params, options);
  var host = (options && options.host) || Meteor.absoluteUrl();

  if (host.charAt(host.length-1) === '/');
    host = host.slice(0, host.length-1);
  return host + path;
};

/**
 * Return a params object for the route given a path.
 */
Route.prototype.params = function (path) {
  return this.handler.params(path);
};

/**
 * Add convenience methods for each HTTP verb.
 *
 * Example:
 *  var route = router.route('/item')
 *    .get(function () { })
 *    .post(function () { })
 *    .put(function () { })
 */
_.each(HTTP_METHODS, function (method) {
  Route.prototype[method] = function (fn) {
    // track the method being used for OPTIONS requests.
    this._methods[method] = true;

    this._actionStack.push(this._path, fn, {
      // give each method a unique name so it doesn't clash with the route's
      // name in the action stack
      name: this.getName() + '_' + method.toLowerCase(),
      method: method,

      // for now just make the handler where the same as the route, presumably a
      // server route.
      where: this.handler.where,
      mount: false
    });

    return this;
  };
});

Iron.Route = Route;

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/router.js                                                         //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var MiddlewareStack = Iron.MiddlewareStack;
var Url = Iron.Url;
var Layout = Iron.Layout;
var warn = Iron.utils.warn;
var assert = Iron.utils.assert;

Router = function (options) {
  // keep the same api throughout which is:
  // fn(url, context, done);
  function router (req, res, next) {
    //XXX this assumes no other routers on the parent stack which we should probably fix
    router.dispatch(req.url, {
      request: req,
      response: res
    }, next);
  }

  // the main router stack
  router._stack = new MiddlewareStack;

  // for storing global hooks like before, after, etc.
  router._globalHooks = {};

  // backward compat and quicker lookup of Route handlers vs. regular function
  // handlers.
  router.routes = [];

  // to make sure we don't have more than one route per path
  router.routes._byPath = {};

  // always good to have options
  this.configure.call(router, options);

  // add proto properties to the router function
  _.extend(router, this.constructor.prototype);

  // let client and server side routing doing different things here
  this.init.call(router, options);

  Meteor.startup(function () {
    Meteor.defer(function () {
      if (router.options.autoStart !== false)
        router.start();
    });
  });

  return router;
};

Router.prototype.init = function (options) {};

Router.prototype.configure = function (options) {
  var self = this;

  options = options || {};

  var toArray = function (value) {
    if (!value)
      return [];

    if (_.isArray(value))
      return value;

    return [value];
  };

  // e.g. before: fn OR before: [fn1, fn2]
  _.each(Iron.Router.HOOK_TYPES, function eachHookType (type) {
    if (options[type]) {
      _.each(toArray(options[type]), function eachHook (hook) {
        self.addHook(type, hook);
      });

      delete options[type];
    }
  });

  this.options = this.options || {};
  _.extend(this.options, options);

  return this;
};

/**
 * Just to support legacy calling. Doesn't really serve much purpose.
 */
Router.prototype.map = function (fn) {
  return fn.call(this);
};

/*
 * XXX removing for now until this is thought about more carefully.
Router.prototype.use = function (path, fn, opts) {
  if (typeof path === 'function') {
    opts = fn || {};
    opts.mount = true;
    opts.where = opts.where || 'server';
    this._stack.push(path, opts);
  } else {
    opts = opts || {};
    opts.mount = true;
    opts.where = opts.where || 'server';
    this._stack.push(path, fn, opts);
  }

  return this;
};
*/

//XXX seems like we could put a params method on the route directly and make it reactive
Router.prototype.route = function (path, fn, opts) {
  var typeOf = function (val) { return Object.prototype.toString.call(val); };
  assert(typeOf(path) === '[object String]' || typeOf(path) === '[object RegExp]', "Router.route requires a path that is a string or regular expression.");

  if (typeof fn === 'object') {
    opts = fn;
    fn = opts.action;
  }

  var route = new Route(path, fn, opts);

  opts = opts || {};

  // don't mount the route
  opts.mount = false;

  // stack expects a function which is exactly what a new Route returns!
  var handler = this._stack.push(path, route, opts);

  handler.route = route;
  route.handler = handler;
  route.router = this;

  assert(!this.routes._byPath[handler.path],
    "A route for the path " + JSON.stringify(handler.path) + " already exists by the name of " + JSON.stringify(handler.name) + ".");
  this.routes._byPath[handler.path] = route;

  this.routes.push(route);

  if (typeof handler.name === 'string')
    this.routes[handler.name] = route;

  return route;
};

/**
 * Find the first route for the given url and options.
 */
Router.prototype.findFirstRoute = function (url) {
  var isMatch;
  var routeHandler;
  for (var i = 0; i < this.routes.length; i++) {
    route = this.routes[i];

    // only matches if the url matches AND the
    // current environment matches.
    isMatch = route.handler.test(url, {
      where: Meteor.isServer ? 'server' : 'client'
    });

    if (isMatch)
      return route;
  }

  return null;
};

Router.prototype.path = function (routeName, params, options) {
  var route = this.routes[routeName];
  warn(route, "You called Router.path for a route named " + JSON.stringify(routeName) + " but that route doesn't seem to exist. Are you sure you created it?");
  return route && route.path(params, options);
};

Router.prototype.url = function (routeName, params, options) {
  var route = this.routes[routeName];
  warn(route, "You called Router.url for a route named " + JSON.stringify(routeName) + " but that route doesn't seem to exist. Are you sure you created it?");
  return route && route.url(params, options);
};

/**
 * Create a new controller for a dispatch.
 */
Router.prototype.createController = function (url, context) {
  // see if there's a route for this url and environment
  // it's possible that we find a route but it's a client
  // route so we don't instantiate its controller and instead
  // use an anonymous controller to run the route.
  var route = this.findFirstRoute(url);
  var controller;

  context = context || {};

  if (route)
    // let the route decide what controller to use
    controller = route.createController({layout: this._layout});
  else
    // create an anonymous controller
    controller = new RouteController({layout: this._layout});

  controller.router = this;
  controller.configureFromUrl(url, context, {reactive: false});
  return controller;
};

Router.prototype.setTemplateNameConverter = function (fn) {
  this._templateNameConverter = fn;
  return this;
};

Router.prototype.setControllerNameConverter = function (fn) {
  this._controllerNameConverter = fn;
  return this;
};

Router.prototype.toTemplateName = function (str) {
  if (this._templateNameConverter)
    return this._templateNameConverter(str);
  else
    return Iron.utils.classCase(str);
};

Router.prototype.toControllerName = function (str) {
  if (this._controllerNameConverter)
    return this._controllerNameConverter(str);
  else
    return Iron.utils.classCase(str) + 'Controller';
};

/**
 *
 * Add a hook to all routes. The hooks will apply to all routes,
 * unless you name routes to include or exclude via `only` and `except` options
 *
 * @param {String} [type] one of 'load', 'unload', 'before' or 'after'
 * @param {Object} [options] Options to controll the hooks [optional]
 * @param {Function} [hook] Callback to run
 * @return {IronRouter}
 * @api public
 *
 */

Router.prototype.addHook = function(type, hook, options) {
  var self = this;

  options = options || {};

  var toArray = function (input) {
    if (!input)
      return [];
    else if (_.isArray(input))
      return input;
    else
      return [input];
  }

  if (options.only)
    options.only = toArray(options.only);
  if (options.except)
    options.except = toArray(options.except);

  var hooks = this._globalHooks[type] = this._globalHooks[type] || [];

  var hookWithOptions = function () {
    var thisArg = this;
    var args = arguments;
    // this allows us to bind hooks to options that get looked up when you call
    // this.lookupOption from within the hook. And it looks better to keep
    // plugin/hook related options close to their definitions instead of
    // Router.configure. But we use a dynamic variable so we don't have to
    // pass the options explicitly as an argument and plugin creators can
    // just use this.lookupOption which will follow the proper lookup chain from
    // "this", local options, dynamic variable options, route, router, etc.
    return CurrentOptions.withValue(options, function () {
      return self.lookupHook(hook).apply(thisArg, args);
    });
  };

  hooks.push({options: options, hook: hookWithOptions});
  return this;
};

/**
 * If the argument is a function return it directly. If it's a string, see if
 * there is a function in the Iron.Router.hooks namespace. Throw an error if we
 * can't find the hook.
 */
Router.prototype.lookupHook = function (nameOrFn) {
  var fn = nameOrFn;

  // if we already have a func just return it
  if (_.isFunction(fn))
    return fn;

  // look up one of the out-of-box hooks like
  // 'loaded or 'dataNotFound' if the nameOrFn is a
  // string
  if (_.isString(fn)) {
    if (_.isFunction(Iron.Router.hooks[fn]))
      return Iron.Router.hooks[fn];
  }

  // we couldn't find it so throw an error
  throw new Error("No hook found named: " + nameOrFn);
};

/**
 *
 * Fetch the list of global hooks that apply to the given route name.
 * Hooks are defined by the .addHook() function above.
 *
 * @param {String} [type] one of IronRouter.HOOK_TYPES
 * @param {String} [name] the name of the route we are interested in
 * @return {[Function]} [hooks] an array of hooks to run
 * @api public
 *
 */

Router.prototype.getHooks = function(type, name) {
  var self = this;
  var hooks = [];

  _.each(this._globalHooks[type], function(hook) {
    var options = hook.options;

    if (options.except && _.include(options.except, name))
      return [];

    if (options.only && ! _.include(options.only, name))
      return [];

    hooks.push(hook.hook);
  });

  return hooks;
};

Router.HOOK_TYPES = [
  'onRun',
  'onRerun',
  'onBeforeAction',
  'onAfterAction',
  'onStop',

  // not technically a hook but we'll use it
  // in a similar way. This will cause waitOn
  // to be added as a method to the Router and then
  // it can be selectively applied to specific routes
  'waitOn',
  'subscriptions',

  // legacy hook types but we'll let them slide
  'load', // onRun
  'before', // onBeforeAction
  'after', // onAfterAction
  'unload' // onStop
];

/**
 * A namespace for hooks keyed by name.
 */
Router.hooks = {};


/**
 * A namespace for plugin functions keyed by name.
 */
Router.plugins = {};

/**
 * Auto add helper mtehods for all the hooks.
 */

_.each(Router.HOOK_TYPES, function (type) {
  Router.prototype[type] = function (hook, options) {
    this.addHook(type, hook, options);
  };
});

/**
 * Add a plugin to the router instance.
 */
Router.prototype.plugin = function (nameOrFn, options) {
  var func;

  if (typeof nameOrFn === 'function')
    func = nameOrFn;
  else if (typeof nameOrFn === 'string')
    func = Iron.Router.plugins[nameOrFn];

  if (!func)
    throw new Error("No plugin found named " + JSON.stringify(nameOrFn));

  // fn(router, options)
  func.call(this, this, options);

  return this;
};

Iron.Router = Router;

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/hooks.js                                                          //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
if (typeof Template !== 'undefined') {
  /**
   * The default anonymous loading template.
   */
  var defaultLoadingTemplate = new Template('DefaultLoadingTemplate', function () {
    return 'Loading...';
  });

  /**
   * The default anonymous data not found template.
   */
  var defaultDataNotFoundTemplate = new Template('DefaultDataNotFoundTemplate', function () {
    return 'Data not found...';
  });
}

/**
 * Automatically render a loading template into the main region if the
 * controller is not ready (i.e. this.ready() is false). If no loadingTemplate
 * is defined use some default text.
 */

Router.hooks.loading = function () {
  // if we're ready just pass through
  if (this.ready()) {
    this.next();
    return;
  }

  var template = this.lookupOption('loadingTemplate');
  this.render(template || defaultLoadingTemplate);
  this.renderRegions();
};

/**
 * Render a "data not found" template if a global data function returns a falsey
 * value
 */
Router.hooks.dataNotFound = function () {
  if (!this.ready()) {
    this.next();
    return;
  }

  var data = this.lookupOption('data');
  var dataValue;
  var template = this.lookupOption('notFoundTemplate');

  if (typeof data === 'function') {
    if (!(dataValue = data.call(this))) {
      this.render(template || defaultDataNotFoundTemplate);
      this.renderRegions();
      return;
    }
  }

  // okay never mind just pass along now
  this.next();
};

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/helpers.js                                                        //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var warn = Iron.utils.warn;
var DynamicTemplate = Iron.DynamicTemplate;
var debug = Iron.utils.debug('iron:router <helpers>');

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/

/**
 * Render the Router to a specific location on the page instead of the
 * document.body. 
 */
UI.registerHelper('Router', new Blaze.Template('Router', function () {
  return Router.createView();
}));

/**
 * Returns a relative path given a route name, data context and optional query
 * and hash parameters.
 */
UI.registerHelper('pathFor', function (options) {
  var routeName;

  if (arguments.length > 1) {
    routeName = arguments[0];
    options = arguments[1] || {};
  } 

  var opts = options && options.hash;

  opts = opts || {};

  var path = '';
  var query = opts.query;
  var hash = opts.hash;
  var routeName = routeName || opts.route;
  var data = _.extend({}, opts.data || this);

  var route = Router.routes[routeName];
  warn(route, "pathFor couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    _.each(route.handler.compiledUrl.keys, function (keyConfig) {
      var key = keyConfig.name;
      if (_.has(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    path = route.path(data, {query: query, hash: hash});
  }

  return path;
});

/**
 * Returns a relative path given a route name, data context and optional query
 * and hash parameters.
 */
UI.registerHelper('urlFor', function (options) {
  var routeName;

  if (arguments.length > 1) {
    routeName = arguments[0];
    options = arguments[1] || {};
  } 

  var opts = options && options.hash;

  opts = opts || {};
  var url = '';
  var query = opts.query;
  var hash = opts.hash;
  var routeName = routeName || opts.route;
  var data = _.extend({}, opts.data || this);

  var route = Router.routes[routeName];
  warn(route, "urlFor couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    _.each(route.handler.compiledUrl.keys, function (keyConfig) {
      var key = keyConfig.name;
      if (_.has(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    url = route.url(data, {query: query, hash: hash});
  }

  return url;
});

/**
 * Create a link with optional content block.
 *
 * Example:
 *   {{#linkTo route="one" query="query" hash="hash" class="my-cls"}}
 *    <div>My Custom Link Content</div>
 *   {{/linkTo}}
 */
UI.registerHelper('linkTo', new Blaze.Template('linkTo', function () {
  var self = this;
  var opts = DynamicTemplate.getInclusionArguments(this);

  if (typeof opts !== 'object')
    throw new Error("linkTo options must be key value pairs such as {{#linkTo route='my.route.name'}}. You passed: " + JSON.stringify(opts));

  opts = opts || {};
  var path = '';
  var query = opts.query;
  var hash = opts.hash;
  var routeName = opts.route;
  var data = _.extend({}, opts.data || DynamicTemplate.getParentDataContext(this));
  var route = Router.routes[routeName];
  var paramKeys;

  warn(route, "linkTo couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    _.each(route.handler.compiledUrl.keys, function (keyConfig) {
      var key = keyConfig.name;
      if (_.has(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    path = route.path(data, {query: query, hash: hash});
  }

  // anything that isn't one of our keywords we'll assume is an attributed
  // intended for the <a> tag
  var attrs = _.omit(opts, 'route', 'query', 'hash', 'data');
  attrs.href = path;

  return Blaze.With(function () {
    return DynamicTemplate.getParentDataContext(self);
  }, function () {
    return HTML.A(attrs, self.templateContentBlock);
  });
}));

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/body_parser_server.js                                             //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Router.bodyParser = Npm.require('body-parser');

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/router_server.js                                                  //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
var assert = Iron.utils.assert;

var env = process.env.NODE_ENV || 'development';

/**
 * Server specific initialization.
 */
Router.prototype.init = function (options) {};

/**
 * Give people a chance to customize the body parser
 * behavior.
 */
Router.prototype.configureBodyParsers = function () {
  Router.onBeforeAction(Iron.Router.bodyParser.json());
  Router.onBeforeAction(Iron.Router.bodyParser.urlencoded({extended: false}));
};

/**
 * Add the router to the server connect handlers.
 */
Router.prototype.start = function () {
  WebApp.connectHandlers.use(this);
  this.configureBodyParsers();
};

/**
 * Create a new controller and dispatch into the stack.
 */
Router.prototype.dispatch = function (url, context, done) {
  var self = this;

  assert(typeof url === 'string', "expected url string in router dispatch");
  assert(typeof context === 'object', "expected context object in router dispatch");

  // assumes there is only one router
  // XXX need to initialize controller either from the context itself or if the
  // context already has a controller on it, just use that one.
  var controller = this.createController(url, context);

  controller.dispatch(this._stack, url, function (err) {
    var res = this.response;
    var req = this.request;
    var msg;

    if (err) {
      if (res.statusCode < 400) 
        res.statusCode = 500;

      if (err.status)
        res.statusCode = err.status;

      if (env === 'development')
        msg = (err.stack || err.toString()) + '\n';
      else
        //XXX get this from standard dict of error messages?
        msg = 'Server error.';

      console.error(err.stack || err.toString());

      if (res.headersSent)
        return req.socket.destroy();

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Length', Buffer.byteLength(msg));
      if (req.method === 'HEAD')
        return res.end();
      res.end(msg);
      return;
    }

    // if there are no client or server handlers for this dispatch
    // then send a 404.
    // XXX we need a solution here for 404s on bad routes.
    //     one solution might be to provide a custom 404 page in the public
    //     folder. But we need a proper way to handle 404s for search engines.
    // XXX might be a PR to Meteor to use an existing status code if it's set
    if (!controller.isHandled() && !controller.willBeHandledOnClient()) {
      return done();
      /*
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');
      msg = req.method + ' ' + req.originalUrl + ' not found.';
      console.error(msg);
      if (req.method == 'HEAD')
        return res.end();
      res.end(msg + '\n');
      return;
      */
    }

    // if for some reason there was a server handler but no client handler
    // and the server handler called next() we might end up here. We
    // want to make sure to end the response so it doesn't hang.
    if (controller.isHandled() && !controller.willBeHandledOnClient()) {
      res.setHeader('Content-Type', 'text/html');
      if (req.method === 'HEAD')
        res.end();
      res.end("<p>It looks like you don't have any client routes defined, but you had at least one server handler. You probably want to define some client side routes!</p>\n");
    }

    // we'll have Meteor load the normal application so long as
    // we have at least one client route/handler and the done() iterator
    // function has been passed to us, presumably from Connect.
    if (controller.willBeHandledOnClient() && done)
      return done(err);
  });
};

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/plugins.js                                                        //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/**
 * Simple plugin wrapper around the loading hook.
 */
Router.plugins.loading = function (router, options) {
  router.onBeforeAction('loading', options);
};

/**
 * Simple plugin wrapper around the dataNotFound hook.
 */
Router.plugins.dataNotFound = function (router, options) {
  router.onBeforeAction('dataNotFound', options);
};

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/iron_router/lib/global_router.js                                                  //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Router = new Iron.Router;

////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['iron:router'] = {}, {
  Router: Router,
  RouteController: RouteController
});

})();
