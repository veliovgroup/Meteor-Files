(function(root) {
  'use strict';
  root.onmessage = function(e) {
    var chunkId = e.data.cc;
    var _chunk = e.data.f.slice(e.data.cs * (chunkId - 1), e.data.cs * chunkId);
    var fileReader;
    if (e.data.ib === true) {
      postMessage({bin: _chunk, chunkId: chunkId});
      return;
    }

    if (root.FileReader) {
      fileReader = new FileReader();
      fileReader.onload = function() {
        postMessage({bin: String(fileReader.result).split(',')[1], chunkId: chunkId});
      };

      fileReader.onerror = function() {
        postMessage({bin: null, chunkId: chunkId, error: 'FileReader error: ' + ((fileReader.error && fileReader.error.message) || 'unknown')});
      };

      fileReader.readAsDataURL(_chunk);
    } else if (root.FileReaderSync) {
      (function() {
        try {
          fileReader = new FileReaderSync();
          postMessage({bin: fileReader.readAsDataURL(_chunk).split(',')[1], chunkId: chunkId});
        } catch (error) {
          postMessage({bin: null, chunkId: chunkId, error: 'FileReaderSync error: ' + (error && error.message)});
        }
      }());
    } else {
      postMessage({bin: null, chunkId: chunkId, error: 'File API is not supported in WebWorker!'});
    }
  };
}(this));
