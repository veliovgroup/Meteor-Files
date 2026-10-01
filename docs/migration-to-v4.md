# Migration to v4

ostrio:files 4.0.0 requires Meteor 3.2 or newer, like 3.1.0. This page lists every breaking change and what to change in your app.

## Breaking changes

- `FilesCursor#hasNext()` is removed. Use `await cursor.hasNextAsync()`.
- `FilesCursor#countAsync()` is removed. Use `await cursor.countDocuments()`.
- `findOne()` moved from the isomorphic core to the client class. On the server it still throws `Meteor.Error(404)`; use `findOneAsync()`.
- The default `x_mtok` lookup supports only a `Map` in `Meteor.server.sessions` (Meteor 3).
- `FileUpload#pipe()` functions run in the order they were added (first `pipe()` call runs first). v3 ran the last added pipe first. Reverse your `pipe()` calls if you chain more than one.
