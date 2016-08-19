##### `insert(settings[, autoStart])` [*Client*]
*Upload file to Server via DDP, [RTC/DC](https://github.com/VeliovGroup/Meteor-Files/tree/webrtc-data-channel) or HTTP.*

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
        <code>settings</code> {<em>Object</em>}
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
        <code>settings.file</code> {<em>File</em>} or {<em>Object</em>}
      </td>
      <td>
        [REQUIRED] HTML5 <code>files</code> item
      </td>
      <td>
        Ex.: From event: <code>event.currentTarget.files[0]</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.meta</code> {<em>Object</em>}
      </td>
      <td>
        Additional file-related data
      </td>
      <td>
        Ex.: <code>ownerId</code>, <code>postId</code>, etc.
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.transport</code> {<em>String</em>}
      </td>
      <td>
        Must be set to 
        <code>http</code> or <code>ddp</code>
      </td>
      <td>
        Note: upload via <code>http</code> is at least twice faster. <code>HTTP</code> will properly work only with "sticky sessions"
        <br />
        Default: <code>ddp</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onStart</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered when upload is started and validations was successful<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code> - <em>Always</em> <code>null</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onUploaded</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered when upload is finished<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code></li>
          <li><code>fileRef</code> {<em>Object</em>} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onAbort</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered when <code>abort()</code> method is called<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onError</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered when upload finished with error<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onProgress</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered after chunk is sent<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>progress</code> {<em>Number</em>} - Current progress from <code>0</code> to <code>100</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.onBeforeUpload</code> {<em>Function</em>}
      </td>
      <td>
        Callback, triggered right before upload is started<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td>
        Use to check file-type, extension, size, etc.
        <ul>
          <li><strong>return</strong> <code>true</code> to continue</li>
          <li><strong>return</strong> <code>false</code> to abort or {<em>String</em>} to abort upload with message</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.streams</code> {<em>Number</em>|dynamic}
      </td>
      <td>
        Quantity of parallel upload streams
      </td>
      <td>
        <code>dynamic</code> is recommended
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.chunkSize</code> {<em>Number</em>|dynamic}
      </td>
      <td>
        Chunk size for upload
      </td>
      <td>
        <code>dynamic</code> is recommended
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>settings.allowWebWorkers</code> {<em>Boolean</em>}
      </td>
      <td>
        Use WebWorkers (<em>To avoid main thread blocking</em>) whenever feature is available in browser
      </td>
      <td>
        Default: <code>true</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>autoStart</code> {<em>Boolean</em>}
      </td>
      <td>
        Start upload immediately
      </td>
      <td>
        If set to <code>false</code>, you need manually call <code>.start()</code> method on returned class. Useful to set EventListeners, before starting upload. Default: <code>true</code>
      </td>
    </tr>
  </tbody>
</table>

<code>insert()</code> method returns <code>FileUpload</code> class instance. <strong>Note</strong>: same instance is used as <em><strong>context</strong></em> in all callback functions (<em>see above</em>)

#### <code>FileUpload</code> methods and properties:
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
        <code>file</code> {<em>File</em>}
      </td>
      <td>
        Source file passed into <code>insert()</code> method
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>onPause</code> {<em>ReactiveVar</em>}
      </td>
      <td>
        Is upload process on the pause?
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>progress</code> {<em>ReactiveVar</em>}
      </td>
      <td>
        Upload progress in percents
      </td>
      <td>
        <code>0</code> - <code>100</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>pause()</code> {<em>Function</em>}
      </td>
      <td>
        Pause upload process
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>continue()</code> {<em>Function</em>}
      </td>
      <td>
        Continue paused upload process
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>toggle()</code> {<em>Function</em>}
      </td>
      <td>
        Toggle <code>continue</code>/<code>pause</code> if upload in the progress
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>abort()</code> {<em>Function</em>}
      </td>
      <td>
        Abort current upload, then trigger <code>onAbort</code> callback
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>pipe()</code> {<em>Function</em>}
      </td>
      <td>
        Pipe data before upload
      </td>
      <td>
        All data must be in <code>data URI</code> scheme (*Base64*)<br />
        Only for <code>webrtc</code> transport data represented as <code>ArrayBuffer</code>.
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>estimateTime</code> {<em>ReactiveVar</em>}
      </td>
      <td>
        Remaining upload time in <strong>milliseconds</strong>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>estimateSpeed</code> {<em>ReactiveVar</em>}
      </td>
      <td>
        Current upload speed in <strong>bytes/second</strong>
      </td>
      <td>
        To convert into speed, take a look on <a href="https://github.com/avoidwork/filesize.js">filesize package</a>, usage: 
        <code>filesize(estimateSpeed, {bits: true}) + '/s';</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>state</code> {<em>ReactiveVar</em>}
      </td>
      <td>
        String, indicates current state of the upload
      </td>
      <td>
        <ul>
          <li><code>active</code> - file is currently actively uploading</li>
          <li><code>paused</code> - file upload is paused</li>
          <li><code>aborted</code> - file upload has been aborted and can no longer be completed</li>
          <li><code>completed</code> - file has been successfully uploaded</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

### Events map:
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
        <code>start</code>
      </td>
      <td>
        Triggered when upload is started (<em>before sending first byte</em>) and validations was successful.<br>
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code> - <em>Always</em> <code>null</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>data</code>
      </td>
      <td>
        Triggered after each chunk is read.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>data</code> {<em>String</em>} - Base64 encoded chunk (DataURL)
          </li>
        </ul>
      </td>
      <td>
        Can be used to display previews or do something else with loaded file during upload. To get EOF use <code>readEnd</code> event
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>readEnd</code>
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
        <code>progress</code>
      </td>
      <td>
        Triggered after each chunk is sent.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>progress</code> {<em>Number</em>} - Current progress from <code>0</code> to <code>100</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>pause</code>
      </td>
      <td>
        Triggered after upload process set to pause.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>continue</code>
      </td>
      <td>
        Triggered after upload process is continued from pause.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>abort</code>
      </td>
      <td>
        Triggered after upload is aborted.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>uploaded</code>
      </td>
      <td>
        Triggered when upload is finished.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code></li>
          <li><code>fileRef</code> {<em>Object</em>} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>error</code>
      </td>
      <td>
        Triggered whenever upload has an error.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code></li>
          <li><code>fileData</code> {<em>Object</em>}</li>
        </ul>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>end</code>
      </td>
      <td>
        Triggered at the very end of upload.<br />
        <strong>Arguments</strong>:
        <ul>
          <li><code>error</code></li>
          <li><code>fileRef</code> {<em>Object</em>} - File record from DB</li>
        </ul>
      </td>
      <td></td>
    </tr>
  </tbody>
</table>

<em>When</em> <code>autoStart</code> <em>is</em> <code>false</code> <em>before calling</em> <code>.start()</code> <em>you can "pipe" data through any function, data comes as Base64 string (DataURL). You must return Base64 string from piping function, for more info - see example below. <strong>Do not forget to change file name, extension and mime-type if required</strong></em>.

The <code>fileData</code> object (<em>see above</em>):
 - <code>size</code> {<em>Number</em>} - File size in bytes
 - <code>type</code> {<em>String</em>}
 - <code>mime</code>, <code>mime-type</code> {<em>String</em>}
 - <code>ext</code>, <code>extension</code> {<em>String</em>}
 - <code>name</code> {<em>String</em>} - File name

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
Note: data flow in `webrtc` transport uses ArrayBuffer, while `ddp` and `http` uses dataURI (*Base64*). `webrtc` is available only on [webrtc-data-channel](https://github.com/VeliovGroup/Meteor-Files/tree/webrtc-data-channel) branch.

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