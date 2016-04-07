(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;

/* Package-scope variables */
var __coffeescriptShare, Cookies;

(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/ostrio_cookies/cookies.coffee.js                                                                        //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
                                                                                                                    // 1
/*                                                                                                                  // 1
@url https://github.com/jshttp/cookie/blob/master/index.js                                                          //
@name cookie                                                                                                        //
@author jshttp                                                                                                      //
@license                                                                                                            //
(The MIT License)                                                                                                   //
                                                                                                                    //
Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>                                                         //
Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>                                              //
                                                                                                                    //
Permission is hereby granted, free of charge, to any person obtaining                                               //
a copy of this software and associated documentation files (the                                                     //
'Software'), to deal in the Software without restriction, including                                                 //
without limitation the rights to use, copy, modify, merge, publish,                                                 //
distribute, sublicense, and/or sell copies of the Software, and to                                                  //
permit persons to whom the Software is furnished to do so, subject to                                               //
the following conditions:                                                                                           //
                                                                                                                    //
The above copyright notice and this permission notice shall be                                                      //
included in all copies or substantial portions of the Software.                                                     //
                                                                                                                    //
THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,                                                     //
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF                                                  //
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.                                              //
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY                                                //
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,                                                //
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE                                                   //
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                                                              //
 */                                                                                                                 //
var __cookies, __middlewareHandler, decode, encode, fieldContentRegExp, pairSplitRegExp, parse, serialize, tryDecode,         
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;                                                                                      //
                                                                                                                    //
decode = decodeURIComponent;                                                                                        // 1
                                                                                                                    //
encode = encodeURIComponent;                                                                                        // 1
                                                                                                                    //
pairSplitRegExp = /; */;                                                                                            // 1
                                                                                                                    //
                                                                                                                    // 35
/*                                                                                                                  // 35
RegExp to match field-content in RFC 7230 sec 3.2                                                                   //
                                                                                                                    //
field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]                                                         //
field-vchar   = VCHAR / obs-text                                                                                    //
obs-text      = %x80-FF                                                                                             //
 */                                                                                                                 //
                                                                                                                    //
fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;                                                       // 1
                                                                                                                    //
                                                                                                                    // 44
/*                                                                                                                  // 44
@param {String} str                                                                                                 //
@param {Object} [options]                                                                                           //
@return {Object}                                                                                                    //
@description                                                                                                        //
Parse a cookie header.                                                                                              //
Parse the given cookie header string into an object                                                                 //
The object has the various cookies as keys(names) => values                                                         //
@private                                                                                                            //
 */                                                                                                                 //
                                                                                                                    //
parse = function(str, options) {                                                                                    // 1
  var dec, obj, opt, pairs;                                                                                         // 56
  if (typeof str !== 'string') {                                                                                    // 56
    throw new TypeError('argument str must be a string');                                                           // 57
  }                                                                                                                 //
  obj = {};                                                                                                         // 56
  opt = options || {};                                                                                              // 56
  pairs = str.split(pairSplitRegExp);                                                                               // 56
  dec = opt.decode || decode;                                                                                       // 56
  pairs.forEach(function(pair) {                                                                                    // 56
    var eq_idx, key, val;                                                                                           // 63
    eq_idx = pair.indexOf('=');                                                                                     // 63
    if (eq_idx < 0) {                                                                                               // 65
      return;                                                                                                       // 66
    }                                                                                                               //
    key = pair.substr(0, eq_idx).trim();                                                                            // 63
    val = pair.substr(++eq_idx, pair.length).trim();                                                                // 63
    if ('"' === val[0]) {                                                                                           // 70
      val = val.slice(1, -1);                                                                                       // 71
    }                                                                                                               //
    if (void 0 === obj[key]) {                                                                                      // 73
      obj[key] = tryDecode(val, dec);                                                                               // 74
    }                                                                                                               //
  });                                                                                                               //
  return obj;                                                                                                       //
};                                                                                                                  // 55
                                                                                                                    //
                                                                                                                    // 78
/*                                                                                                                  // 78
@param {String} name                                                                                                //
@param {String} val                                                                                                 //
@param {Object} [options]                                                                                           //
@return {String}                                                                                                    //
@description                                                                                                        //
Serialize data into a cookie header.                                                                                //
Serialize the a name value pair into a cookie string suitable for                                                   //
http headers. An optional options object specified cookie parameters.                                               //
serialize('foo', 'bar', { httpOnly: true })                                                                         //
  => "foo=bar; httpOnly"                                                                                            //
@private                                                                                                            //
 */                                                                                                                 //
                                                                                                                    //
serialize = function(name, val, options) {                                                                          // 1
  var enc, maxAge, opt, pairs, value;                                                                               // 93
  opt = options || {};                                                                                              // 93
  enc = opt.encode || encode;                                                                                       // 93
  if (!fieldContentRegExp.test(name)) {                                                                             // 95
    throw new TypeError('argument name is invalid');                                                                // 96
  }                                                                                                                 //
  if (val) {                                                                                                        // 97
    value = enc(val);                                                                                               // 98
    if (value && !fieldContentRegExp.test(value)) {                                                                 // 99
      throw new TypeError('argument val is invalid');                                                               // 100
    }                                                                                                               //
  } else {                                                                                                          //
    value = '';                                                                                                     // 102
  }                                                                                                                 //
  pairs = [name + '=' + value];                                                                                     // 93
  if (opt.maxAge) {                                                                                                 // 104
    maxAge = opt.maxAge - 0;                                                                                        // 105
    if (isNaN(maxAge)) {                                                                                            // 106
      throw new Error('maxAge should be a Number');                                                                 // 107
    }                                                                                                               //
    pairs.push('Max-Age=' + maxAge);                                                                                // 105
  }                                                                                                                 //
  if (opt.domain) {                                                                                                 // 109
    if (!fieldContentRegExp.test(opt.domain)) {                                                                     // 110
      throw new TypeError('option domain is invalid');                                                              // 111
    }                                                                                                               //
    pairs.push('Domain=' + opt.domain);                                                                             // 110
  } else {                                                                                                          //
    pairs.push('Domain=');                                                                                          // 114
  }                                                                                                                 //
  if (opt.path) {                                                                                                   // 115
    if (!fieldContentRegExp.test(opt.path)) {                                                                       // 116
      throw new TypeError('option path is invalid');                                                                // 117
    }                                                                                                               //
    pairs.push('Path=' + opt.path);                                                                                 // 116
  } else {                                                                                                          //
    pairs.push('Path=/');                                                                                           // 120
  }                                                                                                                 //
  opt.expires = opt.expires || opt.expire;                                                                          // 93
  if (opt.expires) {                                                                                                // 122
    if (opt.expires === Infinity) {                                                                                 // 123
      pair.push('Expires=Fri, 31 Dec 9999 23:59:59 GMT');                                                           // 124
    } else if (opt.expires instanceof Date) {                                                                       //
      pairs.push('Expires=' + opt.expires.toUTCString());                                                           // 126
    } else if (_.isNumber(opt.expires)) {                                                                           //
      pairs.push('Expires=' + (new Date(opt.expires)).toUTCString());                                               // 128
    }                                                                                                               //
  }                                                                                                                 //
  if (opt.httpOnly) {                                                                                               // 129
    pairs.push('HttpOnly');                                                                                         // 130
  }                                                                                                                 //
  if (opt.secure) {                                                                                                 // 131
    pairs.push('Secure');                                                                                           // 132
  }                                                                                                                 //
  if (opt.firstPartyOnly) {                                                                                         // 133
    pairs.push('First-Party-Only');                                                                                 // 134
  }                                                                                                                 //
  return pairs.join('; ');                                                                                          //
};                                                                                                                  // 92
                                                                                                                    //
                                                                                                                    // 137
/*                                                                                                                  // 137
@param {String} str                                                                                                 //
@param {Function} decode                                                                                            //
@description Try decoding a string using a decoding function.                                                       //
@private                                                                                                            //
 */                                                                                                                 //
                                                                                                                    //
tryDecode = function(str, decode) {                                                                                 // 1
  var e;                                                                                                            // 144
  try {                                                                                                             // 144
    return decode(str);                                                                                             // 145
  } catch (_error) {                                                                                                //
    e = _error;                                                                                                     // 147
    return str;                                                                                                     // 147
  }                                                                                                                 //
};                                                                                                                  // 143
                                                                                                                    //
__cookies = (function() {                                                                                           // 1
  function __cookies(_cookies, collection, TTL, runOnServer, response) {                                            // 151
    this.collection = collection;                                                                                   // 152
    this.TTL = TTL;                                                                                                 // 152
    this.runOnServer = runOnServer;                                                                                 // 152
    this.response = response;                                                                                       // 152
    if (_.isObject(_cookies)) {                                                                                     // 152
      this.cookies = _cookies;                                                                                      // 153
    } else {                                                                                                        //
      this.cookies = parse(_cookies);                                                                               // 155
    }                                                                                                               //
  }                                                                                                                 //
                                                                                                                    //
                                                                                                                    // 157
  /*                                                                                                                // 157
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name get                                                                                                         //
  @param {String} key  - The name of the cookie to read                                                             //
  @param {String} _tmp - Unparsed string instead of user's cookies                                                  //
  @description Read a cookie. If the cookie doesn't exist a null value will be returned.                            //
  @returns {String|null}                                                                                            //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.get = function(key, _tmp) {                                                                   // 151
    var _cs;                                                                                                        // 167
    _cs = _tmp ? parse(_tmp) : this.cookies;                                                                        // 167
    if (!key || !_cs) {                                                                                             // 169
      return null;                                                                                                  //
    } else {                                                                                                        //
      if (_cs != null ? _cs[key] : void 0) {                                                                        // 172
        return _cs[key];                                                                                            //
      } else {                                                                                                      //
        return null;                                                                                                //
      }                                                                                                             //
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
                                                                                                                    // 174
  /*                                                                                                                // 174
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name set                                                                                                         //
  @param {String}  key          - The name of the cookie to create/overwrite                                        //
  @param {String}  value        - The value of the cookie                                                           //
  @param {Number}  opts.expires - [Optional] The max-age in seconds (e.g. 31536e3                                   //
  for a year, Infinity for a never-expires cookie), or the expires date in                                          //
  GMTString format or as Date object; if not specified the cookie will                                              //
  expire at the end of session (number – finite or Infinity – string, Date object or null).                         //
  @param {String}  opts.path    - [Optional] The path from where the cookie will be                                 //
  readable. E.g., "/", "/mydir"; if not specified, defaults to the current                                          //
  path of the current document location (string or null). The path must be                                          //
  absolute (see RFC 2965). For more information on how to use relative paths                                        //
  in this argument, see: https://developer.mozilla.org/en-US/docs/Web/API/document.cookie#Using_relative_URLs_in_the_path_parameter
  @param {String}  opts.domain   - [Optional] The domain from where the cookie will                                 //
  be readable. E.g., "example.com", ".example.com" (includes all subdomains)                                        //
  or "subdomain.example.com"; if not specified, defaults to the host portion                                        //
  of the current document location (string or null).                                                                //
  @param {Boolean} opts.secure  - [Optional] The cookie will be transmitted only                                    //
  over secure protocol as https (boolean or null).                                                                  //
  @description Create/overwrite a cookie.                                                                           //
  @returns {Boolean}                                                                                                //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.set = function(key, value, opts) {                                                            // 151
    var newCookie;                                                                                                  // 199
    if (opts == null) {                                                                                             //
      opts = {};                                                                                                    //
    }                                                                                                               //
    if (key && value) {                                                                                             // 199
      if (opts.expires == null) {                                                                                   //
        opts.expires = new Date((+(new Date)) + this.TTL);                                                          //
      }                                                                                                             //
      if (opts.path == null) {                                                                                      //
        opts.path = '/';                                                                                            //
      }                                                                                                             //
      if (opts.domain == null) {                                                                                    //
        opts.domain = '';                                                                                           //
      }                                                                                                             //
      if (opts.secure == null) {                                                                                    //
        opts.secure = '';                                                                                           //
      }                                                                                                             //
      newCookie = serialize(key, value, opts);                                                                      // 200
      this.cookies[key] = value;                                                                                    // 200
      if (Meteor.isClient) {                                                                                        // 208
        document.cookie = newCookie;                                                                                // 209
      } else {                                                                                                      //
        this.response.setHeader('Set-Cookie', newCookie);                                                           // 211
      }                                                                                                             //
      return true;                                                                                                  //
    } else {                                                                                                        //
      return false;                                                                                                 //
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
                                                                                                                    // 216
  /*                                                                                                                // 216
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name remove                                                                                                      //
  @param {String} key    - The name of the cookie to create/overwrite                                               //
  @param {String} path   - [Optional] The path from where the cookie will be                                        //
  readable. E.g., "/", "/mydir"; if not specified, defaults to the current                                          //
  path of the current document location (string or null). The path must be                                          //
  absolute (see RFC 2965). For more information on how to use relative paths                                        //
  in this argument, see: https://developer.mozilla.org/en-US/docs/Web/API/document.cookie#Using_relative_URLs_in_the_path_parameter
  @param {String} domain - [Optional] The domain from where the cookie will                                         //
  be readable. E.g., "example.com", ".example.com" (includes all subdomains)                                        //
  or "subdomain.example.com"; if not specified, defaults to the host portion                                        //
  of the current document location (string or null).                                                                //
  @description Remove a cookie(s).                                                                                  //
  @returns {Boolean}                                                                                                //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.remove = function(key, path, domain) {                                                        // 151
    var i, k, len, newCookie, ref;                                                                                  // 234
    if (path == null) {                                                                                             //
      path = '/';                                                                                                   //
    }                                                                                                               //
    if (domain == null) {                                                                                           //
      domain = '';                                                                                                  //
    }                                                                                                               //
    if (key) {                                                                                                      // 234
      newCookie = serialize(key, '', {                                                                              // 235
        domain: domain,                                                                                             // 235
        path: path,                                                                                                 // 235
        expires: new Date(0)                                                                                        // 235
      });                                                                                                           //
      if (!this.has(key)) {                                                                                         // 236
        return false;                                                                                               // 236
      }                                                                                                             //
      delete this.cookies[key];                                                                                     // 235
      if (Meteor.isClient) {                                                                                        // 239
        document.cookie = newCookie;                                                                                // 240
      } else {                                                                                                      //
        this.response.setHeader('Set-Cookie', newCookie);                                                           // 242
      }                                                                                                             //
      return true;                                                                                                  //
    } else if (this.keys().length > 0 && this.keys()[0] !== "") {                                                   //
      ref = this.keys();                                                                                            // 245
      for (i = 0, len = ref.length; i < len; i++) {                                                                 // 245
        k = ref[i];                                                                                                 //
        this.remove(k);                                                                                             // 245
      }                                                                                                             // 245
      return true;                                                                                                  //
    } else {                                                                                                        //
      return false;                                                                                                 //
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
                                                                                                                    // 250
  /*                                                                                                                // 250
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name has                                                                                                         //
  @param {String} key  - The name of the cookie to create/overwrite                                                 //
  @param {String} _tmp - Unparsed string instead of user's cookies                                                  //
  @description Check whether a cookie exists in the current position.                                               //
  @returns {Boolean}                                                                                                //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.has = function(key, _tmp) {                                                                   // 151
    var _cs;                                                                                                        // 260
    _cs = _tmp ? parse(_tmp) : this.cookies;                                                                        // 260
    if (!key || !_cs) {                                                                                             // 262
      return false;                                                                                                 // 263
    } else {                                                                                                        //
      return !!(_cs != null ? _cs[key] : void 0);                                                                   //
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
                                                                                                                    // 267
  /*                                                                                                                // 267
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name keys                                                                                                        //
  @description Returns an array of all readable cookies from this location.                                         //
  @returns {[String]}                                                                                               //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.keys = function() {                                                                           // 151
    if (this.cookies) {                                                                                             // 274
      return Object.keys(this.cookies);                                                                             //
    } else {                                                                                                        //
      return [];                                                                                                    //
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
                                                                                                                    // 276
  /*                                                                                                                // 276
  @function                                                                                                         //
  @namespace __cookies                                                                                              //
  @name send                                                                                                        //
  @description Send all cookies over XHR to server.                                                                 //
  @returns {void}                                                                                                   //
   */                                                                                                               //
                                                                                                                    //
  __cookies.prototype.send = function() {                                                                           // 151
    if (this.runOnServer) {                                                                                         // 284
      return HTTP.get((__meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '') + '/___cookie___/set', function() {});
    } else {                                                                                                        //
      throw new Meteor.Error('400', 'Can\'t send cookies on server when `runOnServer` is false.');                  // 287
    }                                                                                                               //
  };                                                                                                                //
                                                                                                                    //
  return __cookies;                                                                                                 //
                                                                                                                    //
})();                                                                                                               //
                                                                                                                    //
__middlewareHandler = function(req, res, self) {                                                                    // 1
  var _cookies, ref;                                                                                                // 290
  if (self.runOnServer) {                                                                                           // 290
    if ((ref = req.headers) != null ? ref.cookie : void 0) {                                                        // 291
      _cookies = parse(req.headers.cookie);                                                                         // 292
    } else {                                                                                                        //
      _cookies = {};                                                                                                // 294
    }                                                                                                               //
    return new __cookies(_cookies, self.collection, self.TTL, self.runOnServer, res);                               // 295
  } else {                                                                                                          //
    throw new Meteor.Error('400', 'Can\'t use middleware when `runOnServer` is false.');                            // 297
  }                                                                                                                 //
};                                                                                                                  // 289
                                                                                                                    //
Cookies = (function(superClass) {                                                                                   // 1
  extend(Cookies, superClass);                                                                                      // 300
                                                                                                                    //
  function Cookies(opts) {                                                                                          // 300
    var self;                                                                                                       // 301
    if (opts == null) {                                                                                             //
      opts = {};                                                                                                    //
    }                                                                                                               //
    this.runOnServer = opts.runOnServer, this.handler = opts.handler, this.TTL = opts.TTL, this.auto = opts.auto;   // 301
    if (this.runOnServer == null) {                                                                                 //
      this.runOnServer = opts.runOnServer || true;                                                                  //
    }                                                                                                               //
    if (this.TTL == null) {                                                                                         //
      this.TTL = opts.TTL || 1000 * 60 * 60 * 24 * 31;                                                              //
    }                                                                                                               //
    if (Meteor.isServer) {                                                                                          // 306
      if (this.runOnServer) {                                                                                       // 307
        if (this.auto == null) {                                                                                    //
          this.auto = true;                                                                                         //
        }                                                                                                           //
        if (this.handler == null) {                                                                                 //
          this.handler = function(c) {};                                                                            //
        }                                                                                                           //
        if (!Cookies.isLoadedOnServer) {                                                                            // 311
          if (this.auto) {                                                                                          // 312
            self = this;                                                                                            // 313
            WebApp.connectHandlers.use(function(req, res, next) {                                                   // 313
              req.Cookies = __middlewareHandler(req, res, self);                                                    // 315
              return next();                                                                                        //
            });                                                                                                     //
          }                                                                                                         //
          Cookies.isLoadedOnServer = true;                                                                          // 312
        }                                                                                                           //
      }                                                                                                             //
    } else {                                                                                                        //
      Cookies.__super__.constructor.call(this, document.cookie, null, this.TTL, this.runOnServer);                  // 320
    }                                                                                                               //
  }                                                                                                                 //
                                                                                                                    //
                                                                                                                    // 322
  /*                                                                                                                // 322
  @function                                                                                                         //
  @namespace Cookies                                                                                                //
  @name middleware                                                                                                  //
  @description Get Cookies instance into callback                                                                   //
  @returns {void}                                                                                                   //
   */                                                                                                               //
                                                                                                                    //
  Cookies.prototype.middleware = function() {                                                                       // 300
    var self;                                                                                                       // 330
    self = this;                                                                                                    // 330
    return function(req, res, next) {                                                                               // 331
      var _cookie;                                                                                                  // 332
      _cookie = __middlewareHandler(req, res, self);                                                                // 332
      self.handler && self.handler(_cookie);                                                                        // 332
      return next();                                                                                                //
    };                                                                                                              //
  };                                                                                                                //
                                                                                                                    //
  return Cookies;                                                                                                   //
                                                                                                                    //
})(__cookies);                                                                                                      //
                                                                                                                    //
if (Meteor.isServer) {                                                                                              // 336
  Cookies.isLoadedOnServer = false;                                                                                 // 336
}                                                                                                                   //
                                                                                                                    //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['ostrio:cookies'] = {}, {
  Cookies: Cookies
});

})();

//# sourceMappingURL=ostrio_cookies.js.map
