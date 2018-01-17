import { _ }     from 'meteor/underscore';
import { check } from 'meteor/check';

/*
 * @const {Function} fixJSONParse - Fix issue with Date parse
 */
const fixJSONParse = function(obj) {
  for (let key in obj) {
    if (_.isString(obj[key]) && !!~obj[key].indexOf('=--JSON-DATE--=')) {
      obj[key] = obj[key].replace('=--JSON-DATE--=', '');
      obj[key] = new Date(parseInt(obj[key]));
    } else if (_.isObject(obj[key])) {
      obj[key] = fixJSONParse(obj[key]);
    } else if (_.isArray(obj[key])) {
      let v;
      for (let i = 0; i < obj[key].length; i++) {
        v = obj[key][i];
        if (_.isObject(v)) {
          obj[key][i] = fixJSONParse(v);
        } else if (_.isString(v) && !!~v.indexOf('=--JSON-DATE--=')) {
          v = v.replace('=--JSON-DATE--=', '');
          obj[key][i] = new Date(parseInt(v));
        }
      }
    }
  }
  return obj;
};

/*
 * @const {Function} fixJSONStringify - Fix issue with Date stringify
 */
const fixJSONStringify = function(obj) {
  for (let key in obj) {
    if (_.isDate(obj[key])) {
      obj[key] = `=--JSON-DATE--=${+obj[key]}`;
    } else if (_.isObject(obj[key])) {
      obj[key] = fixJSONStringify(obj[key]);
    } else if (_.isArray(obj[key])) {
      let v;
      for (let i = 0; i < obj[key].length; i++) {
        v = obj[key][i];
        if (_.isObject(v)) {
          obj[key][i] = fixJSONStringify(v);
        } else if (_.isDate(v)) {
          obj[key][i] = `=--JSON-DATE--=${+v}`;
        }
      }
    }
  }
  return obj;
};

/*
 * @locus Anywhere
 * @private
 * @name formatFleURL
 * @param {Object} fileRef - File reference object
 * @param {String} version - [Optional] Version of file you would like build URL for
 * @summary Returns formatted URL for file
 * @returns {String} Downloadable link
 */
const formatFleURL = (fileRef, version = 'original') => {
  let ext;
  check(fileRef, Object);
  check(version, String);

  const _root = __meteor_runtime_config__.ROOT_URL.replace(/\/+$/, '');
  const vRef = (fileRef.versions && fileRef.versions[version]) || fileRef || {};

  if (_.isString(vRef.extension)) {
    ext = `.${vRef.extension.replace(/^\./, '')}`;
  } else {
    ext = '';
  }

  if (fileRef.public === true) {
    return _root + (version === 'original' ? `${fileRef._downloadRoute}/${fileRef._id}${ext}` : `${fileRef._downloadRoute}/${version}-${fileRef._id}${ext}`);
  }
  return _root + `${fileRef._downloadRoute}/${fileRef._collectionName}/${fileRef._id}/${version}/${fileRef._id}${ext}`;
};

export { fixJSONParse, fixJSONStringify, formatFleURL };
