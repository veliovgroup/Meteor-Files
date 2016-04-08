##### `insert(settings)` [*Client*]
*Upload image to Server via DDP.*

`settings` is __required__ object:
 - `file` {*File*} or {*Object*} - [REQUIRED] HTML5 `files` item, like in change event: `event.currentTarget.files[0]`
 - `meta` {*Object*} - Additional file-related data, like `ownerId`, `postId`, etc.
 - `onReady` {*Function*} - Triggered when file is loaded to browser
 - `onUploaded` {*Function*} - Callback triggered when upload is finished, with two arguments:
    * `error`
    * `fileRef` - File record from DB
 - `FileReadProgress` {*Function*} - Callback triggered while browser loading file, argument:
    * `progress` {*Number*} - Current progress from `0` to `100`
 - `onProgress` {*Function*} - Callback triggered when chunk is sent, argument:
    * `progress` {*Number*} - Current progress from `0` to `100`
 - `onBeforeUpload` {*Function*} - Callback triggered right before upload is started, with __no arguments__:
    * `file` {*Object*}
    * __return__ `true` to continue
    * __return__ `false` to abort or {*String*} to abort upload with message
 - `streams` {*Number*|dynamic} - Quantity of parallel upload streams, `dynamic` is recommended
 - `chunkSize` {*Number*|dynamic} - Chunk size for upload, `dynamic` is recommended
 - `onAbort` {*Function*} - Callback triggered when `abort()` method is called

All callback functions has *context* of object described below and `fileData` object as argument:
 - `size` {*Number*} - File size in bytes
 - `type` {*String*}
 - `mime`, `mime-type` {*String*}
 - `ext`, `extension` {*String*}
 - `name` {*String*} - File name

Returns {*Object*}, this is same object used for *context* of callback functions passed in *settings*:
 - `onPause` {*ReactiveVar*} - Is upload process on the pause?
 - `progress` {*ReactiveVar*} - Upload progress in percents
 - `pause` {*Function*} - Pause upload process
 - `continue` {*Function*} - Continue paused upload process
 - `toggleUpload` {*Function*} - Toggle `continue`/`pause` if upload in the progress
 - `abort` {*Function*} - Abort upload upload and file reading, then trigger `onAbort` callback
 - `readAsDataURL` {*Function*} - Returns file as base64 data URL, can be used to create previews and etc. *Do not call on large files, may lead to browser crash*. Returns empty string if file is not yet loaded to browser, use `onReady` callback to make sure file is loaded to browser.
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