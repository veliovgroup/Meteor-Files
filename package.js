Package.describe({
  name: 'ostrio:files',
  version: '1.9.8',
  summary: 'File upload via DDP/HTTP to server, 3rd party storage support: AWS S3, GridFS, DropBox and others',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Npm.depends({
  'fs-extra': '5.0.0',
  'request': '2.83.0',
  'file-type': '7.6.0',
  'eventemitter3': '3.0.1'
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo', 'underscore', 'check', 'random', 'ecmascript', 'ostrio:cookies@2.2.4'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');
});
