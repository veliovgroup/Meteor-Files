##### `new FilesCollection([config])` [*Isomorphic*]
*Initialize FilesCollection collection.*

<table>
  <thead>
    <tr>
      <th align="right">
        Param/Type
      </th>
      <th>
        Locus
      </th>
      <th>
        Description
      </th>
      <th>
        Default
      </th>
      <th>
        Comment
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="right">
        <code>config</code> {<em>Object</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        [Optional]
      </td>
      <td>
        <code>{}</code>
      </td>
      <td>
        See all options below
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.storagePath</code> {<em>String</em>|<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Storage path on file system
      </td>
      <td>
        <code>assets/app/uploads</code>
      </td>
      <td>
        Relative to running script<br />
        If <em>Function</em> is passed it must return <em>String</em>, arguments:
        <ul>
          <li>
            <code>defaultPath</code> - Default recommended path
          </li>
        </ul>
        Context is current <em>FilesCollction</em> instance
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.collectionName</code> {<em>String</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Collection name
      </td>
      <td>
        <code>MeteorUploadFiles</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.cacheControl</code> {<em>String</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Set <code>Cache-Control</code> header
      </td>
      <td>
        <code>public, max-age=31536000, s-maxage=31536000</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.throttle</code> {<em>Number</em>|<em>false</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Throttle download speed in <em>bps</em>
      </td>
      <td>
        <code>false</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.downloadRoute</code> {<em>String</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Server Route used to retrieve files
      </td>
      <td>
        <code>/cdn/storage</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.schema</code> {<em>Object</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Collection Schema
      </td>
      <td>
        <a href="https://github.com/VeliovGroup/Meteor-Files/wiki/Schema">Default Schema</a>
      </td>
      <td>
        <a href="https://github.com/VeliovGroup/Meteor-Files/wiki/Schema">For more info read Schema docs</a>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.chunkSize</code> {<em>Number</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Upload &amp; Serve (<em>for 206 responce</em>) chunk size
      </td>
      <td>
        <code>272144</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.namingFunction</code> {<em>Function</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Function which returns <code>String</code>
      </td>
      <td>
        <code>Random.id()</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.permissions</code> {<em>Number</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        FS-permissions (access rights) in octal
      </td>
      <td>
        <code>0644</code>
      </td>
      <td>
        ex.: <code>0755</code>, <code>0777</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.parentDirPermissions</code> {<em>Number</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        FS-permissions for parent directory (access rights) in octal
      </td>
      <td>
        <code>0755</code>
      </td>
      <td>
        ex.: <code>0777</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.integrityCheck</code> {<em>Boolean</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        CRC file check
      </td>
      <td>
        <code>true</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.strict</code> {<em>Boolean</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Strict mode for partial content
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        If is <code>true</code> server will return <code>416</code> response code, when <code>range</code> is not specified
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.downloadCallback</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Called right before initiate file download.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileObj</code> - see <a href="https://github.com/VeliovGroup/Meteor-Files/wiki/Schema">schema</a>
          </li>
        </ul><br>
        <strong>Context</strong>:
        <ul>
          <li>
            <code>this.request</code>
          </li>
          <li>
            <code>this.response</code>
          </li>
          <li>
            <code>this.user()</code>
          </li>
          <li>
            <code>this.userId</code>
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Function should return {<em>Boolean</em>} value, return <code>false</code> to abort download, and <code>true</code> to continue
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.protected</code> {<em>Boolean</em>|<em>Function</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        <em>Control download flow.</em><br>
        If function:<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileObj</code> {<em>Object</em>|<em>null</em>} - If requested file exists - <a href="https://github.com/VeliovGroup/Meteor-Files/wiki/Schema">file object</a>, otherwise -
            <code>null</code>
          </li>
        </ul><br>
        <strong>Context</strong>:
        <ul>
          <li>
            <code>this.request</code> - On <strong>server only</strong>
          </li>
          <li>
            <code>this.response</code> - On <strong>server only</strong>
          </li>
          <li>
            <code>this.user()</code>
          </li>
          <li>
            <code>this.userId</code>
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        If <code>true</code> - files will be served only to authorized users, if <code>function()</code> - you're able to check visitor's permissions in your own way.<br>
        <ul>
          <li>
            <strong>return</strong> <code>true</code> to continue
          </li>
          <li>
            <strong>return</strong> <code>false</code> to abort or {<em>Number</em>} to abort upload with specific response code, default response code is <code>401</code>
          </li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.public</code> {<em>Boolean</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Allows to place files in public directory of your web-server. And let your web-server to serve uploaded files
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Important notes:
        <ul>
          <li>Collection can not be <code>public</code> and <code>protected</code> at the same time!
          </li>
          <li>
            <code>downloadRoute</code> must be explicitly provided. And pointed to root of web/proxy-server, like <code>/uploads/</code>
          </li>
          <li>
            <code>storagePath</code> must point to absolute root path of web/proxy-server, like '/var/www/myapp/public/uploads/'
          </li>
          <li>
            <code>integrityCheck</code> is <strong>not</strong> guaranteed!
          </li>
          <li>
            <code>play</code> and force <code>download</code> features is <strong>not</strong> guaranteed!
          </li>
          <li>Remember: <a href="https://www.google.ru/search?q=nodejs+is+bad+in+serving+files">NodeJS is not best solution for serving files</a>
          </li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.onBeforeUpload</code> {<em>Function</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Callback, triggered right before upload is started on <strong>client</strong> and right after receiving a chunk on <strong>server</strong><br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileData</code> {<em>Object</em>} - Current file metadata
          </li>
        </ul><br>
        <strong>Context</strong>:
        <ul>
          <li>
            <code>this.file</code>
          </li>
          <li>
            <code>this.user()</code>
          </li>
          <li>
            <code>this.userId</code>
          </li>
          <li>
            <code>this.chunkId</code> {<em>Number</em>} - On <strong>server only</strong>
          </li>
          <li>
            <code>this.eof</code> {<em>Boolean</em>} - On <strong>server only</strong>
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        <ul>
          <li>
            <strong>return</strong> <code>true</code> to continue
          </li>
          <li>
            <strong>return</strong> <code>false</code> to abort or {<em>String</em>} to abort upload with message
          </li>
        </ul>
        <p><i>note: Because sending <code>meta</code> data as part of every chunk would hit the performance, <code>meta</code> is always empty ({}) except on the first chunk (chunkId=1) and on eof (eof=true)</i></p>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.onBeforeRemove</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Callback, triggered right before remove file<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>cursor</code> {<em>MongoCursor</em>} - Current files to be removed on cursor, <em>if has any</em>
          </li>
        </ul><br>
        <strong>Context</strong>:
        <ul>
          <li>
            <code>this.file</code>
          </li>
          <li>
            <code>this.user()</code>
          </li>
          <li>
            <code>this.userId</code>
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Use with <code>allowClientCode</code> to control access to <code>remove()</code> method.
        <ul>
          <li>
            <strong>return</strong> <code>true</code> to continue
          </li>
          <li>
            <strong>return</strong> <code>false</code> to abort
          </li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.onAfterUpload</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Callback, triggered after file is written to FS<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileRef</code> {<em>Object</em>} - Record from MongoDB
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Alternatively use: <code>addListener('afterUpload', func)</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.onbeforeunloadMessage</code> {<em>String</em>|<em>Function</em>}
      </td>
      <td>
        Client
      </td>
      <td>
        Message shown to user when closing browser's window or tab, while upload in the progress
      </td>
      <td>
        <code>Upload in a progress... Do you want to abort?</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.allowClientCode</code> {<em>Boolean</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Allow use <code>remove()</code> method on client
      </td>
      <td>
        <code>true</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.debug</code> {<em>Boolean</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Turn on/of debugging and extra logging
      </td>
      <td>
        <code>false</code>
      </td>
      <td></td>
    </tr>
    <tr>
      <td align="right">
        <code>config.interceptDownload</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Intercept download request.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>http</code> {<em>Object</em>} - Middleware request instance
          </li>
          <li>
            <code>http.request</code> {<em>Object</em>} - example: <code>http.request.headers</code>
          </li>
          <li>
            <code>http.response</code> {<em>Object</em>} - example: <code>http.response.end()</code>
          </li>
          <li>
            <code>fileRef</code> {<em>Object</em>} - Current file record from MongoDB
          </li>
          <li>
            <code>version</code> {<em>String</em>} - Requested file version
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Usage example: <em>Serve file from third-party resource</em>.<br>
        <ul>
          <li>
            <strong>return</strong> <code>false</code> from this function to continue standard behavior
          </li>
          <li>
            <strong>return</strong> <code>true</code> to intercept incoming request
          </li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>


### Event map:
<table>
  <thead>
    <tr>
      <th align="right">
        Name
      </th>
      <th>
        Locus
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
        <code>afterUpload</code>
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Triggered right after file is written to FS.<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileRef</code> {<em>Object</em>} - Record from MongoDB
          </li>
        </ul>
      </td>
      <td></td>
    </tr>
  </tbody>
</table>


### Examples:
```javascript
var Images;
Images = new FilesCollection({
  storagePath: 'assets/app/uploads/Images',
  downloadRoute: '/files/images'
  collectionName: 'Images',
  chunkSize: 1024*2048,
  throttle: 1024*512,
  permissions: 0755,
  allowClientCode: false,
  cacheControl: 'public, max-age=31536000',
  onbeforeunloadMessage: function () {
    return 'Upload is still in progress! Upload will be aborted if you leave this page!';
  },
  onBeforeUpload: function (file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.ext)) {
      return true;
    } else {
      return 'Please upload image, with size equal or less than 10MB';
    }
  },
  downloadCallback: function (fileObj) {
    if (this.params.query.download == 'true') {
      // Increment downloads counter
      Images.update(fileObj._id, {$inc: {'meta.downloads': 1}});
    }
    // Must return true to continue download
    return true;
  },
  protected: function (fileObj) {
    // Check if user is own this file
    if (fileObj.meta.owner === this.userId) {
      return true;
    } else {
      return false;
    }
  }
});
```

### Add extra security:

#### Attach schema [*Isomorphic*]:
*Default schema is stored under* `FilesCollection.schema` *object.*

*To attach schema, use/install [aldeed:collection2](https://github.com/aldeed/meteor-collection2) and [simple-schema](https://atmospherejs.com/aldeed/simple-schema) packages.*

*You're free to modify/overwrite* `FilesCollection.schema` *object.*
```javascript
var Images = new FilesCollection({/* ... */});
Images.collection.attachSchema(new SimpleSchema(Images.schema));
```

#### Deny collection interaction on client [*Server*]:
*Deny insert/update/remove from client*
```javascript
if (Meteor.isServer) {
  var Images = new FilesCollection({/* ... */});
  Images.deny({
    insert: function() {
      return true;
    },
    update: function() {
      return true;
    },
    remove: function() {
      return true;
    }
  });

  /* Equal shortcut: */
  Images.denyClient();
}
```

#### Allow collection interaction on client [*Server*]:
*Allow insert/update/remove from client*
```javascript
if (Meteor.isServer) {
  var Images = new FilesCollection({/* ... */});
  Images.allow({
    insert: function() {
      return true;
    },
    update: function() {
      return true;
    },
    remove: function() {
      return true;
    }
  });

  /* Equal shortcut: */
  Images.allowClient();
}
```

#### Events listeners:
```javascript
var Images = new FilesCollection({/* ... */});
// Alias addListener
Images.on('afterUpload', function (fileRef) {
  /* ... */
});
```

#### Use onBeforeUpload to avoid unauthorized upload:
```javascript
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeUpload: function () {
    if (this.userId) {
      var user = this.user();
      if (user.profile.role === 'admin') {
        // Allow upload only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return "Not enough rights to upload a file!";
  }
});
```

#### Use onBeforeRemove to avoid unauthorized remove:
*For more info see [remove method](https://github.com/VeliovGroup/Meteor-Files/wiki/remove).*
```javascript
var Images = new FilesCollection({
  collectionName: 'Images',
  allowClientCode: true,
  onBeforeRemove: function () {
    if (this.userId) {
      var user = this.user();
      if (user.profile.role === 'admin') {
        // Allow upload only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return false;
  }
});
```
