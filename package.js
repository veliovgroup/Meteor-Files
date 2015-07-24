Package.describe({
  name: 'ostrio:files',
  version: '1.3.3',
  summary: 'Upload, Store and Stream (Video & Audio streaming) files to/from file system (FS) via DDP and HTTP',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1');
  api.addFiles('files.coffee');
  api.use(['templating', 'reactive-var', 'tracker'], 'client');
  api.use(['underscore', 'sha', 'ostrio:jsextensions@0.0.4', 'ostrio:cookies@1.0.1', 'coffeescript', 'iron:router@1.0.9', 'aldeed:collection2@2.3.3'], ['client', 'server']);
});

Npm.depends({
  'fs-extra': '0.22.1',
  'request': '2.58.0'
});