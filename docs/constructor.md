### `new FilesCollection([config])` [*Isomorphic*]

*Initialize FilesCollection collection.*

- [Methods](#methods)
- [Examples](#examples)

<table valign="top">
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
        <code>function { return 'assets/app/uploads'; }</code>
        <br />
        Always converted into the function since <code>v1.7.4</code>
      </td>
      <td>
        Relative to running script<br />
        If <em>Function</em> is passed it must return <em>String</em>, arguments:
        <ul>
          <li>
            <code>defaultPath</code> - Default recommended path
          </li>
        </ul>
        Context is current <em>FilesCollection</em> instance.<br /><br />
        Note: When running in development mode files stored at a relative path (within the Meteor project) are silently removed when Meteor is restarted.<br /><br />
        To preserve files in development mode store them outside of the Meteor application, e.g. <code>/data/Meteor/uploads/</code><br /><br />
        The Meteor-Files package operates on the host filesystem, unlike Meteor Assets. When a relative path is specified for <code>config.storagePath</code> (path starts with ./ or no slash) files will be located relative to the assets folder.<br /><br />  When an absolute path is used (path starts with /) files will be located starting at the root of the filesystem.
        <br /><br />If using <a href="https://github.com/kadirahq/meteor-up">MeteorUp</a>, Docker volumes has to be created in <code>mup.json</code>, see <a href="https://github.com/bryanlimy/Meteor-Files/blob/master/docs/constructor.md#example-on-using-meteorup">Usage on MeteorUp</a>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.collection</code> {<em>Mongo.Collection</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Mongo.Collection Instance
      </td>
      <td>
      </td>
      <td>
        You can pass your own Mongo Collection instance <code>{collection: new Mongo.Collection('myFiles')}</code>
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
        <code>config.continueUploadTTL</code> {<em>Number</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Time in seconds, during upload may be continued, default 3 hours (10800 seconds)
      </td>
      <td>
        <code>10800</code> (3 hours)
      </td>
      <td>
        If upload is not continued during this time, memory used for this upload will be freed. And uploaded chunks is removed. Server will no longer wait for upload, all further upload attempts will result <code>408</code> Error (<code>Can't continue upload, session expired. Start upload again.</code>)
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.ddp</code> {<em>Object</em>}
      </td>
      <td>
        Client
      </td>
      <td>
        Custom DDP connection for Collection. Object returned form <code>DDP.connect()</code>
      </td>
      <td>
        <code>Meteor</code> (The default DDP connection)
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
        <code>config.responseHeaders</code> {<em>Object</em>|<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Allows to change default response headers
      </td>
      <td>
        <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md#default-function">Default <em>Function</em></a>
      </td>
      <td>
        We recommend to keep original function structure, with your modifications, see <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/custom-response-headers.md#adding-custom-header-example">example altering default headers</a>
      </td>
    </tr>
    <tr>
      <td align="right">
        <b>DEPRECATED</b> <code>config.throttle</code> {<em>Number</em>|<em>false</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        <b>DEPRECATED</b> Throttle download speed in <em>bps</em>
      </td>
      <td>-</td>
      <td>
        TEMPORARILY DEPRECATED SINCE v1.9.0
      </td>
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
        <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema">Default Schema</a>
      </td>
      <td>
        <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema">For more info read Schema docs</a>
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
        Upload &amp; Serve (<em>for 206 response</em>) chunk size
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
        Function which returns <code>String</code>. Use it to create nested directories in the storage folder. <b>Note: file extension appended to returned value</b>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Primary sets file name on <code>FS</code><br />
        if <code>namingFunction</code> is not set<br />
        <code>FS</code>-name is equal to file's record <code>_id</code>
      </td>
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
            <code>fileObj</code> - see <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema">schema</a>
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
            <code>this.userAsync()</code>
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
        Server
      </td>
      <td>
        <em>Control download flow.</em><br>
        If function:<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>fileObj</code> {<em>Object</em>|<em>null</em>} - If requested file exists - <a href="https://github.com/veliovgroup/Meteor-Files/blob/master/docs/schema.md#schema">file object</a>, otherwise -
            <code>null</code>
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
            <code>this.userAsync()</code>
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
            <code>this.userAsync()</code>
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
        <p><del><i>note: Because sending <code>meta</code> data as part of every chunk would hit the performance, <code>meta</code> is always empty ({}) except on the first chunk (chunkId=1 or chunkId=-1) and on eof (eof=true or chunkId=-1)</i></del> (<i>Fixed</i>. Since <code>v1.6.0</code> full file object is available in <code>onBeforeUpload</code> callback)</p>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.onInitiateUpload</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Function which executes on server right before upload is begin and right after <code>onBeforeUpload</code> hook returns <code>true</code>. This hook <strong>called only once per upload</strong> and fully asynchronous.<br>
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
            <code>this.userAsync()</code>
          </li>
          <li>
            <code>this.userId</code>
          </li>
          <li>
            <code>this.chunkId</code> {<em>Number</em>} - On <strong>server only</strong>
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        See: <a href="https://github.com/veliovgroup/Meteor-Files/issues/208">#208</a>
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
        Callback, triggered right before remove file (<b>from <i>Client</i></b>)<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>cursor</code> {<em>MongoCursor</em>} - Current files to be removed on cursor, <em>if has any</em>
          </li>
        </ul><br>
        <strong>Context</strong>:
        <ul>
          <li>
            <code>this.userAsync()</code>
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
        <code>config.onAfterRemove</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Callback, triggered after file(s) is removed from Collection<br>
        <strong>Arguments</strong>:
        <ul>
          <li>
            <code>files</code> {<em>[Object]</em>} - Array of removed documents
          </li>
        </ul>
      </td>
      <td>
        <code>false</code>
      </td>
      <td></td>
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
        <code>config.interceptRequest</code> {<em>Function</em>}
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
            <code>http.params</code> {<em>Object</em>} - Data extracted from URI
          </li>
          <li>
            <code>http.params._id</code> {<em>String</em>} - File's `_id`
          </li>
          <li>
            <code>http.params.query</code> {<em>String</em>} - Request get query
          </li>
          <li>
            <code>http.params.name</code> {<em>String</em>} - Request file name from URI
          </li>
          <li>
            <code>http.params.version</code> {<em>String</em>} - File's version name from URI
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
            <code>http.params</code> {<em>Object</em>} - Data extracted from URI
          </li>
          <li>
            <code>http.params._id</code> {<em>String</em>} - File's `_id`
          </li>
          <li>
            <code>http.params.query</code> {<em>String</em>} - Request get query
          </li>
          <li>
            <code>http.params.name</code> {<em>String</em>} - Request file name from URI
          </li>
          <li>
            <code>http.params.version</code> {<em>String</em>} - File's version name from URI
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
    <tr>
      <td align="right">
        <code>config.disableUpload</code> {<em>Boolean</em>}
      </td>
      <td>
        Both
      </td>
      <td>
        Disable upload from <em>Client</em> to <em>Server</em> (HTTP and DDP (WebSockets))
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Use for security reasons when only <em>Server</em> usage is needed
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.disableDownload</code> {<em>Boolean</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Disable file download from <em>Server</em> to <em>Client</em> (HTTP)
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        Use for security reasons when only upload from <em>Client</em> to <em>Server</em> usage is needed, and files shouldn't be downloaded by any user.
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.allowedOrigins</code> {<em>Regex</em>|<em>Boolean</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Regex of Origins that are allowed CORS access or `false` to disable completely.
      </td>
      <td>
        <code>/^http:\/\/localhost:12[0-9]{3}$/</code>
      </td>
      <td>
        Defaults to `/^http:\/\/localhost:12[0-9]{3}$/` for allowing Meteor-Cordova builds access.
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.allowQueryStringCookies</code> {<em>Regex</em>|<em>Boolean</em>}
      </td>
      <td>
        Isomorphic
      </td>
      <td>
        Allow passing Cookies in a query string (in URL). Primary should be used only in Cordova environment. Note: this option will be used only on Cordova. Directly passed to `ostrio:cookies` package
      </td>
      <td>
        <code>false</code>
      </td>
      <td>
        <strong>Highly recommended to use with Cordova</strong>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.getUser</code> {<em>Function</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Replace default way of recognizing user.
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
        </ul>
      </td>
      <td>
        Default function recognizing user based on x_mtok cookie.
      </td>
      <td>
        Useful when you want to auth user based on custom cookie (or other way).
        Must return <code>null</code> or <code>{userId: null|String, userAsync: function => Promise&lte;null|user&gte; }</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.disableSetTokenCookie</code> {<em>Boolean</em>}
      </td>
      <td>
        Client
      </td>
      <td>
        Disable automatic cookie setting
      </td>
      <td>
      </td>
      <td>
       Useful when you use multiple file collections or when you want to implement your own authorization.
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config.sanitize</code> {<em>Function</em>}
      </td>
      <td>
        Server (*accepted, but no used on the Client*)
      </td>
      <td>
        Sanitizer for sensitive Strings; Overrides default <code>sanitize()</code> method of <em>FilesCollection</em> instance. Primary used for <code>FSName</code> and <code>fileId</code>. <em>Very low-level</em>. <b>Warning: use with caution!</b>
      </td>
      <td>
        <a href="https://github.com/veliovgroup/Meteor-Files/blob/313e842468f743c04a5310778ea63c7fd2d3c612/lib.js#L4-L6">Default function</a>
      </td>
      <td>
        Read more in <a href="https://github.com/veliovgroup/Meteor-Files/issues/847">#847</a>, <a href="https://github.com/wekan/wekan/pull/4638">wekan/#4638</a>, and <a href="https://github.com/wekan/wekan/issues/4640">wekan/#4640</a>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config._preCollection</code> {<em>Mongo.Collection</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        Mongo.Collection Instance
      </td>
      <td>
      </td>
      <td>
        You can pass your own Mongo Collection instance <code>{_preCollection: new Mongo.Collection('__pre_myFiles')}</code>
      </td>
    </tr>
    <tr>
      <td align="right">
        <code>config._preCollectionName</code> {<em>String</em>}
      </td>
      <td>
        Server
      </td>
      <td>
        preCollection name
      </td>
      <td>
        <code>__pre_MeteorUploadFiles</code>
      </td>
      <td></td>
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

### Methods

List of available methods on `FilesCollection` instance:

- [`insert()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md) [*Client*] - Upload file(s) from client to server
- [`insertAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insertAsync.md) [*Client*] - Upload file(s) from client to server
  - [`FileUpload#pipe()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/insert.md#piping)
- `write()` — [*DEPRECTAED IN `v3.0.0`*]
- [`writeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/writeAsync.md) [*Server*] - Write `Buffer` to FS and FilesCollection
- `load()` - [*DEPRECATED IN `v3.0.0`*]
- [`loadAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/loadAsync.md) [*Server*] - Write file to FS and FilesCollection from remote URL
- [`addFile()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/addFile.md) [*Server*] - Add local file to FilesCollection from FS
- `findOne()` — [*DEPRECATED IN `v3.0.0`*]
- [`findOneAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/findOneAsync.md) [*Anywhere*] - Find one file in FilesCollection; Returns [`FileCursor`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FileCursor.md)
- [`find()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/find.md) [*Anywhere*] - Create cursor for FilesCollection; Returns [`File__s__Cursor`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/FilesCursor.md)
- `remove()` — [*DEPRECATED IN `v3.0.0`*]
- [`removeAsync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/removeAsync.md) [*Anywhere*] - Remove files from FilesCollection and "unlink" (e.g. remove) from FS
- `unlink()` - [*DEPRECATED IN `v3.0.0`*]
- [`unlinkASync()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/unlinkAsync.md) [*Server*] - "Unlink" (e.g. remove) file from FS
- [`link()`](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/link.md) [*Anywhere*] - Generate downloadable link
- [`collection` property](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/collection.md) [*Anywhere*] - `Meteor.Collection` instance

### Examples

```js
import { FilesCollection, helpers } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({
  storagePath: 'assets/app/uploads/images',
  downloadRoute: '/files/images',
  collectionName: 'images',
  permissions: 0o755,
  allowClientCode: false,
  cacheControl: 'public, max-age=31536000',
  // Read more about cacheControl: https://devcenter.heroku.com/articles/increasing-application-performance-with-http-cache-headers
  onbeforeunloadMessage() {
    return 'Upload is still in progress! Upload will be aborted if you leave this page!';
  },
  onBeforeUpload(file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    // Note: You should never trust to extension and mime-type here
    // as this data comes from client and can be easily substitute
    // to check file's "magic-numbers" use `mmmagic` or `file-type` package
    // real extension and mime-type can be checked on client (untrusted side)
    // and on server at `onAfterUpload` hook (trusted side)
    if (file.size <= 10485760 && /png|jpe?g/i.test(file.ext)) {
      return true;
    }
    return 'Please upload image, with size equal or less than 10MB';
  },
  downloadCallback(fileObj) {
    if (this.params.query.download == 'true') {
      // Increment downloads counter
      imagesCollection.update(fileObj._id, {$inc: {'meta.downloads': 1}});
    }
    // Must return true to continue download
    return true;
  },
  protected(fileObj) {
    // Check if current user is owner of the file
    if (fileObj.meta.owner === this.userId) {
      return true;
    }
    return false;
  },
  namingFunction(file) {
    // MAKE SURE namingFunction IS SET ON Server
    // OVERWRITE Client's namingFunction FOR SECURITY REASONS AGAINST REVERSE-ENGINEERING ACTIONS
    return helpers.sanitize(file.fileId);
  },
});

// Export FilesCollection instance, so it can be imported in other files
export default imagesCollection;
```

### Add extra security:

Attach SimpleSchema and `.denyClient` insecure calls to limit window for error

#### Attach schema [*Isomorphic*]:

*To attach schema, use/install [`aldeed:collection2`](https://github.com/aldeed/meteor-collection2) and [simple-schema](https://atmospherejs.com/aldeed/simple-schema) packages.*

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({/* ... */});
imagesCollection.collection.attachSchema(new SimpleSchema(imagesCollection.schema));
```

*You're free to extend the schema to include your own properties. The default schema is stored under* `FilesCollection.schema` *object.*

```js
import { FilesCollection } from 'meteor/ostrio:files';
const mySchema = {
  ...FilesCollection.schema,
  myProp: String,
  myOtherProp: {
    type: Array
  }
};
const imagesCollection = new FilesCollection({
  /* ... */
  schema: mySchema
});
imagesCollection.collection.attachSchema(new SimpleSchema(mySchema));
```

#### Deny collection interaction on client [*Server*]:

Deny insert/update/remove from client

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

if (Meteor.isServer) {
  const imagesCollection = new FilesCollection({/* ... */});
  imagesCollection.deny({
    insert() {
      return true;
    },
    update() {
      return true;
    },
    remove() {
      return true;
    }
  });

  /* Equal shortcut: */
  imagesCollection.denyClient();
}
```

#### Allow collection interaction on client [*Server*]:

Allow insert/update/remove from client

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

if (Meteor.isServer) {
  const imagesCollection = new FilesCollection({/* ... */});
  imagesCollection.allow({
    insert() {
      return true;
    },
    update() {
      return true;
    },
    remove() {
      return true;
    }
  });

  /* Equal shortcut: */
  imagesCollection.allowClient();
}
```

#### Events listeners:

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({/* ... */});
// Alias addListener
imagesCollection.on('afterUpload', function (fileRef) {
  /* `this` context is the imagesCollection (FilesCollection) instance */
});
```

#### Use onBeforeUpload to avoid unauthorized upload:

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({
  collectionName: 'images',
  allowClientCode: true,
  async onBeforeUpload() {
    if (this.userId) {
      const user = await this.userAsync();
      if (user.profile.role === 'admin') {
        // Allow upload only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return 'Not enough rights to upload a file!';
  }
});
```

#### Use onBeforeRemove to avoid unauthorized remove:

For more info see [remove method](https://github.com/veliovgroup/Meteor-Files/blob/master/docs/remove.md).

```js
import { FilesCollection } from 'meteor/ostrio:files';
const imagesCollection = new FilesCollection({
  collectionName: 'images',
  allowClientCode: true,
  async onBeforeRemove() {
    if (this.userId) {
      const user = await this.userAsync();
      if (user.profile.role === 'admin') {
        // Allow removal only if
        // current user is signed-in
        // and has role is `admin`
        return true;
      }
    }

    return false;
  }
});
```

#### Use onAfterUpload to avoid mime-type and/or extension substitution:

For additional security, it's recommended to verify the mimetype by looking at the content of the file and delete it, if it looks malicious. E.g. you can use [`mmmagic` package](https://github.com/mscdex/mmmagic) for this:

```js
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';

const imagesCollection = new FilesCollection({
  collectionName: 'images',
  onAfterUpload(file) {
    if (Meteor.isServer) {
      // check real mimetype
      const { Magic, MAGIC_MIME_TYPE } = require('mmmagic');
      const magic = new Magic(MAGIC_MIME_TYPE);
      magic.detectFile(file.path, Meteor.bindEnvironment((err, mimeType) => {
        if (err || !mimeType.includes('image')) {
          // is not a real image --> delete
          console.log('onAfterUpload, not an image: ', file.path);
          console.log('deleted', file.path);
          this.remove(file._id);
        }
      }));
    }
  }
});
```
