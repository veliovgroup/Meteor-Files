;(function(root) {
  "use strict";
  root.onmessage = function(e) {
    var _chunk = e.data.f.slice(e.data.cs * (e.data.cc - 1), e.data.cs * e.data.cc);
    if (e.data.ib === true) {
      postMessage({bin: _chunk, chunkId: e.data.cc});
    } else {
      var fileReader;
      if (root.FileReader) {
        fileReader = new FileReader();
        fileReader.onloadend = function(chunk) {
          postMessage({bin: (fileReader.result || chunk.srcElement || chunk.target).split(',')[1], chunkId: e.data.cc, s: e.data.s});
        };

        fileReader.onerror = function(error) {
          throw (error.target || error.srcElement).error;
        };

        fileReader.readAsDataURL(_chunk, e.data.cs * e.data.cc);

      } else if (root.FileReaderSync) {
        fileReader = new FileReaderSync();
        postMessage({bin: fileReader.readAsDataURL(_chunk).split(',')[1], chunkId: e.data.cc});

      } else {
        postMessage({bin: null, chunkId: e.data.cc, error: 'File API is not supported in WebWorker!'});
      }
    }
    return;
  };
}(this));