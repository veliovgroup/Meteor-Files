"use strict";
self.onmessage = function(e) {
  var fileReader;
  if (self.FileReader) {
    fileReader = new FileReader();
    fileReader.onloadend = function(chunk) {
      postMessage({bin: (fileReader.result || chunk.srcElement || chunk.target).split(',')[1], chunkId: e.data.cc, s: e.data.s});
    };

    fileReader.onerror = function(error) {
      throw (error.target || error.srcElement).error;
    };

    fileReader.readAsDataURL(e.data.f.slice(e.data.cs * (e.data.cc - 1), e.data.cs * e.data.cc));

  } else if (self.FileReaderSync) {
    fileReader = new FileReaderSync();
    postMessage({bin: fileReader.readAsDataURL(e.data.f.slice(e.data.cs * (e.data.cc - 1), e.data.cs * e.data.cc)).split(',')[1], chunkId: e.data.cc});

  } else {
    postMessage({bin: null, chunkId: e.data.cc, error: 'File API is not supported in WebWorker!'});
  }
  return;
};