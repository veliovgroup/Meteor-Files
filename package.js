Package.describe({
  name: 'ostrio:files',
  version: '1.7.16',
  summary: 'File upload via DDP/HTTP to server FS, AWS, GridFS, DropBox, Google Drive or other 3rd party storage',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4');
  api.use('webapp', 'server');
  api.use(['reactive-var', 'tracker', 'http'], 'client');
  api.use(['mongo', 'underscore', 'check', 'random', 'coffeescript', 'ecmascript', 'ostrio:cookies@2.2.1'], ['client', 'server']);
  api.addAssets('worker.min.js', 'client');
  api.mainModule('files.coffee', ['server', 'client']);
  api.export('FilesCollection');
});

Npm.depends({
  'fs-extra': '3.0.1',
  'request': '2.81.0',
  'throttle': '1.0.3',
  'file-type': '4.3.0'
});
