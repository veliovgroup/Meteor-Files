##### `insert(settings)` [*Client*]
*Upload file to Server via DDP.*

 - `settings` {*Object*} [REQUIRED]
 - `settings.file` {*File*} or {*Object*} - [REQUIRED] HTML5 `files` item, like in change event: `event.currentTarget.files[0]`
 - `settings.meta` {*Object*} - Additional file-related data, like `ownerId`, `postId`, etc.
 - `settings.onStart` {*Function*} - Callback, triggered when upload is started and validations was successful, arguments:
    * `error` - *Always* `null`
    * `fileData` {*Object*}
 - `settings.onUploaded` {*Function*} - Callback, triggered when upload is finished, arguments:
    * `error`
    * `fileRef` - {*Object*} File record from DB
 - `settings.onAbort` {*Function*} - Callback, triggered when `abort()` method is called, argument:
    * `fileData` {*Object*}
 - `settings.onError` {*Function*} - Callback, triggered when upload is finished with error, arguments:
    * `error`
    * `fileData` {*Object*}
 - `settings.onProgress` {*Function*} - Callback, triggered after chunk is sent, arguments:
    * `progress` {*Number*} - Current progress from `0` to `100`
    * `fileData` {*Object*}
 - `settings.onBeforeUpload` {*Function*} - Callback, triggered right before upload is started, arguments:
    * `fileData` {*Object*}
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `settings.streams` {*Number*|dynamic} - Quantity of parallel upload streams, `dynamic` is recommended
 - `settings.allowWebWorkers` {*Boolean*} - Use WebWorkers (*To avoid main thread blocking*) whenever feature is available in browser, default: true
 - `settings.chunkSize` {*Number*|dynamic} - Chunk size for upload, `dynamic` is recommended
 - `autoStart` {*Boolean*} - Start upload immediately. If set to `false`, you need manually call `.start()` method on returned class. Useful to set EventListeners, before starting upload.
 - __Returns__ {*Object*}:
   - __Note__: same object is used as *__context__* in all callback functions (*see above*)
   - `file` {*File*} - Source file passed into method
   - `onPause` {*ReactiveVar*} - Is upload process on the pause?
   - `progress` {*ReactiveVar*} - Upload progress in percents
   - `pause` {*Function*} - Pause upload process
   - `continue` {*Function*} - Continue paused upload process
   - `toggleUpload` {*Function*} - Toggle `continue`/`pause` if upload in the progress
   - `abort` {*Function*} - Abort current upload, then trigger `onAbort` callback
   - `estimateTime` {*ReactiveVar*} - Remaining upload time in milliseconds
   - `estimateSpeed` {*ReactiveVar*} - Current upload speed in bytes/second, to convert into speed look on [filesize](https://github.com/avoidwork/filesize.js) package, usage: `filesize(estimateSpeed, {bits: true}) + '/s';`
   - `state` {*ReactiveVar*} - String reflecting current state of the upload, with four possible values:
      * `active` - file is currently actively uploading
      * `paused` - file upload is paused
      * `aborted` - file upload has been aborted and can no longer be completed
      * `completed` - file has been successfully uploaded
   - This object has support for next events:
      * `start` - Triggered when upload is started (*before sending first byte*) and validations was successful, arguments:
        - `error` - *Always* `null`
        - `fileData` {*Object*}
      * `data` - Triggered after each chunk is read, arguments
        - `data` {*String*} - Base64 encoded chunk (DataURL). Can be used to display or do something else with loaded file during upload. To get EOF use `readEnd` event
      * `readEnd` - Triggered after file is fully read by browser, called with no arguments
      * `progress` - Triggered after each chunk is sent, arguments:
        - `progress` {*Number*} - Current progress from `0` to `100`
        - `fileData` {*Object*}
      * `pause` - Triggered after upload process set to pause, arguments:
        - `fileData` {*Object*}
      * `continue` - Triggered after upload process is continued from pause, arguments:
        - `fileData` {*Object*}
      * `abort` - Triggered after upload is aborted, arguments:
        - `fileData` {*Object*}
      * `uploaded` - Triggered when upload is finished, arguments:
        - `error`
        - `fileRef` - {*Object*} File record from DB
      * `error` - Triggered whenever upload has an error, arguments:
        - `error`
        - `fileData` {*Object*}
      * `end` - Triggered at the very end of upload, arguments:
        - `error`
        - `fileRef` - {*Object*} File record from DB

*When* `autoStart` *is* `false` *before calling* `.start()` *you can "pipe" data through any function, data comes as Base64 string (DataURL). You must return Base64 string from piping function, for more info - see example below. Do not forget to change file name, extension and mime-type if required.*

The `fileData` object (*see above*):
 - `size` {*Number*} - File size in bytes
 - `type` {*String*}
 - `mime`, `mime-type` {*String*}
 - `ext`, `extension` {*String*}
 - `name` {*String*} - File name

#### Upload form:
```html
<template name="uploadForm">
  {{#if currentFile}}
    {{#with currentFile}
      <span id="progress">{{progress}}%</span>
    {{/with}}
  {{else}}
    <input id="fileInput" type="file" />
  {{/if}}
</template>
```

Shared code:
```javascript
this.Images = new FilesCollection({collectionName: 'Images'});
```

Client's code:
```javascript
Template.uploadForm.onCreated(function () {
  this.currentFile = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentFile: function () {
    Template.instance().currentFile.get();
  }
});

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // there was multiple files selected
      var file = e.currentTarget.files[0];

      Images.insert({
        file: file,
        onStart: function () {
          template.currentFile.set(this);
        },
        onUploaded: function (error, fileObj) {
          if (error) {
            alert('Error during upload: ' + error);
          } else {
            alert('File "' + fileObj.name + '" successfully uploaded');
          }
          template.currentFile.set(false);
        },
        streams: 'dynamic',
        chunkSize: 'dynamic'
      });
    }
  }
});
```

##### Alternative, using events:
```javascript
Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      Images.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
        chunkSize: 'dynamic'

      }, false).on('start', function () {
        template.currentFile.set(this);

      }).on('end', function (error, fileObj) {
        if (error) {
          alert('Error during upload: ' + error);
        } else {
          alert('File "' + fileObj.name + '" successfully uploaded');
        }
        template.currentFile.set(false);

      }).start();
    }
  }
});
```

##### Other events based example:
```javascript
Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      uploader = Images.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
        chunkSize: 'dynamic'
      }, false);

      uploader.on('start', function () {
        template.currentFile.set(this);
      });

      uploader.on('end', function (error, fileObj) {
        template.currentFile.set(false);
      });

      uploader.on('uploaded', function (error, fileObj) {
        if (!error) {
          alert('File "' + fileObj.name + '" successfully uploaded');
        }
      });

      uploader.on('error', function (error, fileObj) {
        alert('Error during upload: ' + error);
      });

      uploader.start();
    }
  }
});
```

##### Piping:
```javascript
var encrypt = function encrypt(data) {
  return someHowEncryptAndReturnAsBase64(data);
};

var zip = function zip(data) {
  return someHowZipAndReturnAsBase64(data);
};

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      Images.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
        chunkSize: 'dynamic'
      }, false).pipe(encrypt).pipe(zip).start();
    }
  }
});
```