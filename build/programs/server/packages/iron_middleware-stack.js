(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;
var Iron = Package['iron:core'].Iron;

/* Package-scope variables */
var Handler, MiddlewareStack;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/iron_middleware-stack/lib/handler.js                                                       //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Url = Iron.Url;

Handler = function (path, fn, options) {
  if (_.isFunction(path)) {
    options = options || fn || {};
    fn = path;
    path = '/';
    
    // probably need a better approach here to differentiate between
    // Router.use(function () {}) and Router.use(MyAdminApp). In the first
    // case we don't want to count it as a viable server handler when we're
    // on the client and need to decide whether to go to the server. in the
    // latter case, we DO want to go to the server, potentially.
    this.middleware = true;

    if (typeof options.mount === 'undefined')
      options.mount = true;
  }

  // if fn is a function then typeof fn => 'function'
  // but note we can't use _.isObject here because that will return true if the
  // fn is a function OR an object.
  if (typeof fn === 'object') {
    options = fn;
    fn = options.action || 'action';
  }

  options = options || {};

  this.options = options;
  this.mount = options.mount;
  this.method = (options.method && options.method.toLowerCase()) || false;

  // should the handler be on the 'client', 'server' or 'both'?
  // XXX can't we default this to undefined in which case it's run in all
  // environments?
  this.where = options.where || 'client';

  // if we're mounting at path '/foo' then this handler should also handle
  // '/foo/bar' and '/foo/bar/baz'
  if (this.mount)
    options.end = false;

  // set the name
  if (options.name)
    this.name = options.name;
  else if (typeof path === 'string' && path.charAt(0) !== '/')
    this.name = path;
  else if (fn && fn.name)
    this.name = fn.name;
  else if (typeof path === 'string' && path !== '/')
    this.name = path.split('/').slice(1).join('.');

  // if the path is explicitly set on the options (e.g. legacy router support)
  // then use that
  // otherwise use the path argument which could also be a name
  path = options.path || path;

  if (typeof path === 'string' && path.charAt(0) !== '/')
    path = '/' + path;

  this.path = path;
  this.compiledUrl = new Url(path, options);

  if (_.isString(fn)) {
    this.handle = function handle () {
      // try to find a method on the current thisArg which might be a Controller
      // for example.
      var func = this[fn];

      if (typeof func !== 'function')
        throw new Error("No method named " + JSON.stringify(fn) + " found on handler.");

      return func.apply(this, arguments);
    };
  } else if (_.isFunction(fn)) {
    // or just a regular old function
    this.handle = fn;
  }
};

/**
 * Returns true if the path matches the handler's compiled url, method
 * and environment (e.g. client/server). If no options.method or options.where
 * is provided, then only the path will be used to test.
 */
Handler.prototype.test = function (path, options) {
  options = options || {};

  var isUrlMatch = this.compiledUrl.test(path);
  var isMethodMatch = true;
  var isEnvMatch = true;

  if (this.method && options.method)
    isMethodMatch = this.method == options.method.toLowerCase();

  if (options.where)
    isEnvMatch = this.where == options.where;

  return isUrlMatch && isMethodMatch && isEnvMatch;
};

Handler.prototype.params = function (path) {
  return this.compiledUrl.params(path);
};

Handler.prototype.resolve = function (params, options) {
  return this.compiledUrl.resolve(params, options);
};

/**
 * Returns a new cloned Handler.
 * XXX problem is here because we're not storing the original path.
 */
Handler.prototype.clone = function () {
  var clone = new Handler(this.path, this.handle, this.options);
  // in case the original function had a name
  clone.name = this.name;
  return clone;
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/iron_middleware-stack/lib/middleware_stack.js                                              //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Url = Iron.Url;
var assert = Iron.utils.assert;
var defaultValue = Iron.utils.defaultValue;

/**
 * Connect inspired middleware stack that works on the client and the server.
 *
 * You can add handlers to the stack for various paths. Those handlers can run
 * on the client or server. Then you can dispatch into the stack with a
 * given path by calling the dispatch method. This goes down the stack looking
 * for matching handlers given the url and environment (client/server). If we're
 * on the client and we should make a trip to the server, the onServerDispatch
 * callback is called.
 *
 * The middleware stack supports the Connect API. But it also allows you to
 * specify a context so we can have one context object (like a Controller) that
 * is a consistent context for each handler function called on a dispatch.
 *
 */
MiddlewareStack = function () {
  this._stack = [];
  this.length = 0;
};

MiddlewareStack.prototype._create = function (path, fn, options) {
  var handler = new Handler(path, fn, options);
  var name = handler.name;

  if (name) {
    if (_.has(this._stack, name)) {
      throw new Error("Handler with name '" + name + "' already exists.");
    }
    this._stack[name] = handler;
  }

  return handler;
};

MiddlewareStack.prototype.findByName = function (name) {
  return this._stack[name];
};

/**
 * Push a new handler onto the stack.
 */
MiddlewareStack.prototype.push = function (path, fn, options) {
  var handler = this._create(path, fn, options);
  this._stack.push(handler);
  this.length++;
  return handler;
};

MiddlewareStack.prototype.append = function (/* fn1, fn2, [f3, f4]... */) {
  var self = this;
  var args = _.toArray(arguments);
  var options = {};

  if (typeof args[args.length-1] === 'object')
    options = args.pop();

  _.each(args, function (fnOrArray) {
    if (typeof fnOrArray === 'undefined')
      return;
    else if (typeof fnOrArray === 'function')
      self.push(fnOrArray, options);
    else if (_.isArray(fnOrArray))
      self.append.apply(self, fnOrArray.concat([options]));
    else
      throw new Error("Can only append functions or arrays to the MiddlewareStack");
  });

  return this;
};

/**
 * Insert a handler at a specific index in the stack.
 *
 * The index behavior is the same as Array.prototype.splice. If the index is
 * greater than the stack length the handler will be appended at the end of the
 * stack. If the index is negative, the item will be inserted "index" elements
 * from the end.
 */
MiddlewareStack.prototype.insertAt = function (index, path, fn, options) {
  var handler = this._create(path, fn, options);
  this._stack.splice(index, 0, handler);
  this.length = this._stack.length;
  return this;
};

/**
 * Insert a handler before another named handler.
 */
MiddlewareStack.prototype.insertBefore = function (name, path, fn, options) {
  var beforeHandler;
  var index;

  if (!(beforeHandler = this._stack[name]))
    throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

  index = _.indexOf(this._stack, beforeHandler);
  this.insertAt(index, path, fn, options);
  return this;
};

/**
 * Insert a handler after another named handler.
 *
 */
MiddlewareStack.prototype.insertAfter = function (name, path, fn, options) {
  var handler;
  var index;

  if (!(handler = this._stack[name]))
    throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

  index = _.indexOf(this._stack, handler);
  this.insertAt(index + 1, path, fn, options);
  return this;
};

/**
 * Return a new MiddlewareStack comprised of this stack joined with other
 * stacks. Note the new stack will not have named handlers anymore. Only the
 * handlers are cloned but not the name=>handler mapping.
 */
MiddlewareStack.prototype.concat = function (/* stack1, stack2, */) {
  var ret = new MiddlewareStack;
  var concat = Array.prototype.concat;
  var clonedThisStack = EJSON.clone(this._stack);
  var clonedOtherStacks = _.map(_.toArray(arguments), function (s) { return EJSON.clone(s._stack); });
  ret._stack = concat.apply(clonedThisStack, clonedOtherStacks);
  ret.length = ret._stack.length;
  return ret;
};

/**
 * Dispatch into the middleware stack, allowing the handlers to control the
 * iteration by calling this.next();
 */
MiddlewareStack.prototype.dispatch = function dispatch (url, context, done) {
  var self = this;
  var originalUrl = url;

  assert(typeof url === 'string', "Requires url");
  assert(typeof context === 'object', "Requires context object");

  url = Url.normalize(url || '/');

  defaultValue(context, 'request', {});
  defaultValue(context, 'response', {});
  defaultValue(context, 'originalUrl', url);

  //defaultValue(context, 'location', Url.parse(originalUrl));
  defaultValue(context, '_method', context.method);
  defaultValue(context, '_handlersForEnv', {client: false, server: false});
  defaultValue(context, '_handled', false);

  defaultValue(context, 'isHandled', function () {
    return context._handled;
  });

  defaultValue(context, 'willBeHandledOnClient', function () {
    return context._handlersForEnv.client;
  });

  defaultValue(context, 'willBeHandledOnServer', function () {
    return context._handlersForEnv.server;
  });

  var wrappedDone = function () {
    if (done) {
      try {
        done.apply(this, arguments);
      } catch (err) {
        // if we catch an error at this point in the stack we don't want it
        // handled in the next() iterator below. So we'll mark the error to tell
        // the next iterator to ignore it.
        err._punt = true;

        // now rethrow it!
        throw err;
      }
    }
  };

  var index = 0;

  var next = Meteor.bindEnvironment(function boundNext (err) {
    var handler = self._stack[index++];

    // reset the url
    context.url = context.request.url = context.originalUrl;

    if (!handler)
      return wrappedDone.call(context, err);

    if (!handler.test(url, {method: context._method}))
      return next(err);

    // okay if we've gotten this far the handler matches our url but we still
    // don't know if this is a client or server handler. Let's track that.
    // XXX couldn't the environment be something else like cordova?
    var where = Meteor.isClient ? 'client' : 'server';

    // track that we have a handler for the given environment so long as it's
    // not middleware created like this Router.use(function () {}). We'll assume
    // that if the handler is of that form we don't want to make a trip to
    // the client or the server for it.
    if (!handler.middleware)
      context._handlersForEnv[handler.where] = true;

    // but if we're not actually on that env, skip to the next handler.
    if (handler.where !== where)
      return next(err);

    // get the parameters for this url from the handler's compiled path
    // XXX removing for now
    //var params = handler.params(context.location.href);
    //context.request.params = defaultValue(context, 'params', {});
    //_.extend(context.params, params);

    // so we can call this.next()
    // XXX this breaks with things like request.body which require that the
    // iterator be saved for the given function call.
    context.next = next;

    if (handler.mount) {
      var mountpath = Url.normalize(handler.compiledUrl.pathname);
      var newUrl = url.substr(mountpath.length, url.length);
      newUrl = Url.normalize(newUrl);
      context.url = context.request.url = newUrl;
    }

    try {
      //
      // The connect api says a handler signature (arity) can look like any of:
      //
      // 1) function (req, res, next)
      // 2) function (err, req, res, next)
      // 3) function (err)
      var arity = handler.handle.length
      var req = context.request;
      var res = context.response;

      // function (err, req, res, next)
      if (err && arity === 4)
        return handler.handle.call(context, err, req, res, next);

      // function (req, res, next)
      if (!err && arity < 4)
        return handler.handle.call(context, req, res, next);

      // default is function (err) so punt the error down the stack
      // until we either find a handler who likes to deal with errors or we call
      // out
      return next(err);
    } catch (err) {
      if (err._punt)
        // ignore this error and throw it down the stack
        throw err;
      else
        // see if the next handler wants to deal with the error
        next(err);
    } finally {
      // we'll put this at the end because some middleware
      // might want to decide what to do based on whether we've
      // been handled "yet". If we set this to true before the handler
      // is called, there's no way for the handler to say, if we haven't been
      // handled yet go to the server, for example.
      context._handled = true;
      context.next = null;
    }
  });

  next();

  context.next = null;
  return context;
};

Iron = Iron || {};
Iron.MiddlewareStack = MiddlewareStack;

/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['iron:middleware-stack'] = {}, {
  Handler: Handler
});

})();
