(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Blaze = Package.ui.Blaze;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var Random = Package.random.Random;
var Iron = Package['iron:core'].Iron;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var DynamicTemplate;

(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/iron_dynamic-template/version_conflict_error.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
if (Package['cmather:iron-dynamic-template']) {
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/iron_dynamic-template/dynamic_template.js                                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var debug = Iron.utils.debug('iron:dynamic-template');
var assert = Iron.utils.assert;
var get = Iron.utils.get;
var camelCase = Iron.utils.camelCase;

/*****************************************************************************/
/* Private */
/*****************************************************************************/
var typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

/*****************************************************************************/
/* DynamicTemplate */
/*****************************************************************************/

/**
 * Render a component to the page whose template and data context can change
 * dynamically, either from code or from helpers.
 *
 */
DynamicTemplate = function (options) {
  this._id = Random.id(); 
  this.options = options = options || {};
  this._template = options.template;
  this._defaultTemplate = options.defaultTemplate;
  this._content = options.content;
  this._data = options.data;
  this._templateDep = new Tracker.Dependency;
  this._dataDep = new Tracker.Dependency;

  this._lookupHostDep = new Tracker.Dependency;
  this._lookupHostValue = null;

  this._hooks = {};
  this._eventMap = null;
  this._eventHandles = null;
  this._eventThisArg = null;
  this.name = options.name || this.constructor.prototype.name || 'DynamicTemplate';

  // has the Blaze.View been created?
  this.isCreated = false;

  // has the Blaze.View been destroyed and not created again?
  this.isDestroyed = false;
};

/**
 * Get or set the template.
 */
DynamicTemplate.prototype.template = function (value) {
  if (arguments.length === 1 && value !== this._template) {
    this._template = value;
    this._templateDep.changed();
    return;
  }

  if (arguments.length > 0)
    return;

  this._templateDep.depend();

  // do we have a template?
  if (this._template)
    return (typeof this._template === 'function') ? this._template() : this._template;

  // no template? ok let's see if we have a default one set
  if (this._defaultTemplate)
    return (typeof this._defaultTemplate === 'function') ? this._defaultTemplate() : this._defaultTemplate;
};

/**
 * Get or set the default template.
 *
 * This function does not change any dependencies.
 */
DynamicTemplate.prototype.defaultTemplate = function (value) {
  if (arguments.length === 1)
    this._defaultTemplate = value;
  else
    return this._defaultTemplate;
};

/**
 * Clear the template and data contexts.
 */
DynamicTemplate.prototype.clear = function () {
  //XXX do we need to clear dependencies here too?
  this._template = undefined;
  this._data = undefined;
  this._templateDep.changed();
};

/**
 * Get or set the data context.
 */
DynamicTemplate.prototype.data = function (value) {
  if (arguments.length === 1 && value !== this._data) {
    this._data = value;
    this._dataDep.changed();
    return;
  }

  this._dataDep.depend();
  return typeof this._data === 'function' ? this._data() : this._data;
};

/**
 * Create the view if it hasn't been created yet.
 */
DynamicTemplate.prototype.create = function (options) {
  var self = this;

  if (this.isCreated) {
    throw new Error("DynamicTemplate view is already created");
  }

  this.isCreated = true;
  this.isDestroyed = false;

  var templateVar = ReactiveVar(null);

  var view = Blaze.View('DynamicTemplate', function () {
    var thisView = this;

    // create the template dependency here because we need the entire
    // dynamic template to re-render if the template changes, including
    // the Blaze.With view.
    var template = templateVar.get();

    return Blaze.With(function () {
      // NOTE: This will rerun anytime the data function invalidates this
      // computation OR if created from an inclusion helper (see note below) any
      // time any of the argument functions invlidate the computation. For
      // example, when the template changes this function will rerun also. But
      // it's probably generally ok. The more serious use case is to not
      // re-render the entire template every time the data context changes.
      var result = self.data();

      if (typeof result !== 'undefined')
        // looks like data was set directly on this dynamic template
        return result;
      else
        // return the first parent data context that is not inclusion arguments
        return DynamicTemplate.getParentDataContext(thisView);
    }, function () {
      return self.renderView(template);
    });
  });

  view.onViewCreated(function () {
    this.autorun(function () {
      templateVar.set(self.template());
    });
  });

  // wire up the view lifecycle callbacks
  _.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {
    view[hook](function () {
      // "this" is the view instance
      self._runHooks(hook, this);
    });
  });

  view._onViewRendered(function () {
    // avoid inserting the view twice by accident.
    self.isInserted = true;

    if (view.renderCount !== 1)
      return;

    self._attachEvents();
  });

  view.onViewDestroyed(function () {
    // clean up the event handlers if
    // the view is destroyed
    self._detachEvents();
  });

  view._templateInstance = new Blaze.TemplateInstance(view);
  view.templateInstance = function () {
    // Update data, firstNode, and lastNode, and return the TemplateInstance
    // object.
    var inst = view._templateInstance;

    inst.data = Blaze.getData(view);

    if (view._domrange && !view.isDestroyed) {
      inst.firstNode = view._domrange.firstNode();
      inst.lastNode = view._domrange.lastNode();
    } else {
      // on 'created' or 'destroyed' callbacks we don't have a DomRange
      inst.firstNode = null;
      inst.lastNode = null;
    }

    return inst;
  };

  this.view = view;
  view.__dynamicTemplate__ = this;
  view.name = this.name;
  return view;
};

DynamicTemplate.prototype.renderView = function (template) {
  var self = this;

  // NOTE: When DynamicTemplate is used from a template inclusion helper
  // like this {{> DynamicTemplate template=getTemplate data=getData}} the
  // function below will rerun any time the getData function invalidates the
  // argument data computation.
  var tmpl = null;

  // is it a template name like "MyTemplate"?
  if (typeof template === 'string') {
    tmpl = Template[template];

    if (!tmpl)
      // as a fallback double check the user didn't actually define
      // a camelCase version of the template.
      tmpl = Template[camelCase(template)];

    if (!tmpl) {
      tmpl = Blaze.With({
        msg: "Couldn't find a template named " + JSON.stringify(template) + " or " + JSON.stringify(camelCase(template))+ ". Are you sure you defined it?"
      }, function () {
        return Template.__DynamicTemplateError__;
      });
    }
  } else if (typeOf(template) === '[object Object]') {
    // or maybe a view already?
    tmpl = template;
  } else if (typeof self._content !== 'undefined') {
    // or maybe its block content like
    // {{#DynamicTemplate}}
    //  Some block
    // {{/DynamicTemplate}}
    tmpl = self._content;
  }

  return tmpl;
};

/**
 * Destroy the dynamic template, also destroying the view if it exists.
 */
DynamicTemplate.prototype.destroy = function () {
  if (this.isCreated) {
    Blaze.remove(this.view);
    this.view = null;
    this.isDestroyed = true;
    this.isCreated = false;
  }
};

/**
 * View lifecycle hooks.
 */
_.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {
  DynamicTemplate.prototype[hook] = function (cb) {
    var hooks = this._hooks[hook] = this._hooks[hook] || [];
    hooks.push(cb);
    return this;
  };
});

DynamicTemplate.prototype._runHooks = function (name, view) {
  var hooks = this._hooks[name] || [];
  var hook;

  for (var i = 0; i < hooks.length; i++) {
    hook = hooks[i];
    // keep the "thisArg" pointing to the view, but make the first parameter to
    // the callback teh dynamic template instance.
    hook.call(view, this);
  }
};

DynamicTemplate.prototype.events = function (eventMap, thisInHandler) {
  var self = this;

  this._detachEvents();
  this._eventThisArg = thisInHandler;

  var boundMap = this._eventMap = {};

  for (var key in eventMap) {
    boundMap[key] = (function (key, handler) {
      return function (e) {
        var data = Blaze.getData(e.currentTarget);
        if (data == null) data = {};
        var tmplInstance = self.view.templateInstance();
        return handler.call(thisInHandler || this, e, tmplInstance, data);
      }
    })(key, eventMap[key]);
  }

  this._attachEvents();
};

DynamicTemplate.prototype._attachEvents = function () {
  var self = this;
  var thisArg = self._eventThisArg;
  var boundMap = self._eventMap;
  var view = self.view;
  var handles = self._eventHandles;

  if (!view)
    return;

  var domrange = view._domrange;

  if (!domrange)
    throw new Error("no domrange");

  var attach = function (range, element) {
    _.each(boundMap, function (handler, spec) {
      var clauses = spec.split(/,\s+/);
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']
      _.each(clauses, function (clause) {
        var parts = clause.split(/\s+/);
        if (parts.length === 0)
          return;

        var newEvents = parts.shift();
        var selector = parts.join(' ');
        handles.push(Blaze._EventSupport.listen(
          element, newEvents, selector,
          function (evt) {
            if (! range.containsElement(evt.currentTarget))
              return null;
            var handlerThis = self._eventThisArg || this;
            var handlerArgs = arguments;
            //XXX which view should this be? What if the event happened
            //somwhere down the hierarchy?
            return Blaze._withCurrentView(view, function () {
              return handler.apply(handlerThis, handlerArgs);
            });
          },
          range, function (r) {
            return r.parentRange;
          }));
      });
    });
  };

  if (domrange.attached)
    attach(domrange, domrange.parentElement);
  else
    domrange.onAttached(attach);
};

DynamicTemplate.prototype._detachEvents = function () {
  _.each(this._eventHandles, function (h) { h.stop(); });
  this._eventHandles = [];
};

var attachEventMaps = function (range, element, eventMap, thisInHandler) {
  _.each(eventMap, function (handler, spec) {
    var clauses = spec.split(/,\s+/);
    // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']
    _.each(clauses, function (clause) {
      var parts = clause.split(/\s+/);
      if (parts.length === 0)
        return;

      var newEvents = parts.shift();
      var selector = parts.join(' ');
      handles.push(Blaze._EventSupport.listen(
        element, newEvents, selector,
        function (evt) {
          if (! range.containsElement(evt.currentTarget))
            return null;
          var handlerThis = thisInHandler || this;
          var handlerArgs = arguments;
          return Blaze._withCurrentView(view, function () {
            return handler.apply(handlerThis, handlerArgs);
          });
        },
        range, function (r) {
          return r.parentRange;
        }));
    });
  });
};

/**
 * Insert the Layout view into the dom.
 */
DynamicTemplate.prototype.insert = function (options) {
  options = options || {};

  if (this.isInserted)
    return;
  this.isInserted = true;

  var el = options.el || document.body;
  var $el = $(el);

  if ($el.length === 0)
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback.");

  if (!this.view)
    this.create(options);

  Blaze.render(this.view, $el[0], options.nextNode, options.parentView);

  return this;
};

/**
 * Reactively return the value of the current lookup host or null if there
 * is no lookup host.
 */
DynamicTemplate.prototype._getLookupHost = function () {
  // XXX this is called from the Blaze overrides so we can't create a dep
  // here for every single lookup. Will revisit.
  //this._lookupHostDep.depend();
  return this._lookupHostValue;
};

/**
 * Set the reactive value of the lookup host.
 *
 */
DynamicTemplate.prototype._setLookupHost = function (host) {
  var self = this;

  if (self._lookupHostValue !== host) {
    self._lookupHostValue = host;
    Deps.afterFlush(function () {
      // if the lookup host changes and the template also changes
      // before the next flush cycle, this gives the new template
      // a chance to render, and the old template to be torn off
      // the page (including stopping its computation) before the
      // lookupHostDep is changed.
      self._lookupHostDep.changed();
    });
  }

  return this;
};

/*****************************************************************************/
/* DynamicTemplate Static Methods */
/*****************************************************************************/

/**
 * Get the first parent data context that are not inclusion arguments
 * (see above function). Note: This function can create reactive dependencies.
 */
DynamicTemplate.getParentDataContext = function (view) {
  return DynamicTemplate.getDataContext(view && view.parentView);
};

/**
 * Get the first data context that is not inclusion arguments.
 */
DynamicTemplate.getDataContext = function (view) {
  while (view) {
    if (view.name === 'with' && !view.__isTemplateWith)
      return view.dataVar.get();
    else
      view = view.parentView;
  }

  return null;
};

/**
 * Get inclusion arguments, if any, from a view.
 *
 * Uses the __isTemplateWith property set when a parent view is used
 * specificially for a data context with inclusion args.
 *
 * Inclusion arguments are arguments provided in a template like this:
 * {{> yield "inclusionArg"}}
 * or
 * {{> yield region="inclusionArgValue"}}
 */
DynamicTemplate.getInclusionArguments = function (view) {
  var parent = view && view.parentView;

  if (!parent)
    return null;

  if (parent.__isTemplateWith)
    return parent.dataVar.get();

  return null;
};

/**
 * Given a view, return a function that can be used to access argument values at
 * the time the view was rendered. There are two key benefits:
 *
 * 1. Save the argument data at the time of rendering. When you use lookup(...)
 *    it starts from the current data context which can change.
 * 2. Defer creating a dependency on inclusion arguments until later.
 *
 * Example:
 *
 *   {{> MyTemplate template="MyTemplate"
 *   var args = DynamicTemplate.args(view);
 *   var tmplValue = args('template');
 *     => "MyTemplate"
 */
DynamicTemplate.args = function (view) {
  return function (key) {
    var data = DynamicTemplate.getInclusionArguments(view);

    if (data) {
      if (key)
        return data[key];
      else
        return data;
    }

    return null;
  };
};

/**
 * Inherit from DynamicTemplate.
 */
DynamicTemplate.extend = function (props) {
  return Iron.utils.extend(this, props);
};

DynamicTemplate.findFirstLookupHost = function (view) {
  var host;
  var helper;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");
  while (view) {
    if (view.__dynamicTemplate__) {
      // creates a reactive dependency.
      var host = view.__dynamicTemplate__._getLookupHost();
      if (host) return host;
    } else {
      view = view.parentView;
    }
  }

  return undefined;
};

DynamicTemplate.findLookupHostWithProperty = function (view, key) {
  var host;
  var prop;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");
  while (view) {
    if (view.__dynamicTemplate__) {

      // creates a reactive dependency
      var host = view.__dynamicTemplate__._getLookupHost();

      if (host && get(host, key)) {
        return host;
      }
    } 
    
    view = view.parentView;
  }

  return undefined;
};

/**
 * Find a lookup host that has a given helper and returns the host. Note,
 * this will create a reactive dependency on each dynamic template's getLookupHost
 * function. This is required becuase we need to rerun the entire lookup if
 * the host changes or is added or removed later, anywhere in the chain.
 */
DynamicTemplate.findLookupHostWithHelper = function (view, helperKey) {
  var host;
  var helper;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");
  while (view) {
    if (view.__dynamicTemplate__) {
      // creates a reactive dependency
      var host = view.__dynamicTemplate__._getLookupHost();
      if (host && get(host, 'constructor', '_helpers', helperKey)) {
        return host;
      }
    } 
    
    view = view.parentView;
  }

  return undefined;
};

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  UI.registerHelper('DynamicTemplate', new Template('DynamicTemplateHelper', function () {
    var args = DynamicTemplate.args(this);

    return new DynamicTemplate({
      data: function () { return args('data'); },
      template: function () { return args('template'); },
      content: this.templateContentBlock
    }).create();
  }));
}

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.DynamicTemplate = DynamicTemplate;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/iron_dynamic-template/blaze_overrides.js                                                              //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var assert = Iron.utils.assert;
var get = Iron.utils.get;

/*****************************************************************************/
/* Blaze Overrides */
/*****************************************************************************/
/**
 * Adds ability to inject lookup hosts into views that can participate in
 * property lookup. For example, iron:controller or iron:component could make
 * use of this to add methods into the lookup chain. If the property is found,
 * a function is returned that either returns the property value or the result
 * of calling the function (bound to the __lookupHost__).
 */
var origLookup = Blaze.View.prototype.lookup;
Blaze.View.prototype.lookup = function (name /*, args */) {
  var host;

  host = DynamicTemplate.findLookupHostWithHelper(Blaze.getView(), name);

  if (host) {
    return function callLookupHostHelper (/* args */) {
      var helper = get(host, 'constructor', '_helpers', name);
      var args = [].slice.call(arguments);
      return (typeof helper === 'function') ? helper.apply(host, args) : helper;
    }
  } else {
    return origLookup.apply(this, arguments);
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:dynamic-template'] = {};

})();
