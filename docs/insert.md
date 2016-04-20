##### `insert(settings)` [*Client*]
*Upload file to Server via DDP.*

`settings` is __required__ object:
 - `file` {*File*} or {*Object*} - [REQUIRED] HTML5 `files` item, like in change event: `event.currentTarget.files[0]`
 - `meta` {*Object*} - Additional file-related data, like `ownerId`, `postId`, etc.
 - `onUploaded` {*Function*} - Callback, triggered when upload is finished, arguments:
    * `error`
    * `fileRef` - File record from DB
 - `onError` {*Function*} - Callback, triggered when upload is finished with error, arguments:
    * `error`
    * `fileData` {*Object*}
 - `onProgress` {*Function*} - Callback, triggered after chunk is sent, arguments:
    * `progress` {*Number*} - Current progress from `0` to `100`
    * `fileData` {*Object*}
 - `onBeforeUpload` {*Function*} - Callback, triggered right before upload is started, arguments:
    * `fileData` {*Object*}
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `streams` {*Number*|dynamic} - Quantity of parallel upload streams, `dynamic` is recommended
 - `allowWebWorkers` {*Boolean*} - Use WebWorkers (*To avoid main thread blocking*) whenever feature is available in browser, default: true
 - `chunkSize` {*Number*|dynamic} - Chunk size for upload, `dynamic` is recommended
 - `onAbort` {*Function*} - Callback, triggered when `abort()` method is called, argument:
    * `fileData` {*Object*}

`fileData` object:
 - `size` {*Number*} - File size in bytes
 - `type` {*String*}
 - `mime`, `mime-type` {*String*}
 - `ext`, `extension` {*String*}
 - `name` {*String*} - File name

`insert()` method returns {*Object*}, same object is used as *__context__* in all callback functions:
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

Upload form:
```html
<template name="upload-form">
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
this.Images = new Meteor.Files({collectionName: 'Images'});
```

Client's code:
```javascript
Template['upload-form'].onCreated(function () {
  this.currentFile = new ReactiveVar(false);
});

Template['upload-form'].helpers({
  currentFile: function () {
    Template.instance().currentFile.get();
  }
});

Template['upload-form'].events({
  'change #fileInput': (e, template) ->
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case 
      // there was multiple files selected
      var file = e.currentTarget.files[0];

      template.currentFile.set(Images.insert({
        file: file,
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
      }));
    }
  });
});
```