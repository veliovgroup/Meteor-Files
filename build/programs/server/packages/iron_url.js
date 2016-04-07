(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var Iron = Package['iron:core'].Iron;

/* Package-scope variables */
var compilePath, Url;

(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/iron_url/lib/compiler.js                                                                        //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
/*
Based on https://github.com/pillarjs/path-to-regexp

The MIT License (MIT)

Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var typeOf = function (o) { return Object.prototype.toString.call(o); };

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match already escaped characters that would otherwise incorrectly appear
  // in future matches. This allows the user to escape special characters that
  // shouldn't be transformed.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
  // Match regexp special characters that should always be escaped.
  '([.+*?=^!:${}()[\\]|\\/])'
].join('|'), 'g');

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1');
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
var attachKeys = function (re, keys) {
  re.keys = keys;

  return re;
};

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array should be passed in, which will contain the placeholder key
 * names. For example `/user/:id` will then contain `["id"]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 keys
 * @param  {Object}                options
 * @return {RegExp}
 */
function pathtoRegexp (path, keys, options) {
  if (keys && typeOf(keys) !== '[object Array]') {
    options = keys;
    keys = null;
  }

  keys = keys || [];
  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var flags = options.sensitive ? '' : 'i';
  var index = 0;

  if (path instanceof RegExp) {
    // Match all capturing groups of a regexp.
    var groups = path.source.match(/\((?!\?)/g) || [];

    // Map all the matches to their numeric keys and push into the keys.
    keys.push.apply(keys, groups.map(function (match, index) {
      return {
        name:      index,
        delimiter: null,
        optional:  false,
        repeat:    false
      };
    }));

    // Return the source back to the user.
    return attachKeys(path, keys);
  }

  if (typeOf(path) === '[object Array]') {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    path = path.map(function (value) {
      return pathtoRegexp(value, keys, options).source;
    });

    // Generate a new regexp instance by joining all the parts together.
    return attachKeys(new RegExp('(?:' + path.join('|') + ')', flags), keys);
  }

  // Alter the path string into a usable regexp.
  path = path.replace(PATH_REGEXP, function (match, escaped, prefix, key, capture, group, suffix, escape) {
    // Avoiding re-escaping escaped characters.
    if (escaped) {
      return escaped;
    }

    // Escape regexp special characters.
    if (escape) {
      return '\\' + escape;
    }

    var repeat   = suffix === '+' || suffix === '*';
    var optional = suffix === '?' || suffix === '*';

    keys.push({
      name:      key || index++,
      delimiter: prefix || '/',
      optional:  optional,
      repeat:    repeat
    });

    // Escape the prefix character.
    prefix = prefix ? '\\' + prefix : '';

    // Match using the custom capturing group, or fallback to capturing
    // everything up to the next slash (or next period if the param was
    // prefixed with a period).
    capture = escapeGroup(capture || group || '[^' + (prefix || '\\/') + ']+?');

    // Allow parameters to be repeated more than once.
    if (repeat) {
      capture = capture + '(?:' + prefix + capture + ')*';
    }

    // Allow a parameter to be optional.
    if (optional) {
      return '(?:' + prefix + '(' + capture + '))?';
    }

    // Basic parameter support.
    return prefix + '(' + capture + ')';
  });

  // Check whether the path ends in a slash as it alters some match behaviour.
  var endsWithSlash = path[path.length - 1] === '/';

  // In non-strict mode we allow an optional trailing slash in the match. If
  // the path to match already ended with a slash, we need to remove it for
  // consistency. The slash is only valid at the very end of a path match, not
  // anywhere in the middle. This is important for non-ending mode, otherwise
  // "/test/" will match "/test//route".
  if (!strict) {
    path = (endsWithSlash ? path.slice(0, -2) : path) + '(?:\\/(?=$))?';
  }

  // In non-ending mode, we need prompt the capturing groups to match as much
  // as possible by using a positive lookahead for the end or next path segment.
  if (!end) {
    path += strict && endsWithSlash ? '' : '(?=\\/|$)';
  }

  return attachKeys(new RegExp('^' + path + (end ? '$' : ''), flags), keys);
};

compilePath = pathtoRegexp;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/iron_url/lib/url.js                                                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var warn = Iron.utils.warn;

/*****************************************************************************/
/* Url */
/*****************************************************************************/
function safeDecodeURIComponent (val) {
  try {
    return decodeURIComponent(val.replace(/\+/g, ' '));
  } catch (e) {
    if (e.constructor == URIError) {
      warn("Tried to decode an invalid URI component: " + JSON.stringify(val) + " " + e.stack);
    }

    return undefined;
  }
}

function safeDecodeURI (val) {
  try {
    return decodeURI(val.replace(/\+/g, ' '));
  } catch (e) {
    if (e.constructor == URIError) {
      warn("Tried to decode an invalid URI: " + JSON.stringify(val) + " " + e.stack);
    }

    return undefined;
  }
}

/**
 * Url utilities and the ability to compile a url into a regular expression.
 */
Url = function (url, options) {
  options = options || {};
  this.options = options;
  this.keys = [];
  this.regexp = compilePath(url, this.keys, options);
  this._originalPath = url;
  _.extend(this, Url.parse(url));
};

/**
 * Given a relative or absolute path return
 * a relative path with a leading forward slash and
 * no search string or hash fragment
 *
 * @param {String} path
 * @return {String}
 */
Url.normalize = function (url) {
  if (url instanceof RegExp)
    return url;
  else if (typeof url !== 'string')
    return '/';

  var parts = Url.parse(url);
  var pathname = parts.pathname;

  if (pathname.charAt(0) !== '/')
    pathname = '/' + pathname;

  if (pathname.length > 1 && pathname.charAt(pathname.length - 1) === '/') {
    pathname = pathname.slice(0, pathname.length - 1);
  }

  return pathname;
};

/**
 * Returns true if both a and b are of the same origin.
 */
Url.isSameOrigin = function (a, b) {
  var aParts = Url.parse(a);
  var bParts = Url.parse(b);
  var result = aParts.origin === bParts.origin;
  return result;
};

/**
 * Given a query string return an object of key value pairs.
 *
 * "?p1=value1&p2=value2 => {p1: value1, p2: value2}
 */
Url.fromQueryString = function (query) {
  if (!query)
    return {};

  if (typeof query !== 'string')
    throw new Error("expected string");

  // get rid of the leading question mark
  if (query.charAt(0) === '?')
    query = query.slice(1);

  var keyValuePairs = query.split('&');
  var result = {};
  var parts;

  _.each(keyValuePairs, function (pair) {
    var parts = pair.split('=');
    var key = parts[0];
    var value = safeDecodeURIComponent(parts[1]);

    if (key.slice(-2) === '[]') {
      key = key.slice(0, -2);
      result[key] = result[key] || [];
      result[key].push(value);
    } else {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Given a query object return a query string.
 */
Url.toQueryString = function (queryObject) {
  var result = [];

  if (typeof queryObject === 'string') {
    if (queryObject.charAt(0) !== '?')
      return '?' + queryObject;
    else
      return queryObject;
  }

  _.each(queryObject, function (value, key) {
    if (_.isArray(value)) {
      _.each(value, function(valuePart) {
        result.push(encodeURIComponent(key) + '[]=' + encodeURIComponent(valuePart));
      });
    } else {
      result.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  });

  // no sense in adding a pointless question mark
  if (result.length > 0)
    return '?' + result.join('&');
  else
    return '';
};

/**
 * Given a string url return an object with all of the url parts.
 */
Url.parse = function (url) {
  if (typeof url !== 'string')
    return {};

  //http://tools.ietf.org/html/rfc3986#page-50
  //http://www.rfc-editor.org/errata_search.php?rfc=3986
  var re = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

  var match = url.match(re);

  var protocol = match[1] ? match[1].toLowerCase() : undefined;
  var hostWithSlashes = match[3];
  var slashes = !!hostWithSlashes;
  var hostWithAuth= match[4] ? match[4].toLowerCase() : undefined;
  var hostWithAuthParts = hostWithAuth ? hostWithAuth.split('@') : [];

  var host, auth;

  if (hostWithAuthParts.length == 2) {
    auth = hostWithAuthParts[0];
    host = hostWithAuthParts[1];
  } else if (hostWithAuthParts.length == 1) {
    host = hostWithAuthParts[0];
    auth = undefined;
  } else {
    host = undefined;
    auth = undefined;
  }

  var hostWithPortParts = (host && host.split(':')) || [];
  var hostname = hostWithPortParts[0];
  var port = hostWithPortParts[1];
  var origin = (protocol && host) ? protocol + '//' + host : undefined;
  var pathname = match[5];
  var hash = match[8];
  var originalUrl = url;

  var search = match[6];

  var query;
  var indexOfSearch = (hash && hash.indexOf('?')) || -1;

  // if we found a search string in the hash and there is no explicit search
  // string
  if (~indexOfSearch && !search) {
    search = hash.slice(indexOfSearch);
    hash = hash.substr(0, indexOfSearch);
    // get rid of the ? character
    query = search.slice(1);
  } else {
    query = match[7];
  }

  var path = pathname + (search || '');
  var queryObject = Url.fromQueryString(query);

  var rootUrl = [
    protocol || '',
    slashes ? '//' : '',
    hostWithAuth || ''
  ].join('');

  var href = [
    protocol || '',
    slashes ? '//' : '',
    hostWithAuth || '',
    pathname || '',
    search || '',
    hash || ''
  ].join('');

  return {
    rootUrl: rootUrl || '',
    originalUrl: url || '',
    href: href || '',
    protocol: protocol || '',
    auth: auth || '',
    host: host || '',
    hostname: hostname || '',
    port: port || '',
    origin: origin || '',
    path: path || '',
    pathname: pathname || '',
    search: search || '',
    query: query || '',
    queryObject: queryObject || '',
    hash: hash || '',
    slashes: slashes
  };
};

/**
 * Returns true if the path matches and false otherwise.
 */
Url.prototype.test = function (path) {
  return this.regexp.test(Url.normalize(path));
};

/**
 * Returns the result of calling exec on the compiled path with
 * the given path.
 */
Url.prototype.exec = function (path) {
  return this.regexp.exec(Url.normalize(path));
};

/**
 * Returns an array of parameters given a path. The array may have named
 * properties in addition to indexed values.
 */
Url.prototype.params = function (path) {
  if (!path)
    return [];

  var params = [];
  var m = this.exec(path);
  var queryString;
  var keys = this.keys;
  var key;
  var value;

  if (!m)
    throw new Error('The route named "' + this.name + '" does not match the path "' + path + '"');

  for (var i = 1, len = m.length; i < len; ++i) {
    key = keys[i - 1];
    value = typeof m[i] == 'string' ? safeDecodeURIComponent(m[i]) : m[i];
    if (key) {
      params[key.name] = params[key.name] !== undefined ?
        params[key.name] : value;
    } else
      params.push(value);
  }

  path = safeDecodeURI(path);

  if (typeof path !== 'undefined') {
    queryString = path.split('?')[1];
    if (queryString)
      queryString = queryString.split('#')[0];

    params.hash = path.split('#')[1] || null;
    params.query = Url.fromQueryString(queryString);
  }

  return params;
};

Url.prototype.resolve = function (params, options) {
  var value;
  var isValueDefined;
  var result;
  var wildCardCount = 0;
  var path = this._originalPath;
  var hash;
  var query;
  var missingParams = [];
  var originalParams = params;

  options = options || {};
  params = params || [];
  query = options.query;
  hash = options.hash && options.hash.toString();

  if (path instanceof RegExp) {
    throw new Error('Cannot currently resolve a regular expression path');
  } else {
    path = path
      .replace(
        /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g,
        function (match, slash, format, key, capture, optional, offset) {
          slash = slash || '';
          format = format || '';
          value = params[key];
          isValueDefined = typeof value !== 'undefined';

          if (optional && !isValueDefined) {
            value = '';
          } else if (!isValueDefined) {
            missingParams.push(key);
            return;
          }

          value = _.isFunction(value) ? value.call(params) : value;
          var escapedValue = _.map(String(value).split('/'), function (segment) {
            return encodeURIComponent(segment);
          }).join('/');
          return slash + format + escapedValue;
        }
      )
      .replace(
        /\*/g,
        function (match) {
          if (typeof params[wildCardCount] === 'undefined') {
            throw new Error(
              'You are trying to access a wild card parameter at index ' +
              wildCardCount +
              ' but the value of params at that index is undefined');
          }

          var paramValue = String(params[wildCardCount++]);
          return _.map(paramValue.split('/'), function (segment) {
            return encodeURIComponent(segment);
          }).join('/');
        }
      );

    query = Url.toQueryString(query);

    path = path + query;

    if (hash) {
      hash = encodeURI(hash.replace('#', ''));
      path = path + '#' + hash;
    }
  }

  // Because of optional possibly empty segments we normalize path here
  path = path.replace(/\/+/g, '/'); // Multiple / -> one /
  path = path.replace(/^(.+)\/$/g, '$1'); // Removal of trailing /

  if (missingParams.length == 0)
    return path;
  else if (options.throwOnMissingParams === true)
    throw new Error("Missing required parameters on path " + JSON.stringify(this._originalPath) + ". The missing params are: " + JSON.stringify(missingParams) + ". The params object passed in was: " + JSON.stringify(originalParams) + ".");
  else
    return null;
};

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Url = Url;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:url'] = {};

})();
