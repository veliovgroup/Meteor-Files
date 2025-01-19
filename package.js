Package.describe({
  name: 'ostrio:files',
  version: '3.0.0',
  summary: 'Upload files to a server or 3rd party storage: AWS:S3, GridFS, DropBox, and other',
  git: 'https://github.com/veliovgroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse((api) => {
  api.versionsFrom(['3.0']);
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'ddp-client'], 'client');
  api.use(['mongo', 'check', 'random', 'ecmascript', 'fetch', 'ostrio:cookies@2.9.0'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
  api.export('FilesCollection');
});

Package.onTest((api) => {
  api.use('tinytest');
  api.use('meteortesting:mocha');
  api.use(['ecmascript', 'ostrio:files'], ['client', 'server']);
  api.addFiles('tests/helpers.js', ['client', 'server']);
  api.mainModule('tests/server.js', 'server');
});

Npm.depends({
  'fs-extra': '11.2.0',
  eventemitter3: '5.0.1',
  'abort-controller': '3.0.0'
});
