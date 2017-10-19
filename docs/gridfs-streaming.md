By default files served from GridFS returned with `200` response code. Which means if you serve video/audio/large downloads, file will be entirely read to memory and serve to client. This behavior is not best solution in terms of performance and resource usage.

`206` partial content response is much better from all sides, for video and audio it allows to support time-seeking, for large files - resumable downloads. For server-side it reduces memory and CPU consumption.

Below is code sample suggested by [@j1016h](https://github.com/j1016h), where [`interceptDownload`](https://github.com/VeliovGroup/Meteor-Files/wiki/Constructor) is used to alter default file-serving behavior - *use it as it at your own risk, or take it and modify to meet your own needs*.

```js
interceptDownload(http, image, versionName) {
  function interceptDownloadServe(http, fileRef, vRef, version, readableStream, responseType, force200) {
    var array, dispositionEncoding, dispositionName, dispositionType, end, headers, key, partiral, reqRange, self, start, stream, streamErrorHandler, take, text, value;
    if (version == null) {
      version = 'original';
    }
    if (readableStream == null) {
      readableStream = null;
    }
    if (responseType == null) {
      responseType = '200';
    }
    if (force200 == null) {
      force200 = false;
    }
    self = this;
    partiral = false;
    reqRange = false;
    if (http.params.query.download && http.params.query.download === 'true') {
      dispositionType = 'attachment; ';
    } else {
      dispositionType = 'inline; ';
    }
    dispositionName = "filename=\"" + (encodeURIComponent(fileRef.name)) + "\"; filename=*UTF-8\"" + (encodeURIComponent(fileRef.name)) + "\"; ";
    dispositionEncoding = 'charset=utf-8';
    http.response.setHeader('Content-Disposition', dispositionType + dispositionName + dispositionEncoding);
    if (http.request.headers.range && !force200) {
      partiral = true;
      array = http.request.headers.range.split(/bytes=([0-9]*)-([0-9]*)/);
      start = parseInt(array[1]);
      end = parseInt(array[2]);
      if (isNaN(end)) {
        end = vRef.size - 1;
      }
      take = end - start;
    } else {
      start = 0;
      end = vRef.size - 1;
      take = vRef.size;
    }
    if (partiral || (http.params.query.play && http.params.query.play === 'true')) {
      reqRange = {
        start: start,
        end: end
      };
      if (isNaN(start) && !isNaN(end)) {
        reqRange.start = end - take;
        reqRange.end = end;
      }
      if (!isNaN(start) && isNaN(end)) {
        reqRange.start = start;
        reqRange.end = start + take;
      }
      if ((start + take) >= vRef.size) {
        reqRange.end = vRef.size - 1;
      }
      if (self.strict && (reqRange.start >= (vRef.size - 1) || reqRange.end > (vRef.size - 1))) {
        responseType = '416';
      } else {
        responseType = '206';
      }
    } else {
      responseType = '200';
    }
    streamErrorHandler = function(error) {
      http.response.writeHead(500);
      http.response.end(error.toString());
      if (self.debug) {
        console.error("[FilesCollection] [serve(" + vRef.path + ", " + version + ")] [500]", error);
      }
    };
    headers = http.request.headers;

    switch (responseType) {
      case '400':
        if (self.debug) {
          console.warn("[FilesCollection] [serve(" + vRef.path + ", " + version + ")] [400] Content-Length mismatch!");
        }
        text = 'Content-Length mismatch!';
        http.response.writeHead(400, {
          'Content-Type': 'text/plain',
          'Content-Length': text.length
        });
        http.response.end(text);
        break;
      case '404':
        return self._404(http);
        break;
      case '416':
        if (self.debug) {
          console.warn("[FilesCollection] [serve(" + vRef.path + ", " + version + ")] [416] Content-Range is not specified!");
        }
        http.response.writeHead(416);
        http.response.end();
        break;
      case '200':
        if (self.debug) {
          console.info("[FilesCollection] [serve(" + vRef.path + ", " + version + ")] [200]");
        }
        stream = readableStream || fs.createReadStream(vRef.path);
        if (readableStream) {
          http.response.writeHead(200);
        }
        stream.on('open', function() {
          http.response.writeHead(200);
        }).on('error', streamErrorHandler).on('end', function() {
          http.response.end();
        }).pipe(http.response);
        break;
      case '206':
        if (self.debug) {
          console.info("[FilesCollection] [serve(" + vRef.path + ", " + version + ")] [206]");
        }
        http.response.setHeader('Content-Range', "bytes " + reqRange.start + "-" + reqRange.end + "/" + vRef.size);
        var myid = (fileRef.versions[version].meta || {}).gridFsFileId;
        stream = readableStream || gfs.createReadStream({
          _id: myid,
          range: {
            startPos: reqRange.start,
            endPos: reqRange.end
          }
        });
        if (readableStream) {
          http.response.writeHead(206);
        }
        stream.on('open', function() {
          http.response.writeHead(206);
        }).on('error', streamErrorHandler).on('end', function() {
          http.response.end();
        }).pipe(http.response);
        break;
    }
  }

  const _id = (image.versions[versionName].meta || {}).gridFsFileId;
  if (_id) {
    interceptDownloadServe(http, image, image.versions[versionName], versionName, null, '206', false);
  }
  return Boolean(_id);
}
```