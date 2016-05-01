Package.describe({
  name: 'ostrio:files',
  version: '1.5.0',
  summary: 'Fast and robust file uploads and streaming (Audio & Video), support FS or AWS, DropBox, Google Drive',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1');
  api.addFiles('files.coffee', ['server', 'client']);
  api.addAssets('worker.js', 'client');
  api.use('webapp', 'server');
  api.use(['templating', 'reactive-var', 'tracker'], 'client');
  api.use(['underscore', 'check', 'sha', 'ostrio:cookies@2.0.2', 'random', 'coffeescript'], ['client', 'server']);
  api.export('FilesCollection');
});

Npm.depends({
  'fs-extra': '0.28.0', // NOTE: this package has dropped support for Node v0.10, since v0.29.0
  'request': '2.72.0',
  'throttle': '1.0.3',
  'file-type': '3.8.0'
});
