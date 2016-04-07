(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var Iron;

(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/iron_core/lib/version_conflict_error.js                                             //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
if (Package['cmather:iron-core']) {
  throw new Error("\n\n\
    Sorry! The cmather:iron-{x} packages were migrated to the new package system with the wrong name, and you have duplicate copies.\n\
    You can see which cmather:iron-{x} packages have been installed by using this command:\n\n\
    > meteor list\n\n\
    Can you remove any installed cmather:iron-{x} packages like this:\
    \n\n\
    > meteor remove cmather:iron-core\n\
    > meteor remove cmather:iron-router\n\
    > meteor remove cmather:iron-dynamic-template\n\
    > meteor remove cmather:iron-dynamic-layout\n\
    \n\
    The new packages are named iron:{x}. For example:\n\n\
    > meteor add iron:router\n\n\
    Sorry for the hassle, but thank you!\
    \n\n\
  ");
}

//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/iron_core/lib/iron_core.js                                                          //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
Iron = {};
Iron.utils = {};

/**
 * Assert that the given condition is truthy and throw an error if not.
 */

Iron.utils.assert = function (condition, msg) {
  if (!condition)
    throw new Error(msg);
};

/**
 * Print a warning message to the console if the console is defined.
 */
Iron.utils.warn = function (condition, msg) {
  if (!condition)
    console && console.warn && console.warn(msg);
};

/**
 * Given a target object and a property name, if the value of that property is
 * undefined, set a default value and return it. If the value is already
 * defined, return the existing value.
 */
Iron.utils.defaultValue = function (target, prop, value) {
  if (typeof target[prop] === 'undefined') {
    target[prop] = value;
    return value;
  } else {
    return target[prop]
  }
};

/**
 * Make one constructor function inherit from another. Optionally provide
 * prototype properties for the child.
 *
 * @param {Function} Child The child constructor function.
 * @param {Function} Parent The parent constructor function.
 * @param {Object} [props] Prototype properties to add to the child
 */
Iron.utils.inherits = function (Child, Parent, props) {
  Iron.utils.assert(typeof Child !== "undefined", "Child is undefined in inherits function");
  Iron.utils.assert(typeof Parent !== "undefined", "Parent is undefined in inherits function");

  // copy static fields
  for (var key in Parent) {
    if (_.has(Parent, key))
      Child[key] = EJSON.clone(Parent[key]);
  }

  var Middle = function () {
    this.constructor = Child;
  };

  // hook up the proto chain
  Middle.prototype = Parent.prototype;
  Child.prototype = new Middle;
  Child.__super__ = Parent.prototype;

  // copy over the prototype props
  if (_.isObject(props))
    _.extend(Child.prototype, props);

  return Child;
};

/**
 * Create a new constructor function that inherits from Parent and copy in the
 * provided prototype properties.
 *
 * @param {Function} Parent The parent constructor function.
 * @param {Object} [props] Prototype properties to add to the child
 */
Iron.utils.extend = function (Parent, props) {
  props = props || {};

  var ctor = function () {
    // automatically call the parent constructor if a new one
    // isn't provided.
    var constructor;
    if (_.has(props, 'constructor'))
      constructor = props.constructor
    else
      constructor = ctor.__super__.constructor;

    constructor.apply(this, arguments);
  };

  return Iron.utils.inherits(ctor, Parent, props);
};

/**
 * Either window in the browser or global in NodeJS.
 */
Iron.utils.global = (function () {
  return Meteor.isClient ? window : global;
})();

/**
 * Ensure a given namespace exists and assign it to the given value or
 * return the existing value.
 */
Iron.utils.namespace = function (namespace, value) {
  var global = Iron.utils.global;
  var parts;
  var part;
  var name;
  var ptr;

  Iron.utils.assert(typeof namespace === 'string', "namespace must be a string");

  parts = namespace.split('.');
  name = parts.pop();
  ptr = global;

  for (var i = 0; i < parts.length; i++) {
    part = parts[i];
    ptr = ptr[part] = ptr[part] || {};
  }

  if (arguments.length === 2) {
    ptr[name] = value;
    return value;
  } else {
    return ptr[name];
  }
};

/**
 * Returns the resolved value at the given namespace or the value itself if it's
 * not a string.
 *
 * Example:
 *
 * var Iron = {};
 * Iron.foo = {};
 *
 * var baz = Iron.foo.baz = {};
 * Iron.utils.resolve("Iron.foo.baz") === baz
 */
Iron.utils.resolve = function (nameOrValue) {
  var global = Iron.utils.global;
  var parts;
  var ptr;

  if (typeof nameOrValue === 'string') {
    parts = nameOrValue.split('.');
    ptr = global;
    for (var i = 0; i < parts.length; i++) {
      ptr = ptr[parts[i]];
      if (!ptr)
        return undefined;
    }
  } else {
    ptr = nameOrValue;
  }

  // final position of ptr should be the resolved value
  return ptr;
};

/**
 * Capitalize a string.
 */
Iron.utils.capitalize = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1, str.length);
};

/**
 * Convert a string to class case.
 */
Iron.utils.classCase = function (str) {
  var re = /_|-|\.|\//;

  if (!str)
    return '';

  return _.map(str.split(re), function (word) {
    return Iron.utils.capitalize(word);
  }).join('');
};

/**
 * Convert a string to camel case.
 */
Iron.utils.camelCase = function (str) {
  var output = Iron.utils.classCase(str);
  output = output.charAt(0).toLowerCase() + output.slice(1, output.length);
  return output;
};

/**
 * deprecatation notice to the user which can be a string or object
 * of the form:
 *
 * {
 *  name: 'somePropertyOrMethod',
 *  where: 'RouteController',
 *  instead: 'someOtherPropertyOrMethod',
 *  message: ':name is deprecated. Please use :instead instead'
 * }
 */
Iron.utils.notifyDeprecated = function (info) {
  var name;
  var instead;
  var message;
  var where;
  var defaultMessage = "[:where] ':name' is deprecated. Please use ':instead' instead.";

  if (_.isObject(info)) {
    name = info.name;
    instead = info.instead;
    message = info.message || defaultMessage;
    where = info.where || 'IronRouter';
  } else {
    message = info;
    name = '';
    instead = '';
    where = '';
  }

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      '<deprecated> ' +
      message
      .replace(':name', name)
      .replace(':instead', instead)
      .replace(':where', where) +
      ' ' +
      (new Error).stack
    );
  }
};

Iron.utils.withDeprecatedNotice = function (info, fn, thisArg) {
  return function () {
    Utils.notifyDeprecated(info);
    return fn && fn.apply(thisArg || this, arguments);
  };
};

// so we can do this:
//   getController: function () {
//    ...
//   }.deprecate({...})
Function.prototype.deprecate = function (info) {
  var fn = this;
  return Iron.utils.withDeprecatedNotice(info, fn);
};

/**
 * Returns a function that can be used to log debug messages for a given
 * package.
 */
Iron.utils.debug = function (package) {
  Iron.utils.assert(typeof package === 'string', "debug requires a package name");

  return function debug (/* args */) {
    if (console && console.log && Iron.debug === true) {
      var msg = _.toArray(arguments).join(' ');
      console.log("%c<" + package + "> %c" + msg, "color: #999;", "color: #000;");
    }
  };
};

/*
 * Meteor's version of this function is broke.
 */
Iron.utils.get = function (obj /*, arguments */) {
  for (var i = 1; i < arguments.length; i++) {
    if (!obj || !(arguments[i] in obj))
      return undefined;
    obj = obj[arguments[i]];
  }
  return obj;
};

// make sure Iron ends up in the global namespace
Iron.utils.global.Iron = Iron;

//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['iron:core'] = {}, {
  Iron: Iron
});

})();
