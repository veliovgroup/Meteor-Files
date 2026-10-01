# TypeScript definitions

Type definitions live in [`index.d.ts`](https://github.com/veliovgroup/Meteor-Files/blob/master/index.d.ts) and declare the module `meteor/ostrio:files`.

## How types are published

The package publishes `index.d.ts` through [`zodern:types`](https://github.com/zodern/meteor-types). Add both packages to your app, and the TypeScript language server resolves the types:

```shell
meteor add zodern:types typescript
```

Create or update `tsconfig.json` as described in the [`zodern:types` README](https://github.com/zodern/meteor-types#readme). No `@types` package is needed.

## Import example

```ts
import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import type { FileObj, FilesCollectionConfig, InsertOptions } from 'meteor/ostrio:files';

const config: FilesCollectionConfig = {
  collectionName: 'images',
  allowClientCode: false,
  onBeforeUpload(file) {
    return file.size <= 10485760 ? true : 'Max size is 10MB';
  },
};

export const images = new FilesCollection(config);

export async function upload(file: File): Promise<void> {
  const options: InsertOptions = { file, chunkSize: 'dynamic' };
  const upload = await images.insertAsync(options);
  upload.on('end', (error: Meteor.Error | null, fileObj: FileObj) => {});
}
```

## Main exported types

- `FilesCollection`, `FilesCollectionCore` - collection classes
- `FilesCollectionConfig` - constructor options
- `FileObj`, `Version`, `FileData` - file record and its versions
- `InsertOptions`, `FileUploadConfig`, `UploadInstanceConfig` - upload options
- `FileUpload`, `UploadInstance` - client upload handles
- `FileCursor`, `FilesCursor` - cursors returned by `findOneAsync()` and `find()`
- `AddFileOpts`, `WriteOpts`, `LoadOpts` - server `addFile()`, `writeAsync()`, `loadAsync()` options
- `ContextHTTP`, `ParamsHTTP`, `ContextUser`, `ContextUpload` - `this` and arguments of hooks
- `WriteStream` - server chunk writer
- `MeteorFilesSelector`, `MeteorFilesOptions`, `MetadataType`, `MeteorFilesTransportType` - helper types

Keep the version of `ostrio:files` in sync with your editor's cache. Restart the TypeScript server after upgrading the package.
