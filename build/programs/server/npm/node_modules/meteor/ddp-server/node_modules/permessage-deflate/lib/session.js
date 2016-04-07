'use strict';

var zlib   = require('zlib'),
    common = require('./common');

var Session = function(options) {
  this._level    = common.fetch(options, 'level',    zlib.Z_DEFAULT_LEVEL);
  this._memLevel = common.fetch(options, 'memLevel', zlib.Z_DEFAULT_MEMLEVEL);
  this._strategy = common.fetch(options, 'strategy', zlib.Z_DEFAULT_STRATEGY);

  this._acceptNoContextTakeover  = common.fetch(options, 'noContextTakeover', false);
  this._acceptMaxWindowBits      = common.fetch(options, 'maxWindowBits', undefined);
  this._requestNoContextTakeover = common.fetch(options, 'requestNoContextTakeover', false);
  this._requestMaxWindowBits     = common.fetch(options, 'requestMaxWindowBits', undefined);

  this._queueIn  = [];
  this._queueOut = [];
};

Session.prototype.processIncomingMessage = function(message, callback) {
  if (!message.rsv1) return callback(null, message);
  if (this._lockIn) return this._queueIn.push([message, callback]);

  var inflate = this._getInflate(),
      chunks  = [],
      length  = 0,
      self    = this;

  if (this._inflate) this._lockIn = true;

  var return_ = function(error, message) {
    return_ = function() {};

    inflate.removeListener('data', onData);
    inflate.removeListener('error', onError);
    if (!self._inflate) self._close(inflate);

    self._lockIn = false;
    var next = self._queueIn.shift();
    if (next) self.processIncomingMessage.apply(self, next);

    callback(error, message);
  };

  var onData = function(data) {
    chunks.push(data);
    length += data.length;
  };

  var onError = function(error) {
    return_(error, null);
  };

  inflate.on('data', onData);
  inflate.on('error', onError);

  inflate.write(message.data);
  inflate.write(new Buffer([0x00, 0x00, 0xff, 0xff]));

  inflate.flush(function() {
    message.data = common.concat(chunks, length);
    return_(null, message);
  });
};

Session.prototype.processOutgoingMessage = function(message, callback) {
  if (this._lockOut) return this._queueOut.push([message, callback]);

  var deflate = this._getDeflate(),
      chunks  = [],
      length  = 0,
      self    = this;

  if (this._deflate) this._lockOut = true;

  var return_ = function(error, message) {
    return_ = function() {};

    deflate.removeListener('data', onData);
    deflate.removeListener('error', onError);
    if (!self._deflate) self._close(deflate);

    self._lockOut = false;
    var next = self._queueOut.shift();
    if (next) self.processOutgoingMessage.apply(self, next);

    callback(error, message);
  };

  var onData = function(data) {
    chunks.push(data);
    length += data.length;
  };

  var onError = function(error) {
    return_(error, null);
  };

  deflate.on('data', onData);
  deflate.on('error', onError);
  deflate.write(message.data);

  var onFlush = function() {
    var data = common.concat(chunks, length);
    message.data = data.slice(0, data.length - 4);
    message.rsv1 = true;
    return_(null, message);
  };

  if (deflate.params !== undefined)
    deflate.flush(zlib.Z_SYNC_FLUSH, onFlush);
  else
    deflate.flush(onFlush);
};

Session.prototype.close = function() {
  this._close(this._inflate);
  this._inflate = null;

  this._close(this._deflate);
  this._deflate = null;
};

Session.prototype._getInflate = function() {
  if (this._inflate) return this._inflate;
  var inflate = zlib.createInflateRaw({windowBits: this._peerWindowBits});
  if (this._peerContextTakeover) this._inflate = inflate;
  return inflate;
};

Session.prototype._getDeflate = function() {
  if (this._deflate) return this._deflate;

  var deflate = zlib.createDeflateRaw({
    windowBits: this._ownWindowBits,
    level:      this._level,
    memLevel:   this._memLevel,
    strategy:   this._strategy
  });

  var flush = deflate.flush;

  // This monkey-patch is needed to make Node 0.10 produce optimal output.
  // Without this it uses Z_FULL_FLUSH and effectively drops all its context
  // state on every flush.

  if (deflate._flushFlag !== undefined && deflate.params === undefined)
    deflate.flush = function(callback) {
      var ws = this._writableState;
      if (ws.ended || ws.ending || ws.needDrain) {
        flush.call(this, callback);
      } else {
        this._flushFlag = zlib.Z_SYNC_FLUSH;
        this.write(new Buffer(0), '', callback);
      }
    };

  if (this._ownContextTakeover) this._deflate = deflate;
  return deflate;
};

Session.prototype._close = function(codec) {
  if (!codec || !codec.close) return;
  try { codec.close() } catch (error) {}
};

module.exports = Session;
