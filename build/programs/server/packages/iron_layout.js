(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Iron = Package['iron:core'].Iron;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var findFirstLayout, Layout, DEFAULT_REGION;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/iron_layout/version_conflict_errors.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var errors = [];

if (Package['cmather:iron-layout']) {
  errors.push("\n\n\
    The cmather:iron-{x} packages were migrated to the new package system with the wrong name, and you have duplicate copies.\n\
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

// If the user still has blaze-layout throw  an error. Let's get rid of that
// package so it's not lingering around with all its nastiness.
if (Package['cmather:blaze-layout']) {
  errors.push(
    "The blaze-layout package has been replaced by iron-layout. Please remove the package like this:\n> meteor remove cmather:blaze-layout\n"
  );
}

if (errors.length > 0) {
  throw new Error("Sorry! Looks like there's a few errors related to iron:layout\n\n" + errors.join("\n\n"));
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/iron_layout/layout.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var DynamicTemplate = Iron.DynamicTemplate;
var inherits = Iron.utils.inherits;

/*****************************************************************************/
/* Helpers */
/*****************************************************************************/
/**
 * Find the first Layout in the rendered parent hierarchy.
 */
findFirstLayout = function (view) {
  while (view) {
    if (view.name === 'Iron.Layout')
      return view.__dynamicTemplate__;
    else
      view = view.parentView;
  }

  return null;
};

/*****************************************************************************/
/* Layout */
/*****************************************************************************/

/**
 * Dynamically render templates into regions.
 *
 * Layout inherits from Iron.DynamicTemplate and provides the ability to create
 * regions that a user can render templates or content blocks into. The layout
 * and each region is an instance of DynamicTemplate so the template and data
 * contexts are completely dynamic and programmable in javascript.
 */
Layout = function (options) {
  var self = this;

  Layout.__super__.constructor.apply(this, arguments);

  options = options || {};
  this.name = 'Iron.Layout';
  this._regions = {};
  this._regionHooks = {};
  this.defaultTemplate('__IronDefaultLayout__');

  // if there's block content then render that
  // to the main region
  if (options.content)
    this.render(options.content);
};

/**
 * The default region for a layout where the main content will go.
 */
DEFAULT_REGION = Layout.DEFAULT_REGION = 'main';

/**
 * Inherits from Iron.DynamicTemplate which gives us the ability to set the
 * template and data context dynamically.
 */
inherits(Layout, Iron.DynamicTemplate);

/**
 * Return the DynamicTemplate instance for a given region. If the region doesn't
 * exist it is created.
 *
 * The regions object looks like this:
 *
 *  {
 *    "main": DynamicTemplate,
 *    "footer": DynamicTemplate,
 *    .
 *    .
 *    .
 *  }
 */
Layout.prototype.region = function (name, options) {
  return this._ensureRegion(name, options);
};

/**
 * Destroy all child regions and reset the regions map.
 */
Layout.prototype.destroyRegions = function () {
  _.each(this._regions, function (dynamicTemplate) {
    dynamicTemplate.destroy();
  });

  this._regions = {};
};

/**
 * Set the template for a region.
 */
Layout.prototype.render = function (template, options) {
  // having options is usually good
  options = options || {};

  // let the user specify the region to render the template into
  var region = options.to || options.region || DEFAULT_REGION;

  // get the DynamicTemplate for this region
  var dynamicTemplate = this.region(region);

  // if we're in a rendering transaction, track that we've rendered this
  // particular region
  this._trackRenderedRegion(region);

  // set the template value for the dynamic template
  dynamicTemplate.template(template);

  // set the data for the region. If options.data is not defined, this will 
  // clear the data, which is what we want
  dynamicTemplate.data(options.data);
};

/**
 * Returns true if the given region is defined and false otherwise.
 */
Layout.prototype.has = function (region) {
  region = region || Layout.DEFAULT_REGION;
  return !!this._regions[region];
};

/**
 * Returns an array of region keys.
 */
Layout.prototype.regionKeys = function () {
  return _.keys(this._regions);
};

/**
 * Clear a given region or the "main" region by default.
 */
Layout.prototype.clear = function (region) {
  region = region || Layout.DEFAULT_REGION;

  // we don't want to create a region if it didn't exist before
  if (this.has(region))
    this.region(region).template(null);

  // chain it up
  return this;
};

/**
 * Clear all regions.
 */
Layout.prototype.clearAll = function () {
  _.each(this._regions, function (dynamicTemplate) {
    dynamicTemplate.template(null);
  });

  // chain it up
  return this;
};

/**
 * Start tracking rendered regions.
 */
Layout.prototype.beginRendering = function (onComplete) {
  var self = this;
  if (this._finishRenderingTransaction)
    this._finishRenderingTransaction();

  this._finishRenderingTransaction = _.once(function () {
    var regions = self._endRendering({flush: false});
    onComplete && onComplete(regions);
  });

  Deps.afterFlush(this._finishRenderingTransaction);

  if (this._renderedRegions)
    throw new Error("You called beginRendering again before calling endRendering");
  this._renderedRegions = {};
};

/**
 * Track a rendered region if we're in a transaction.
 */
Layout.prototype._trackRenderedRegion = function (region) {
  if (!this._renderedRegions)
    return;
  this._renderedRegions[region] = true;
};

/**
 * Stop a rendering transaction and retrieve the rendered regions. This
 * shouldn't be called directly. Instead, pass an onComplete callback to the
 * beginRendering method.
 */
Layout.prototype._endRendering = function (opts) {
  // we flush here to ensure all of the {{#contentFor}} inclusions have had a
  // chance to render from our templates, otherwise we'll never know about
  // them. 
  opts = opts || {};
  if (opts.flush !== false)
    Deps.flush();
  var renderedRegions = this._renderedRegions || {};
  this._renderedRegions = null;
  return _.keys(renderedRegions);
};

/**
 * View lifecycle hooks for regions.
 */
_.each(
  [
    'onRegionCreated',
    'onRegionRendered',
    'onRegionDestroyed'
  ],
  function (hook) {
    Layout.prototype[hook] = function (cb) {
      var hooks = this._regionHooks[hook] = this._regionHooks[hook] || [];
      hooks.push(cb);
      return this;
    }
  }
);

/**
 * Returns the DynamicTemplate for a given region or creates it if it doesn't
 * exists yet.
 */
Layout.prototype._ensureRegion = function (name, options) {
 return this._regions[name] = this._regions[name] || this._createDynamicTemplate(name, options);
};

/**
 * Create a new DynamicTemplate instance.
 */
Layout.prototype._createDynamicTemplate = function (name, options) {
  var self = this;
  var tmpl = new Iron.DynamicTemplate(options);
  var capitalize = Iron.utils.capitalize;
  tmpl._region = name;

  _.each(['viewCreated', 'viewReady', 'viewDestroyed'], function (hook) {
    hook = capitalize(hook);
    tmpl['on' + hook](function (dynamicTemplate) {
      // "this" is the view instance
      var view = this;
      var regionHook = ({
        viewCreated: "regionCreated",
        viewReady: "regionRendered",
        viewDestroyed: "regionDestroyed"
      })[hook];
      self._runRegionHooks('on' + regionHook, view, dynamicTemplate);
    });
  });

  return tmpl;
};

Layout.prototype._runRegionHooks = function (name, regionView, regionDynamicTemplate) {
  var layout = this;
  var hooks = this._regionHooks[name] || [];
  var hook;

  for (var i = 0; i < hooks.length; i++) {
    hook = hooks[i];
    // keep the "thisArg" pointing to the view, but make the first parameter to
    // the callback teh dynamic template instance.
    hook.call(regionView, regionDynamicTemplate.region, regionDynamicTemplate, this);
  }
};

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  /**
   * Create a region in the closest layout ancestor.
   *
   * Examples:
   *    <aside>
   *      {{> yield "aside"}}
   *    </aside>
   *
   *    <article>
   *      {{> yield}}
   *    </article>
   *
   *    <footer>
   *      {{> yield "footer"}}
   *    </footer>
   */
  UI.registerHelper('yield', new Template('yield', function () {
    var layout = findFirstLayout(this);

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use yield!");

    // Example options: {{> yield region="footer"}} or {{> yield "footer"}}
    var options = DynamicTemplate.getInclusionArguments(this);
    var region;
    var dynamicTemplate;

    if (_.isString(options)) {
      region = options;
    } else if (_.isObject(options)) {
      region = options.region;
    }

    // if there's no region specified we'll assume you meant the main region
    region = region || DEFAULT_REGION;

    // get or create the region
    dynamicTemplate = layout.region(region);

    // if the dynamicTemplate had already been inserted, let's
    // destroy it before creating a new one.
    if (dynamicTemplate.isCreated)
      dynamicTemplate.destroy();

    // now return a newly created view
    return dynamicTemplate.create();
  }));

  /**
   * Render a template into a region in the closest layout ancestor from within
   * your template markup.
   *
   * Examples:
   *
   *  {{#contentFor "footer"}}
   *    Footer stuff
   *  {{/contentFor}}
   *
   *  {{> contentFor region="footer" template="SomeTemplate" data=someData}}
   *
   * Note: The helper is a UI.Component object instead of a function so that
   * Meteor UI does not create a Deps.Dependency.
   *
   * XXX what happens if the parent that calls contentFor gets destroyed?
   * XXX the layout.region should be reset to be empty?
   * XXX but how do we control order of setting the region? what if it gets destroyed but then something else sets it?
   *
   */
  UI.registerHelper('contentFor', new Template('contentFor', function () {
    var layout = findFirstLayout(this);

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use contentFor!");

    var options = DynamicTemplate.getInclusionArguments(this) || {}
    var content = this.templateContentBlock;
    var template = options.template;
    var data = options.data;
    var region;

    if (_.isString(options))
      region = options;
    else if (_.isObject(options))
      region = options.region;
    else
      throw new Error("Which region is this contentFor block supposed to be for?");

    // set the region to a provided template or the content directly.
    layout.region(region).template(template || content);

    // tell the layout to track this as a rendered region if we're in a
    // rendering transaction.
    layout._trackRenderedRegion(region);

    // if we have some data then set the data context
    if (data)
      layout.region(region).data(data);

    // just render nothing into this area of the page since the dynamic template
    // will do the actual rendering into the right region.
    return null;
  }));

  /**
   * Check to see if a given region is currently rendered to.
   *
   * Example:
   *    {{#if hasRegion 'aside'}}
   *      <aside>
   *        {{> yield "aside"}}
   *      </aside>
   *    {{/if}}
   */
  UI.registerHelper('hasRegion', function (region) {
    var layout = findFirstLayout(Blaze.getView());

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use hasRegion!");
    
    if (!_.isString(region))
      throw new Error("You need to provide an region argument to hasRegion");
    
    return !! layout.region(region).template();
  });

  /**
   * Let people use Layout directly from their templates!
   *
   * Example:
   *  {{#Layout template="MyTemplate"}}
   *    Main content goes here
   *
   *    {{#contentFor "footer"}}
   *      footer goes here
   *    {{/contentFor}}
   *  {{/Layout}}
   */
  UI.registerHelper('Layout', new Template('layout', function () {
    var args = Iron.DynamicTemplate.args(this);

    var layout = new Layout({
      template: function () { return args('template'); },
      data: function () { return args('data'); },
      content: this.templateContentBlock
    });

    return layout.create();
  }));
}
/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Layout = Layout;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:layout'] = {};

})();
