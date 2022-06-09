Package.describe({
  name: 'ostrio:files',
  version: '2.1.0',
  summary: 'Upload files to Meteor application, with 3rd party storage support: AWS:S3, GridFS and other',
  git: 'https://github.com/veliovgroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse((api) => {
  api.versionsFrom('1.9');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'ddp-client'], 'client');
  api.use(['mongo', 'check', 'random', 'ecmascript', 'fetch', 'ostrio:cookies@2.7.2'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');
});

Package.onTest((api) => {
  api.use('tinytest');
  api.use(['ecmascript', 'ostrio:files'], ['client', 'server']);
  api.addFiles('tests/helpers.js', ['client', 'server']);
});

Npm.depends({
  eventemitter3: '4.0.7',
  'abort-controller': '3.0.0'
});
