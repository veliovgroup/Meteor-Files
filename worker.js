"use strict";
self.onmessage = function(e) {
  var read = function (method, callback) {
    var fileReader;
    if (self.FileReader) {
      fileReader = new FileReader();
      fileReader.onloadend = function(chunk) {
        callback(null, (fileReader.result || chunk.srcElement || chunk.target));
      };

      fileReader.onerror = function(error) {
        callback((error.target || error.srcElement).error);
      };

      fileReader[method](e.data.f.slice(e.data.cs * (e.data.cc - 1), e.data.cs * e.data.cc));

    } else if (self.FileReaderSync) {
      fileReader = new FileReaderSync();

      callback(null, fileReader[method](e.data.f.slice(e.data.cs * (e.data.cc - 1), e.data.chunkSize * e.data.cc)));

    } else {
      callback('File API is not supported in WebWorker!');
    }
    return;
  };

  var method = 'readAsDataURL';
  if (e.data.t === 'webrtc') {
    method = 'readAsArrayBuffer';
  }

  read(method, function (error, chunk) {
    var message = {bin: null, chunkId: e.data.cc, start: e.data.s};
    if (error) {
      message.error = error;
    } else {
      if (e.data.t === 'ddp' || e.data.t === 'http') {
        message.bin = chunk.split(',')[1];
      } else {
        message.bin = chunk;
      }
    }
    postMessage(message);
  });
};