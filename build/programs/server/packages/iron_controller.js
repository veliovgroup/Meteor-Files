(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var ReactiveDict = Package['reactive-dict'].ReactiveDict;
var Iron = Package['iron:core'].Iron;

/* Package-scope variables */
var Controller;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/iron_controller/lib/controller.js                                              //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var debug = Iron.utils.debug('iron:controller');
var Layout = Iron.Layout;
var DynamicTemplate = Iron.DynamicTemplate;

/*****************************************************************************/
/* Private */
/*****************************************************************************/
var bindData = function (value, thisArg) {
  return function () {
    return (typeof value === 'function') ? value.apply(thisArg, arguments) : value;
  };
};

/*****************************************************************************/
/* Controller */
/*****************************************************************************/
Controller = function (options) {
  var self = this;
  this.options = options || {};
  this._layout = this.options.layout || new Layout(this.options);
  this._isController = true;
  this._layout._setLookupHost(this);

  // grab the event map from the Controller constructor which was
  // set if the user does MyController.events({...});
  var eventMap = Controller._collectEventMaps.call(this.constructor);
  this._layout.events(eventMap, this);

  this.init(options);
};

/**
 * Set or get the layout's template and optionally its data context.
 */
Controller.prototype.layout = function (template, options) {
  var self = this;

  this._layout.template(template);

  // check whether options has a data property
  if (options && (_.has(options, 'data')))
    this._layout.data(bindData(options.data, this));

  return {
    data: function (val) {
      return self._layout.data(bindData(val, self));
    }
  };
};

/**
 * Render a template into a region of the layout.
 */
Controller.prototype.render = function (template, options) {
  var self = this;

  if (options && (typeof options.data !== 'undefined'))
    options.data = bindData(options.data, this);

  var tmpl = this._layout.render(template, options);

  // allow caller to do: this.render('MyTemplate').data(function () {...});
  return {
    data: function (func) {
      return tmpl.data(bindData(func, self));
    }
  };
};

/**
 * Begin recording rendered regions.
 */
Controller.prototype.beginRendering = function (onComplete) {
  return this._layout.beginRendering(onComplete);
};

/*****************************************************************************/
/* Controller Static Methods */
/*****************************************************************************/
/**
 * Inherit from Controller.
 *
 * Note: The inheritance function in Meteor._inherits is broken. Static
 * properties on functions don't get copied.
 */
Controller.extend = function (props) {
  return Iron.utils.extend(this, props); 
};

Controller.events = function (events) {
  this._eventMap = events;
  return this;
};

/**
 * Returns a single event map merged from super to child.
 * Called from the constructor function like this:
 *
 * this.constructor._collectEventMaps()
 */

var mergeStaticInheritedObjectProperty = function (ctor, prop) {
  var merge = {};

  if (ctor.__super__)
    _.extend(merge, mergeStaticInheritedObjectProperty(ctor.__super__.constructor, prop));
  
  return _.has(ctor, prop) ? _.extend(merge, ctor[prop]) : merge;
};

Controller._collectEventMaps = function () {
  return mergeStaticInheritedObjectProperty(this, '_eventMap');
};

// NOTE: helpers are not inherited from one controller to another, for now.
Controller._helpers = {};
Controller.helpers = function (helpers) {
  _.extend(this._helpers, helpers);
  return this;
};

/*****************************************************************************/
/* Global Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  /**
   * Returns the nearest controller for a template instance. You can call this
   * function from inside a template helper.
   *
   * Example:
   * Template.MyPage.helpers({
   *   greeting: function () {
   *    var controller = Iron.controller();
   *    return controller.state.get('greeting');
   *   }
   * });
   */
  Iron.controller = function () {
    //XXX establishes a reactive dependency which causes helper to run
    return DynamicTemplate.findLookupHostWithProperty(Blaze.getView(), '_isController');
  };

  /**
   * Find a lookup host with a state key and return it reactively if we have
   * it.
   */
  Template.registerHelper('get', function (key) {
    var controller = Iron.controller();
    if (controller && controller.state)
      return controller.state.get(key);
  });
}
/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Controller = Controller;

/////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/iron_controller/lib/controller_server.js                                       //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
Controller.prototype.init = function () {};

Controller.prototype.wait = function () {};

Controller.prototype.ready = function () {
  // for now there are no subscribe calls on the server. All data should
  // be ready synchronously which means this.ready() should always be true.
  return true;
};

/////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:controller'] = {};

})();
