Package.describe({
  name: 'ostrio:files',
  version: '1.2.4',
  summary: 'Upload, Store and Download small and huge files to/from file system (FS) via DDP and HTTP',
  git: 'https://github.com/VeliovGroup/Meteor-Files',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1');
  api.addFiles('files.coffee');
  api.use(['templating', 'reactive-var', 'tracker'], 'client');
  api.use(['underscore', 'sha', 'ostrio:jsextensions@0.0.4', 'coffeescript', 'iron:router@1.0.5', 'aldeed:collection2@2.3.3'], ['client', 'server']);
});

Npm.depends({
  'fs-extra': '0.18.1'
});