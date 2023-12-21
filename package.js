Package.describe({
  name: 'ostrio:files',
  version: '2.3.3',
  summary: 'Upload files to a server or 3rd party storage: AWS:S3, GridFS, DropBox, and other',
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
  api.use('meteortesting:mocha');
  api.use(['ecmascript', 'ostrio:files'], ['client', 'server']);
  api.addFiles('tests/helpers.js', ['client', 'server']);
  api.mainModule('tests/server.js', 'server');
});

Npm.depends({
  'chai': '4.2.0',
  'sinon': '7.5.0',
  '@sinonjs/fake-timers': '10.3.0',
  'supports-color': '6.1.0',
  'diff': '4.0.1',
  'fs-extra': '8.1.0',
  eventemitter3: '4.0.7',
  'abort-controller': '3.0.0'
});
