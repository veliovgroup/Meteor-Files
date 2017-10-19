Package.describe({
  name: 'ostrio:files',
  version: '1.9.0',
  summary: 'File upload via DDP/HTTP to server FS, AWS, GridFS, DropBox, Google Drive or other 3rd party storage',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Npm.depends({
  'fs-extra': '4.0.2',
  'request': '2.83.0',
  'file-type': '7.1.0',
  'eventemitter3': '2.0.3'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo', 'underscore', 'check', 'random', 'ecmascript', 'ostrio:cookies@2.2.3'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');
});
