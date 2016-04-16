Package.describe({
  name: 'ostrio:files',
  version: '1.4.3',
  summary: 'Upload, Store and Stream (Video & Audio streaming) files to/from file system (FS) via DDP and HTTP',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1');
  api.addFiles('files.coffee', ['server', 'client']);
  api.addAssets('worker.js', 'client');
  api.use('webapp', 'server');
  api.use(['templating', 'reactive-var', 'tracker'], 'client');
  api.use(['underscore', 'check', 'sha', 'ostrio:cookies@2.0.2', 'random', 'coffeescript', 'aldeed:collection2@2.9.1'], ['client', 'server']);
});

Npm.depends({
  'fs-extra': '0.26.7',
  'request': '2.70.0',
  'throttle': '1.0.3'
});
