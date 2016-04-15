self.onmessage = function(e) {
  var fileReader = new FileReader();

  fileReader.onloadend = function(chunk) {
    postMessage({bin: (fileReader.result || chunk.srcElement || chunk.target).split(',')[1], chunkId: e.data.currentChunk, start: e.data.start});
  };

  fileReader.onerror = function(error) {
    throw (error.target || error.srcElement).error;
  };

  fileReader.readAsDataURL(e.data.file.slice(e.data.chunkSize * (e.data.currentChunk - 1), e.data.chunkSize * e.data.currentChunk));
  return;
};