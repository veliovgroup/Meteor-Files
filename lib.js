import { check, Match } from 'meteor/check';

/**
 * @const {Set<string>} UNSAFE_KEYS - Keys skipped when walking untrusted objects
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const helpers = {
  sanitize(str = '', max = 28, replacement = '-') {
    return str.replace(/([^a-z0-9\-\_]+)/gi, replacement).substring(0, max);
  },
  isUndefined(obj) {
    return obj === void 0;
  },
  isObject(obj) {
    if (obj === null || this.isArray(obj) || this.isFunction(obj)) {
      return false;
    }
    return obj === Object(obj);
  },
  isNumber(obj) {
    return Object.prototype.toString.call(obj) === '[object Number]';
  },
  isDate(obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
  },
  isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
  },
  isArray(obj) {
    return Array.isArray(obj);
  },
  isBoolean(obj) {
    return obj === true || obj === false || Object.prototype.toString.call(obj) === '[object Boolean]';
  },
  isFunction(obj) {
    if (this.isUndefined(obj)) {
      return false;
    }
    const type = Object.prototype.toString.call(obj);
    return type === '[object Function]' || type === '[object AsyncFunction]';
  },
  isEmpty(obj) {
    if (this.isDate(obj)) {
      return false;
    }
    if (this.isObject(obj)) {
      return !Object.keys(obj).length;
    }
    if (this.isArray(obj) || this.isString(obj)) {
      return !obj.length;
    }
    return false;
  },
  clone(obj) {
    if (!this.isObject(obj)) {
      return obj;
    }
    return this.isArray(obj) ? [...obj] : { ...obj };
  },
  cloneDeep(obj) {
    if (this.isArray(obj)) {
      return obj.map((item) => this.cloneDeep(item));
    }
    if (this.isDate(obj)) {
      return new Date(obj.getTime());
    }
    if (ArrayBuffer.isView(obj)) {
      return obj.slice();
    }
    if (!this.isObject(obj)) {
      return obj;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      // Class instances (ObjectID, Binary, etc.) are kept by reference
      return obj;
    }
    const copy = {};
    for (const key of Object.keys(obj)) {
      if (UNSAFE_KEYS.has(key)) {
        continue;
      }
      copy[key] = this.cloneDeep(obj[key]);
    }
    return copy;
  },
  has(_obj, path) {
    let obj = _obj;
    if (!this.isObject(obj)) {
      return false;
    }
    if (!this.isArray(path)) {
      return this.isObject(obj) && Object.prototype.hasOwnProperty.call(obj, path);
    }

    const length = path.length;
    for (let i = 0; i < length; i++) {
      if (!Object.prototype.hasOwnProperty.call(obj, path[i])) {
        return false;
      }
      obj = obj[path[i]];
    }
    return !!length;
  },
  omit(obj, ...keys) {
    const clear = Object.assign({}, obj);
    for (let i = keys.length - 1; i >= 0; i--) {
      delete clear[keys[i]];
    }

    return clear;
  },
  now: Date.now,
  throttle(func, wait, options = {}) {
    let previous = 0;
    let timeout = null;
    let result;
    const that = this;
    let self;
    let args;

    const later = () => {
      previous = options.leading === false ? 0 : that.now();
      timeout = null;
      result = func.apply(self, args);
      if (!timeout) {
        self = args = null;
      }
    };

    const throttled = function () {
      const now = that.now();
      if (!previous && options.leading === false) previous = now;
      const remaining = wait - (now - previous);
      self = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(self, args);
        if (!timeout) {
          self = args = null;
        }
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = () => {
      clearTimeout(timeout);
      previous = 0;
      timeout = self = args = null;
    };

    return throttled;
  }
};

/**
 * @const {function} fixJSONParse - Fix issue with Date parse
 * @summary Revive `=--JSON-DATE--=` strings into `Date` objects in place. Walks own keys only and skips `__proto__`, `constructor`, and `prototype`
 */
const fixJSONParse = function(obj) {
  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }

    if (helpers.isString(obj[key]) && obj[key].includes('=--JSON-DATE--=')) {
      obj[key] = obj[key].replace('=--JSON-DATE--=', '');
      obj[key] = new Date(parseInt(obj[key]));
    } else if (helpers.isObject(obj[key])) {
      obj[key] = fixJSONParse(obj[key]);
    } else if (helpers.isArray(obj[key])) {
      let v;
      for (let i = 0; i < obj[key].length; i++) {
        v = obj[key][i];
        if (helpers.isObject(v)) {
          obj[key][i] = fixJSONParse(v);
        } else if (helpers.isString(v) && v.includes('=--JSON-DATE--=')) {
          v = v.replace('=--JSON-DATE--=', '');
          obj[key][i] = new Date(parseInt(v));
        }
      }
    }
  }
  return obj;
};

/**
 * @const {function} fixJSONStringify - Fix issue with Date stringify
 * @summary Replace `Date` objects with `=--JSON-DATE--=` strings in place. Walks own keys only and skips `__proto__`, `constructor`, and `prototype`
 */
const fixJSONStringify = function(obj) {
  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }

    if (helpers.isDate(obj[key])) {
      obj[key] = `=--JSON-DATE--=${+obj[key]}`;
    } else if (helpers.isObject(obj[key])) {
      obj[key] = fixJSONStringify(obj[key]);
    } else if (helpers.isArray(obj[key])) {
      let v;
      for (let i = 0; i < obj[key].length; i++) {
        v = obj[key][i];
        if (helpers.isObject(v)) {
          obj[key][i] = fixJSONStringify(v);
        } else if (helpers.isDate(v)) {
          obj[key][i] = `=--JSON-DATE--=${+v}`;
        }
      }
    }
  }
  return obj;
};

/**
 * @const {RegExp} LOCAL_ROUTE_RE - A local absolute path, not a protocol-relative or absolute URL
 */
const LOCAL_ROUTE_RE = /^\/[^/]/;
/**
 * @const {RegExp} UNSAFE_ROUTE_RE - Parts not allowed in a stored route: `..`, `//`, `@`, `:`, `\`, `?`, `#`, whitespace, and control characters
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_ROUTE_RE = /\.\.|\/\/|[@:\\?#\s\x00-\x1f\x7f]/;
/**
 * @const {RegExp} PLAIN_NAME_RE - A plain collection name: letters, digits, `_`, `-`, and `.`
 */
const PLAIN_NAME_RE = /^[A-Za-z0-9_.-]+$/;

/**
 * @private
 * @summary Returns `true` for a stored `_downloadRoute` that is a safe local path
 * @param {*} route - Value to check
 * @returns {boolean}
 */
const isSafeRoute = (route) => helpers.isString(route) && LOCAL_ROUTE_RE.test(route) && !UNSAFE_ROUTE_RE.test(route);

/**
 * @private
 * @summary Returns `true` for a stored `_collectionName` that is a plain name
 * @param {*} name - Value to check
 * @returns {boolean}
 */
const isPlainName = (name) => helpers.isString(name) && PLAIN_NAME_RE.test(name) && !name.includes('..');

/**
 * @locus Anywhere
 * @private
 * @name formatFileURL
 * @param {Partial<FileObj>|FileCursor} fileRef - File reference object
 * @param {string} [version] - [Optional] Version of file you would like build URL for
 * @param {string} [uriBase] - [Optional] URI base, see - https://github.com/veliovgroup/Meteor-Files/issues/626
 * @param {FilesCollection} [collection] - [Optional] Collection of the file. Its `downloadRoute` and `collectionName` replace the document's `_downloadRoute` and `_collectionName` when those are not safe
 * @summary Returns formatted URL for file. Uses the document's `_downloadRoute` when it is a safe local path (`/...` without `..`, `//`, `@`, `:`, `\`, `?`, `#`, whitespace, or control characters) and `_collectionName` when it is a plain name, otherwise the collection's values. Returns an empty string when neither is available or the file has no `_id`. `_id`, `version`, the extension, and the collection name are URI-encoded
 * @returns {string} Downloadable link
 */
// eslint-disable-next-line camelcase, no-undef
const formatFileURL = (_fileRef, version = 'original', _uriBase = (__meteor_runtime_config__ || {}).ROOT_URL, collection) => {
  // Unwrap FileCursor
  const fileRef = (helpers.isObject(_fileRef) && helpers.isObject(_fileRef._fileRef)) ? _fileRef._fileRef : _fileRef;
  // eslint-disable-next-line new-cap
  check(fileRef, Match.Where((obj) => helpers.isObject(obj)));
  check(version, String);
  let uriBase = _uriBase;

  if (!helpers.isString(uriBase)) {
    // eslint-disable-next-line camelcase, no-undef
    uriBase = (__meteor_runtime_config__ || {}).ROOT_URL || '/';
  }

  // Stored values are set by the server (client-supplied ones are stripped since 3.1), keep them when safe, as in 3.0.x
  const hasCollection = helpers.isObject(collection);
  let route;
  if (isSafeRoute(fileRef._downloadRoute)) {
    route = fileRef._downloadRoute;
  } else if (hasCollection && helpers.isString(collection.downloadRoute)) {
    // Trusted: collection's own configuration
    route = collection.downloadRoute;
  } else {
    return '';
  }

  let collectionName;
  if (isPlainName(fileRef._collectionName)) {
    collectionName = fileRef._collectionName;
  } else if (hasCollection && helpers.isString(collection.collectionName)) {
    collectionName = collection.collectionName;
  } else if (fileRef.public !== true) {
    return '';
  }

  // No `_id`, for example the file object of a rejected upload: there is no file to link to
  if (fileRef._id === undefined || fileRef._id === null || fileRef._id === '') {
    return '';
  }

  const _root = uriBase.replace(/\/+$/, '');
  const vRef = (fileRef.versions && fileRef.versions[version]) || fileRef || {};

  let ext;
  if (helpers.isString(vRef.extension)) {
    ext = `.${encodeURIComponent(vRef.extension.replace(/^\./, ''))}`;
  } else {
    ext = '';
  }

  const _id = encodeURIComponent(`${fileRef._id}`);
  const _version = encodeURIComponent(version);

  if (fileRef.public === true) {
    return _root + (version === 'original' ? `${route}/${_id}${ext}` : `${route}/${_version}-${_id}${ext}`);
  }

  collectionName = encodeURIComponent(`${collectionName}`);
  return `${_root}${route}/${collectionName}/${_id}/${_version}/${_id}${ext}`;
};

export { fixJSONParse, fixJSONStringify, formatFileURL, helpers };
