'use strict';

var ClientSession = require('./client_session'),
    ServerSession = require('./server_session'),
    common        = require('./common');

var VALID_OPTIONS = [
  'level',
  'memLevel',
  'strategy',
  'noContextTakeover',
  'maxWindowBits',
  'requestNoContextTakeover',
  'requestMaxWindowBits'
];

var PermessageDeflate = {
  configure: function(options) {
    common.validateOptions(options, VALID_OPTIONS);
    var opts = this._options || {};
    for (var key in opts) options[key] = opts[key];
    return Object.create(this, {_options: {value: options}});
  },

  createClientSession: function() {
    return new ClientSession(this._options || {});
  },

  createServerSession: function(offers) {
    for (var i = 0, n = offers.length; i < n; i++) {
      if (ServerSession.validParams(offers[i]))
        return new ServerSession(this._options || {}, offers[i]);
    }
    return null;
  },

  name: 'permessage-deflate',
  type: 'permessage',
  rsv1: true,
  rsv2: false,
  rsv3: false
};

module.exports = PermessageDeflate;
