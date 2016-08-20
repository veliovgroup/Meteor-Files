Package.describe({
  name: 'ostrio:files',
  version: '1.7.0',
  summary: 'Fast and robust file upload package, with support of DDP, HTTP and WebRTC/DC uploads. Support of FS, AWS, GridFS, DropBox or Google Drive',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4');
  api.use('webapp', 'server');
  api.use(['templating', 'reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo','underscore', 'check', 'random', 'coffeescript', 'ecmascript', 'ostrio:cookies@2.0.5'], ['client', 'server']);
  api.addFiles('event-emitter.jsx', 'client');
  api.addAssets('worker.min.js', 'client');
  api.mainModule('files.coffee', ['server', 'client']);
  api.export('FilesCollection');
});

Npm.depends({
  'fs-extra': '0.30.0',
  'request': '2.74.0',
  'throttle': '1.0.3',
  'file-type': '3.8.0'
});
