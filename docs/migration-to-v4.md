# Migration to v4

ostrio:files 4.0.0 requires Meteor 3.2 or newer, like 3.1.0. This page lists every breaking change and what to change in your app.

## Breaking changes

- `FilesCursor#hasNext()` is removed. Use `await cursor.hasNextAsync()`.
- `FilesCursor#countAsync()` is removed. Use `await cursor.countDocuments()`.
