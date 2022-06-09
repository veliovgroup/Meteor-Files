# Insert; Upload

__Insert and upload are available only from a *Client*/*Browser*/*Cordova*/etc.__

```js
FilesCollection#insert(settings, autoStart); //[*Client*]
```

Upload file to a Server via DDP or HTTP.

<table>
  <thead>
    <tr>
      <th align="right">
        Param/Type
      </th>
      <th>
        Description
      </th>
      <th>
        Comment
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="right">
        `settings` {*Object*}
      </td>
      <td>
        [REQUIRED]
      </td>
      <td>
        See all options below
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.file` {*File*} or {*Object*} or {*String*}
      </td>
      <td>
        [REQUIRED] HTML5 `files` item
      </td>
      <td>
        Ex.: From event: `event.currentTarget.files[0]`
        <br />
        Set to dataURI {*String*} for Base64
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.fileId` {*String*}
      </td>
      <td>
        Explicitly set the fileId for the file
      </td>
      <td>
        This is an optionnal parameters `Random.id()` will be used otherwise
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.fileName` {*String*}
      </td>
      <td>
        [REQUIRED] <strong>only</strong> for `base64` uploads
      </td>
      <td>
        For regular uploads this option is [OPTIONAL], will replace default file's name provided in HTML5 `files` item
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.isBase64` {*Boolean*}
      </td>
      <td>
        Upload as base64 string, useful for data taken from `canvas`
      </td>
      <td>
        <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md#upload-base64-string">See Examples</a>
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.meta` {*Object*}
      </td>
      <td>
        Additional file-related data
      </td>
      <td>
        Ex.: `ownerId`, `postId`, etc.
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.transport` {*String*}
      </td>
      <td>
        Must be set to
        `http` or `ddp`
      </td>
      <td>
        Note: upload via `http` is at least twice faster. `HTTP` will properly work only with "sticky sessions"
        <br />
        Default: `ddp`
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.ddp` {*Object*}
      </td>
      <td>
        Custom DDP connection for upload. Object returned form `DDP.connect()`
      </td>
      <td>
        By default `Meteor` (The default DDP connection)
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.onStart` {*Function*}
      </td>
      <td>
        Callback, triggered when upload is started and validations was successful<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error` - *Always* `null`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `settings.onUploaded` {*Function*}
      </td>
      <td>
        Callback, triggered when upload is finished<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error`</li>
          <li>`fileRef` {*Object*} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `settings.onAbort` {*Function*}
      </td>
      <td>
        Callback, triggered when `abort()` method is called<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `settings.onError` {*Function*}
      </td>
      <td>
        Callback, triggered when upload finished with error<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `settings.onProgress` {*Function*}
      </td>
      <td>
        Callback, triggered after chunk is sent<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`progress` {*Number*} - Current progress from `0` to `100`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `settings.onBeforeUpload` {*Function*}
      </td>
      <td>
        Callback, triggered right before upload is started<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td>
        Use to check file-type, extension, size, etc.
        <ul>
          <li><strong>return</strong> `true` to continue</li>
          <li><strong>return</strong> `false` to abort or {*String*} to abort upload with message</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.chunkSize` {*Number*|dynamic}
      </td>
      <td>
        Chunk size for upload
      </td>
      <td>
        `dynamic` is recommended
      </td>
    </tr>
    <tr>
      <td align="right">
        `settings.allowWebWorkers` {*Boolean*}
      </td>
      <td>
        Use WebWorkers (*To avoid main thread blocking*) whenever feature is available in browser
      </td>
      <td>
        Default: `true`
      </td>
    </tr>
    <tr>
      <td align="right">
        `autoStart` {*Boolean*}
      </td>
      <td>
        Start upload immediately
      </td>
      <td>
        If set to `false`, you need manually call `.start()` method on returned class. Useful to set EventListeners, before starting upload. Default: `true`
      </td>
    </tr>
  </tbody>
</table>

`FilesCollection#insert()` method returns `FileUpload` class instance. __Note__: same instance is used *context* in all callback functions (*see above*)

## `FileUpload`

<table>
  <thead>
    <tr>
      <th align="right">
        Name/Type
      </th>
      <th>
        Description
      </th>
      <th>
        Comment
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="right">
        `file` {*File*}
      </td>
      <td>
        Source file passed into `insert()` method
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `onPause` {*ReactiveVar*}
      </td>
      <td>
        Is upload process on the pause?
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `progress` {*ReactiveVar*}
      </td>
      <td>
        Upload progress in percents
      </td>
      <td>
        `0` - `100`
      </td>
    </tr>
    <tr>
      <td align="right">
        `pause()` {*Function*}
      </td>
      <td>
        Pause upload process
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `continue()` {*Function*}
      </td>
      <td>
        Continue paused upload process
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `toggle()` {*Function*}
      </td>
      <td>
        Toggle `continue`/`pause` if upload in the progress
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `abort()` {*Function*}
      </td>
      <td>
        Abort current upload, then trigger `onAbort` callback
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `pipe()` {*Function*}
      </td>
      <td>
        Pipe data before upload
      </td>
      <td>
        All data must be in `data URI` scheme (*Base64*)
      </td>
    </tr>
    <tr>
      <td align="right">
        `estimateTime` {*ReactiveVar*}
      </td>
      <td>
        Remaining upload time in <strong>milliseconds</strong>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `estimateSpeed` {*ReactiveVar*}
      </td>
      <td>
        Current upload speed in <strong>bytes/second</strong>
      </td>
      <td>
        To convert into speed, take a look on <a href="https://github.com/avoidwork/filesize.js">filesize package</a>, usage: `filesize(estimateSpeed, {bits: true}) + '/s';`
      </td>
    </tr>
    <tr>
      <td align="right">
        `state` {*ReactiveVar*}
      </td>
      <td>
        String, indicates current state of the upload
      </td>
      <td>
        <ul>
          <li>`active` - file is currently actively uploading</li>
          <li>`paused` - file upload is paused</li>
          <li>`aborted` - file upload has been aborted and can no longer be completed</li>
          <li>`completed` - file has been successfully uploaded</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

### `FileUpload` events map

<table>
  <thead>
    <tr>
      <th align="right">
        Name
      </th>
      <th>
        Description
      </th>
      <th>
        Comment
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="right">
        `start`
      </td>
      <td>
        Triggered when upload is started (*before sending first byte*) and validations was successful.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>`error` - *Always* `null`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `data`
      </td>
      <td>
        Triggered after each chunk is read.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            `data` {*String*} - Base64 encoded chunk (DataURL)
          </li>
        </ul>
      </td>
      <td>
        Can be used to display previews or do something else with loaded file during upload. To get EOF use `readEnd` event
      </td>
    </tr>
    <tr>
      <td align="right">
        `readEnd`
      </td>
      <td>
        Triggered after file is fully read by browser
      </td>
      <td>
        Has no arguments
      </td>
    </tr>
    <tr>
      <td align="right">
        `progress`
      </td>
      <td>
        Triggered after each chunk is sent.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`progress` {*Number*} - Current progress from `0` to `100`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `pause`
      </td>
      <td>
        Triggered after upload process set to pause.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `continue`
      </td>
      <td>
        Triggered after upload process is continued from pause.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `abort`
      </td>
      <td>
        Triggered after upload is aborted.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `uploaded`
      </td>
      <td>
        Triggered when upload is finished.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error`</li>
          <li>`fileRef` {*Object*} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `error`
      </td>
      <td>
        Triggered whenever upload has an error.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error`</li>
          <li>`fileData` {*Object*}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        `end`
      </td>
      <td>
        Triggered at the very end of upload or by `.abort()`.<br />
        In case if `end` triggered by `.abort()`, the server could return a `408` response code.<br />
        <strong>Arguments</strong>:
        <ul>
          <li>`error`</li>
          <li>`fileRef` {*Object*} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
  </tbody>
</table>

When `autoStart` *is* `false` *before calling* `.start()` you can "pipe" data through any function, data comes as Base64 string (DataURL). You must return Base64 string from piping function, for more info - see example below. __Do not forget to change file name, extension and mime-type if required__.

The `fileData` object (*see above*):

- `size` {*Number*} - File size in bytes
- `type` {*String*}
- `mime`, `mime-type` {*String*}
- `ext`, `extension` {*String*}
- `name` {*String*} - File name

## Examples

Upload form and `.insert()` method examples

### Upload form:

```handlebars
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

```js
// /imports/collections/images.js
import { FilesCollection } from 'meteor/ostrio:files';

const Images = new FilesCollection({collectionName: 'Images'});
// Export created instance of the FilesCollection
export { Images };
```

Client's code:

```js
import { ReactiveVar } from 'meteor/reactive-var';
import { Template }    from 'meteor/templating';
import { Images }      from '/imports/collections/images.js';

Template.uploadForm.onCreated(function () {
  this.currentFile = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentFile() {
    Template.instance().currentFile.get();
  }
});

Template.uploadForm.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // there was multiple files selected
      const file = e.currentTarget.files[0];

      Images.insert({
        file: file,
        onStart() {
          template.currentFile.set(this);
        },
        onUploaded(error, fileObj) {
          if (error) {
            alert('Error during upload: ' + error);
          } else {
            alert(`File "${fileObj.name}" successfully uploaded`);
          }
          template.currentFile.set(false);
        },
        chunkSize: 'dynamic'
      });
    }
  }
});
```

### Using events

Events-driven upload

```js
import { Template } from 'meteor/templating';
import { Images }   from '/imports/collections/images.js';

Template.uploadForm.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      Images.insert({
        file: e.currentTarget.files[0],
        chunkSize: 'dynamic'
      }, false).on('start', function () {
        template.currentFile.set(this);
      }).on('end', function (error, fileObj) {
        if (error) {
          alert('Error during upload: ' + error);
        } else {
          alert(`File "${fileObj.name}" successfully uploaded`);
        }
        template.currentFile.set(false);
      }).start();
    }
  }
});
```

### Using events no.2

Another way to upload using events:

```js
import { Template } from 'meteor/templating';
import { Images }   from '/imports/collections/images.js';

Template.uploadForm.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      const uploader = Images.insert({
        file: e.currentTarget.files[0],
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
          alert(`File "${fileObj.name}" successfully uploaded`);
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

### Upload base64 String

```js
import { Images } from '/imports/collections/images.js';

// As dataURI
Images.insert({
  file: 'data:image/png,base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png' // <— Mandatory
});

// As base64:
Images.insert({
  file: 'image/png,base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png' // <— Mandatory
});

// As plain base64:
Images.insert({
  file: 'base64str…',
  isBase64: true, // <— Mandatory
  fileName: 'pic.png', // <— Mandatory
  type: 'image/png' // <— Mandatory
});
```

### Piping

Note: data flow in `ddp` and `http` uses dataURI (e.g. *Base64*)

```js
import { Template } from 'meteor/templating';
import { Images }   from '/imports/collections/images.js';

const encrypt = function encrypt(data) {
  return someHowEncryptAndReturnAsBase64(data);
};

const zip = function zip(data) {
  return someHowZipAndReturnAsBase64(data);
};

Template.uploadForm.events({
  'change #fileInput'(e) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      Images.insert({
        file: e.currentTarget.files[0],
        chunkSize: 'dynamic'
      }, false).pipe(encrypt).pipe(zip).start();
    }
  }
});
```
