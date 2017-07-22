Package.describe({
  name: 'ostrio:files',
  version: '1.8.1',
  summary: 'File upload via DDP/HTTP to server FS, AWS, GridFS, DropBox, Google Drive or other 3rd party storage',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Npm.depends({
  'fs-extra': '4.0.0',
  'request': '2.81.0',
  'throttle': '1.0.3',
  'file-type': '5.2.0'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo', 'underscore', 'check', 'random', 'coffeescript', 'ecmascript', 'ostrio:cookies@2.2.2'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.coffee', 'server');
  api.mainModule('client.coffee', 'client');
  api.export('FilesCollection');
});
