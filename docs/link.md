##### `link(fileRef [, version])` [*Isomorphic*]

*Create downloadable link.*

 - `fileRef` {*Object*} - Object returned from MongoDB collection, like: `FilesCollection.collection.findOne({})`
 - `version` {*String*} - File's subversion name, default: `original`. If requested subversion isn't found, `original` will be returned
 - Returns {*String*} - Full URL to file

```javascript
var Images = new FilesCollection({collectionName: 'Images'});

// Usage:
Images.collection.find({}).forEach(function (fileRef) {
  Images.link(fileRef);
});

Images.findOne({}).link();
// Get thumbnail subversion
Images.findOne({}).link('thumbnail');
// Equals to above
var fileRef = Images.collection.findOne({});
Images.link(fileRef, 'thumbnail');
```
  
  

*Optional: Share link across different domain or subdomains*

[Cross-origin resource sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS):
> A resource makes a cross-origin HTTP request when it requests a resource from a different domain, or port than the one which the first resource itself serves. For example, an HTML page served from http://domain-a.com makes an <img> src request for http://domain-b.com/image.jpg. Many pages on the web today load resources like CSS stylesheets, images and scripts from separate domains.

__[Server]__

```javascript
/** Listen to incoming HTTP requests, can only be used on the server
 ** http://www.something.com/path/to/intercept
 **/
WebApp.rawConnectHandlers.use("/path/to/intercept", function(req, res, next) {
  //define white list of urls, or can be done like adding subdomain as prefix to Meteor.absoluteUrl();
  let whiteList = [];
  const found = _.find(whiteList, function(url) {
    return url == req.headers.origin;
  });
  if(found){
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  }
  return next();
});
```

