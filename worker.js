"use strict";
self.onmessage = function(e) {
  var fileReader;
  if (self.FileReader) {
    fileReader = new FileReader();
    fileReader.onloadend = function(chunk) {
      postMessage({bin: (fileReader.result || chunk.srcElement || chunk.target).split(',')[1], chunkId: e.data.currentChunk, start: e.data.start});
    };

    fileReader.onerror = function(error) {
      throw (error.target || error.srcElement).error;
    };

    fileReader.readAsDataURL(e.data.file.slice(e.data.chunkSize * (e.data.currentChunk - 1), e.data.chunkSize * e.data.currentChunk));

  } else if (self.FileReaderSync) {
    fileReader = new FileReaderSync();
    postMessage({bin: fileReader.readAsDataURL(e.data.file.slice(e.data.chunkSize * (e.data.currentChunk - 1), e.data.chunkSize * e.data.currentChunk)).split(',')[1], chunkId: e.data.currentChunk, start: e.data.start});

  } else {
    postMessage({bin: null, chunkId: e.data.currentChunk, start: e.data.start, error: 'FileReader and FileReaderSync is not supported in WebWorker!'});
  }
  return;
};