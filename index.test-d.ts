import { expectType, expectError, expectAssignable } from 'tsd';
import type { Meteor } from 'meteor/meteor';
import type { ReactiveVar } from 'meteor/reactive-var';
import {
  FilesCollection,
  FileUpload,
  UploadInstance,
  FileCursor,
  FilesCursor,
  FileObj,
  FilesCollectionConfig,
  InsertOptions,
  ContextUser,
  ContextHTTP,
} from 'meteor/ostrio:files';

// config options, including 3.1 additions
const config: FilesCollectionConfig = {
  collectionName: 'Images',
  storagePath: '/data/files',
  continueUploadTTL: 3600,
  chunkSize: 'dynamic',
  allowedCordovaOrigins: /^https:\/\/localhost:12[0-9]{3}$/,
  nosniff: true,
  uploadIdleTimeout: 900000,
  allowedOrigins: false,
  disableUpload: false,
  disableDownload: false,
  disableSetTokenCookie: true,
  allowQueryStringCookies: true,
  getUser(http) {
    expectType<ContextHTTP | undefined>(http);
    return { userId: null, async userAsync() { return null; } };
  },
  interceptRequest(http) {
    expectType<ContextHTTP>(http);
    expectType<string>(http.params._id);
    return false;
  },
  async namingFunction({ file, fileId, userId }) {
    expectType<string>(fileId);
    expectType<string | null>(userId);
    return file.name;
  },
  async protected(fileObj) {
    expectType<FileObj>(fileObj);
    return this.userId !== null;
  },
  async downloadCallback(http, fileObj) {
    expectType<FilesCollection>(this);
    expectType<string | null>(http.userId);
    expectType<FileObj>(fileObj);
    return true;
  },
  async interceptDownload() {
    return false;
  },
  async onBeforeUpload(fileData) {
    expectType<string | null>(this.userId);
    return fileData.size < 1000 ? true : 'too big';
  },
  async onBeforeRemove(cursor) {
    expectType<FilesCursor<unknown, unknown>>(cursor);
    return true;
  },
  async onAfterUpload(fileObj) {
    expectType<FileObj>(fileObj);
  },
  async onAfterRemove() {
    return true;
  },
  onbeforeunloadMessage(fileData) {
    expectType<string>(fileData.name);
    return 'Uploading';
  },
};
expectAssignable<FilesCollectionConfig>({ allowedCordovaOrigins: true });
expectAssignable<FilesCollectionConfig>({ allowedCordovaOrigins: 'https://example.com' });
expectError<FilesCollectionConfig>({ allowedCordovaOrigins: 1 });
expectError<FilesCollectionConfig>({ nosniff: 'yes' });
expectError<FilesCollectionConfig>({ uploadIdleTimeout: '900000' });

const files = new FilesCollection(config);

// insert overloads depend on autoStart
const options: InsertOptions = {
  file: new File([], 'a.txt'),
  chunkSize: 'dynamic',
  onStart(error, fileData) {
    expectType<Meteor.Error | null>(error);
    expectType<string>(fileData.name);
  },
  onProgress(progress) {
    expectType<number>(progress);
  },
  async onBeforeUpload(fileData) {
    expectType<string | null>(this.userId);
    return fileData.size > 0;
  },
};
expectType<UploadInstance>(files.insert(options));
expectType<UploadInstance>(files.insert(options, true));
expectType<FileUpload>(files.insert(options, false));
expectType<Promise<UploadInstance>>(files.insertAsync(options));
expectType<Promise<FileUpload>>(files.insertAsync(options, false));
expectAssignable<InsertOptions>({ file: new Blob([]) });
expectAssignable<InsertOptions>({ file: 'data:text/plain;base64,AAAA', isBase64: true, fileName: 'a.txt' });

// FileUpload members
declare const upload: FileUpload;
expectType<ReactiveVar<number>>(upload.progress);
expectType<ReactiveVar<string>>(upload.remainingTime);
expectType<ReactiveVar<boolean>>(upload.onPause);
expectType<ReactiveVar<number>>(upload.estimateTime);
expectType<ReactiveVar<number>>(upload.estimateSpeed);
expectType<Promise<void>>(upload.abort());
expectType<Promise<void>>(upload.start());
expectType<FileUpload>(upload.pipe((data) => data));
expectType<void>(upload.pause());
expectType<void>(upload.continue());
expectType<void>(upload.toggle());

// UploadInstance members
declare const instance: UploadInstance;
expectType<Promise<FileUpload>>(instance.start());
expectType<FileUpload>(instance.result);

// cursors
declare const cursor: FilesCursor<unknown, unknown>;
expectType<Promise<FileObj[]>>(cursor.fetchAsync());
expectType<Promise<number>>(cursor.countDocuments());
expectType<Promise<number>>(cursor.removeAsync());
expectType<Promise<string[]>>(cursor.mapAsync((file) => file.name));
expectType<string[]>(cursor.map((file) => file.name));
expectType<Promise<FileCursor[]>>(cursor.eachAsync());
expectType<Promise<boolean>>(cursor.hasNextAsync());
expectType<Promise<FileObj | undefined>>(cursor.lastAsync());
expectError(cursor.countAsync());
expectError(cursor.hasNext());

declare const fileCursor: FileCursor;
expectType<string>(fileCursor.link('original'));
expectType<Promise<FileObj[]>>(fileCursor.fetchAsync());
expectType<Promise<FileCursor & FileObj>>(fileCursor.withAsync());
expectType<string>(fileCursor.get('name'));

async function findFile() {
  const file = await files.findOneAsync({});
  if (file) {
    expectType<string>(file._id);
    expectType<string>(file.link());
    expectType<string>(files.link(file));
  }
  expectType<FilesCursor<unknown, unknown>>(files.find({}));
  expectType<Promise<number>>(files.countDocuments({}));
  expectType<Promise<number>>(files.estimatedDocumentCount());
}
void findFile;

// server-only methods
async function serverMethods() {
  expectType<Promise<FileObj>>(files.addFile('/tmp/a.txt', { fileName: 'a.txt' }));
  expectType<Promise<FileObj>>(files.writeAsync(Buffer.from('x'), { name: 'a.txt' }));
  expectType<Promise<FileObj>>(files.loadAsync('https://example.com/a.txt', { timeout: 1000 }));
  expectType<Promise<number>>(files.removeAsync({}));
  const user: ContextUser = files._getUser();
  expectType<Promise<Meteor.User | null>>(user.userAsync());
  files.denyClient();
  files.allowClient();
  files.allow({ insert: () => true });
  files.deny({ remove: () => true });
}
void serverMethods;
