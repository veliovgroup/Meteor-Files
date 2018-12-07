Package.describe({
  name: 'ostrio:files',
  version: '1.10.2',
  summary: 'File upload via DDP/HTTP to server, 3rd party storage support: AWS S3, GridFS, DropBox and others',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Npm.depends({
  'fs-extra': '7.0.0',
  'request': '2.88.0',
  'file-type': '9.0.0',
  'eventemitter3': '3.1.0'
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'http', 'ddp-client'], 'client');
  api.use(['mongo', 'check', 'random', 'ecmascript', 'ostrio:cookies@2.3.0'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use(['ecmascript', 'ostrio:files'], ['client', 'server']);
  api.addFiles('tests/helpers.js', ['client', 'server']);
});
