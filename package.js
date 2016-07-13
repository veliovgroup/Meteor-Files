Package.describe({
  name: 'ostrio:files',
  version: '1.6.4',
  summary: 'Fast and robust file upload package, with support of FS, AWS, GridFS, DropBox or Google Drive',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.3.1');
  api.use('webapp', 'server');
  api.use(['templating', 'reactive-var', 'tracker', 'http'], 'client');
  api.use(['underscore', 'check', 'random', 'coffeescript', 'ecmascript', 'ostrio:cookies@2.0.4'], ['client', 'server']);
  api.addFiles('event-emitter.jsx', 'client');
  api.addAssets('worker.js', 'client');
  api.addFiles('files.coffee', ['server', 'client']);
  api.export('FilesCollection');
});

Npm.depends({
  'fs-extra': '0.30.0', // NOTE: this package has dropped support for Node v0.10, since v0.29.0; Brought back Node v0.10 support in v0.30.0, official support will end 2016-10-01
  'request': '2.73.0',
  'throttle': '1.0.3',
  'file-type': '3.8.0'
});
