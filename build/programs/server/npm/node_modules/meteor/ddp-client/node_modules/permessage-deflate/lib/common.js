'use strict';

var common = {
  VALID_PARAMS: [
    'server_no_context_takeover',
    'client_no_context_takeover',
    'server_max_window_bits',
    'client_max_window_bits'
  ],

  DEFAULT_MAX_WINDOW_BITS: 15,
  VALID_WINDOW_BITS: [8, 9, 10, 11, 12, 13, 14, 15],

  concat: function(buffers, length) {
    var buffer = new Buffer(length),
        offset = 0;

    for (var i = 0, n = buffers.length; i < n; i++) {
      buffers[i].copy(buffer, offset);
      offset += buffers[i].length;
    }
    return buffer;
  },

  fetch: function(options, key, _default) {
    if (options.hasOwnProperty(key))
      return options[key];
    else
      return _default;
  },

  validateOptions: function(options, validKeys) {
    for (var key in options) {
      if (validKeys.indexOf(key) < 0)
        throw new Error('Unrecognized option: ' + key);
    }
  },

  validParams: function(params) {
    var keys = Object.keys(params), i = keys.length;
    while (i--) {
      if (this.VALID_PARAMS.indexOf(keys[i]) < 0) return false;
      if (params[keys[i]] instanceof Array) return false;
    }
    if (params.hasOwnProperty('server_no_context_takeover')) {
      if (params.server_no_context_takeover !== true) return false;
    }
    if (params.hasOwnProperty('client_no_context_takeover')) {
      if (params.client_no_context_takeover !== true) return false;
    }
    if (params.hasOwnProperty('server_max_window_bits')) {
      if (this.VALID_WINDOW_BITS.indexOf(params.server_max_window_bits) < 0) return false;
    }
    return true;
  }
};

module.exports = common;
