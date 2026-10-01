import { EventEmitter } from 'eventemitter3';
import type { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import type { CountDocumentsOptions, EstimatedDocumentCountOptions } from 'mongodb';
import type { ReactiveVar } from 'meteor/reactive-var';
import type SimpleSchema from 'simpl-schema';
import type * as http from 'node:http';
import type { IncomingMessage } from 'connect';
import type { DDP } from 'meteor/ddp';
import type { Tracker } from 'meteor/tracker';

export interface ParamsHTTP {
  _id: string;
  query: {
    [key: string]: string
  };
  name: string;
  version: string;
}

export interface ContextHTTP {
  request: IncomingMessage;
  response: http.ServerResponse;
  params: ParamsHTTP;
}

export interface ContextUser {
  userId: string | null;
  userAsync(): Promise<Meteor.User | null>;
  /** Client only (reactive); not available on server. */
  user?(): Meteor.User | null;
}

export interface ContextUpload {
  file: object;
  /** On server only. */
  chunkId?: number;
  /** On server only. */
  eof?: boolean;
}

export type MeteorFilesTransportType = 'http' | 'ddp';
export type MetadataType = Record<string, unknown>;
export type MeteorFilesSelector<S> = Mongo.Selector<S> | Mongo.ObjectID | string;
export type MeteorFilesOptions<O> = Mongo.Options<O>;
export type FileHandleCache = Map<string, WriteStream>;
export type MaybePromise<T> = T | Promise<T>;

export interface Version {
  extension: string;
  meta?: MetadataType;
  path: string;
  size: number;
  type: string;
}

export interface FileObj {
  _id: string;
  size: number;
  name: string;
  type: string;
  path: string;
  isVideo: boolean;
  isAudio: boolean;
  isImage: boolean;
  isText: boolean;
  isJSON: boolean;
  isPDF: boolean;
  ext?: string;
  extension?: string;
  chunkSize?: number;
  extensionWithDot?: string;
  _storagePath: string;
  _downloadRoute: string;
  _collectionName: string;
  public?: boolean;
  meta?: MetadataType;
  userId?: string | null;
  updatedAt?: Date;
  versions: {
    [propName: string]: Version;
  };
  mime: string;
  'mime-type': string;
}

export interface FileData {
  size: number;
  type: string;
  mime: string;
  'mime-type': string;
  ext: string;
  extension: string;
  name: string;
  meta: MetadataType;
}

/**
 * A writable stream wrapper that ensures chunks are written in the correct order.
 */
export class WriteStream {
  /**
   * Creates a new WriteStream instance.
   * @param path - The file system path where the file will be written.
   * @param maxLength - The maximum number of chunks expected.
   * @param file - An object containing file properties such as `size` and `chunkSize`.
   * @param permissions - The file permissions (number, e.g. `0o644`) to use when creating the file.
   * @param parentDirPermissions - Permissions (number, e.g. `0o755`) of created parent directories.
   * @param options - `exclusive` creates a new file and fails with 409 when it exists. `identity` is the expected `{dev, ino, birth}` of an existing file (`birth` is the birth time in nanoseconds, optional). `idleTimeout` closes the handle after this many ms without writes. `fileId` is part of the handle cache key. `onAbort` runs after `abort()`.
   */
  constructor(
    path: string,
    maxLength: number,
    file: { chunkSize: number } & Record<string, unknown>,
    permissions: number,
    parentDirPermissions?: number,
    options?: {
      exclusive?: boolean;
      identity?: { dev: string; ino: string; birth?: string };
      idleTimeout?: number;
      fileId?: string;
      onAbort?: (stream: WriteStream) => unknown;
    }
  );

  /**
   * Initializes the WriteStream by ensuring the directory exists, creating the file,
   * preallocating the file size, and caching the file handle.
   * @returns A promise that resolves with this WriteStream instance.
   */
  init(): Promise<this>;

  /**
   * Writes a chunk to the file at the specified chunk position.
   * @param num - The 1-indexed position of the chunk.
   * @param chunk - The buffer containing the chunk data.
   * @returns A promise that resolves to true if the chunk was successfully written, or false if not.
   */
  write(num: number, chunk: Buffer): Promise<boolean>;

  /**
   * Waits for all chunks to be written, polling for completion up to a timeout.
   * @returns A promise that resolves to true if the file was fully written, or false if writing was aborted.
   */
  waitForCompletion(): Promise<boolean>;

  /**
   * Finishes writing to the stream after ensuring that all chunks are written.
   * @returns A promise that resolves to true if the stream is fully written, or false if it is still in progress.
   */
  end(): Promise<boolean>;

  /**
   * Aborts the writing process and removes the created file.
   * @returns A promise that resolves to true once the abort process is complete.
   */
  abort(): Promise<boolean>;

  /**
   * Stops the writing process.
   * @param isAborted - Indicates whether the stop is due to an abort.
   * @returns A promise that resolves to true once the stream is stopped.
   */
  stop(isAborted?: boolean): Promise<boolean>;
}

/**
 * Core class for FilesCollection. Most other classes extend and build on this one.
 */
export class FilesCollectionCore extends EventEmitter {
  // Instance properties that are used in the class:
  collection: Mongo.Collection<FileObj>;
  debug?: boolean | ((...args: unknown[]) => void);
  downloadRoute?: string;
  collectionName?: string;
  storagePath: (data: Partial<FileObj>) => MaybePromise<string>;

  constructor();

  /** Helper functions available as a static property */
  static __helpers: unknown;

  /** Default schema definition */
  static schema: {
    _id: { type: string };
    size: { type: number };
    name: { type: string };
    type: { type: string };
    path: { type: string };
    isVideo: { type: boolean };
    isAudio: { type: boolean };
    isImage: { type: boolean };
    isText: { type: boolean };
    isJSON: { type: boolean };
    isPDF: { type: boolean };
    extension: { type: string; optional: true };
    ext: { type: string; optional: true };
    extensionWithDot: { type: string; optional: true };
    mime: { type: string; optional: true };
    'mime-type': { type: string; optional: true };
    _storagePath: { type: string };
    _downloadRoute: { type: string };
    _collectionName: { type: string };
    public: { type: boolean; optional: true };
    meta: { type: Object; blackbox: true; optional: true };
    userId: { type: string; optional: true };
    updatedAt: { type: Date; optional: true };
    versions: { type: Object; blackbox: true };
  };

  /**
   * Print logs in debug mode.
   * @param args - Arguments to log.
   * @returns {void}
   */
  _debug(...args: unknown[]): void;

  /**
   * Get file name from file data.
   * @param fileData - File data object.
   * @returns {string} The sanitized file name.
   */
  _getFileName(fileData: FileData): string;

  /**
   * Get extension information from a file name.
   * @param fileName - The file name.
   * @returns {Partial<FileData>} An object with ext, extension and extensionWithDot.
   */
  _getExt(fileName: string): Partial<FileData>;

  /**
   * Update file type booleans based on the file's MIME type.
   * @param data - File data object.
   * @returns {void}
   */
  _updateFileTypes(data: FileData): void;

  /**
   * Convert raw file data to an object that conforms to the default schema.
   * @param data - File data combined with partial FileObj properties.
   * @returns {Partial<FileObj>} The schema-compliant file object.
   */
  _dataToSchema(data: FileData & Partial<FileObj>): Partial<FileObj>;

  /**
   * Find and return a FileCursor for a matching document asynchronously.
   * @param selector - Mongo-style selector.
   * @param options - Mongo query options.
   * @returns {Promise<FileCursor | null>} The FileCursor instance or null if not found.
   */
  findOneAsync<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): Promise<(FileCursor & FileObj) | null>;

  /**
   * Find and return a FilesCursor for matching documents.
   * @param selector - Mongo-style selector.
   * @param options - Mongo query options.
   * @returns {FilesCursor} The FilesCursor instance.
   */
  find<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): FilesCursor<S, O>;

  /**
   * Update documents in the underlying collection.
   * @param args - Arguments to pass to Mongo.Collection.update.
   * @returns {Mongo.Collection<FileObj>} The collection instance.
   */
  update(...args: unknown[]): Mongo.Collection<FileObj>;

  /**
   * Asynchronously update documents in the underlying collection.
   * @param args - Arguments to pass to Mongo.Collection.updateAsync.
   * @returns {Promise<number>} The number of updated records.
   */
  updateAsync(...args: unknown[]): Promise<number>;

  /**
   * Count records matching a selector.
   * @param selector - Mongo-style selector.
   * @param options - Mongo's CountDocumentsOptions.
   * @returns {Promise<number>} The number of matching records.
   */
  countDocuments<S>(selector?: MeteorFilesSelector<S>, options?: CountDocumentsOptions): Promise<number>;

  /**
   * Count all documents in the collection.
   * @param options - Mongo's EstimatedDocumentCountOptions.
   * @returns {Promise<number>} The number of matching records.
   */
  estimatedDocumentCount(options?: EstimatedDocumentCountOptions): Promise<number>;

  /**
   * Return a downloadable URL for the given file.
   * @param fileRef - Partial file object reference.
   * @param version - File version (default is 'original').
   * @param uriBase - Optional URI base.
   * @returns {string} The download URL, or an empty string if the file is invalid.
   */
  link(fileRef: Partial<FileObj> | FileCursor | null | undefined, version?: string, uriBase?: string): string;
}

export interface FilesCollectionConfig {
  storagePath?: string | ((fileObj?: Partial<FileObj>) => MaybePromise<string>);
  collection?: Mongo.Collection<FileObj>;
  collectionName?: string;
  /** Seconds an unfinished upload stays resumable. Default: 10800 (3 hours). */
  continueUploadTTL?: number;
  /** [Client] custom DDP connection. */
  ddp?: DDP.DDPStatic;
  cacheControl?: string;
  responseHeaders?: { [x: string]: string } | ((responseCode?: string, fileObj?: FileObj, versionRef?: Version, version?: string) => { [x: string]: string });
  /** @deprecated No effect. */
  throttle?: number | boolean;
  downloadRoute?: string;
  schema?: SimpleSchema | Record<string, unknown>;
  chunkSize?: number | 'dynamic';
  namingFunction?: (fileData: FileData) => MaybePromise<string>;
  permissions?: number;
  parentDirPermissions?: number;
  integrityCheck?: boolean;
  strict?: boolean;
  /** [Server] Called before file download. Return `false` to deny. */
  downloadCallback?: (this: FilesCollection, http: ContextHTTP & ContextUser, fileObj: FileObj) => MaybePromise<boolean>;
  protected?: boolean | ((this: ContextHTTP & ContextUser, fileObj: FileObj) => MaybePromise<boolean | number>);
  public?: boolean;
  onBeforeUpload?: (this: ContextUpload & ContextUser, fileData: FileData) => MaybePromise<boolean | string>;
  onBeforeRemove?: (this: ContextUser, cursor: FilesCursor<unknown, unknown>) => MaybePromise<boolean>;
  onInitiateUpload?: (this: ContextUpload & ContextUser, fileData: FileData) => MaybePromise<void>;
  onAfterUpload?: (fileObj: FileObj) => MaybePromise<void>;
  onAfterRemove?: (files: ReadonlyArray<FileObj>) => MaybePromise<boolean | void>;
  /** [Client] Message shown when closing the tab during upload. */
  onbeforeunloadMessage?: string | ((this: FileUpload, fileData: FileData) => string);
  /** Allow clients to call `remove()` and `removeAsync()` with an `_id`. Set `onBeforeRemove` too. Default: `false`. */
  allowClientCode?: boolean;
  debug?: boolean | ((...args: unknown[]) => void);
  /** [Server] Serve the file from a custom source. Return `true` when the request is handled. */
  interceptDownload?: (http: ContextHTTP, fileObj: FileObj, version: string) => MaybePromise<boolean>;
  /** [Server] Intercept every incoming request to the collection routes. */
  interceptRequest?: (http: ContextHTTP) => MaybePromise<boolean | void>;
  /** [Server] Replace the default cookie based user lookup. */
  getUser?: (http?: ContextHTTP) => ContextUser | { userId: string | null; userAsync(): Promise<Meteor.User | null> };
  /** [Server] CORS origins allowed, `false` disables. Default matches Cordova localhost. */
  allowedOrigins?: boolean | RegExp;
  /** Origins allowed to set cookies cross-site (Cordova, Meteor-Desktop); passed to `ostrio:cookies`. Server default: value of `allowedOrigins`. */
  allowedCordovaOrigins?: boolean | RegExp | string;
  allowQueryStringCookies?: boolean;
  disableUpload?: boolean;
  disableDownload?: boolean;
  /** [Client] Do not set the `x_mtok` cookie. */
  disableSetTokenCookie?: boolean;
  sanitize?: (str: string, max?: number, replacement?: string) => string;
  /** [Server] Send `X-Content-Type-Options: nosniff`. Default: `false`. */
  nosniff?: boolean;
  /** [Server] Milliseconds before an idle upload file handle is closed. Default: 900000. */
  uploadIdleTimeout?: number;
  _preCollection?: Mongo.Collection<{ _id?: string }>;
  _preCollectionName?: string;
}

export interface InsertOptions {
  file: File | Blob | string;
  fileId?: string;
  fileName?: string;
  isBase64?: boolean;
  meta?: MetadataType;
  transport?: MeteorFilesTransportType;
  ddp?: DDP.DDPStatic;
  onStart?: (this: FileUpload, error: Meteor.Error | null, fileData: FileData) => void;
  onUploaded?: (this: FileUpload, error: Meteor.Error | null, fileObj: FileObj) => void;
  onAbort?: (this: FileUpload, fileData: FileData) => void;
  onError?: (this: FileUpload, error: Meteor.Error, fileData: FileData) => void;
  onProgress?: (this: FileUpload, progress: number, fileData: FileData) => void;
  onBeforeUpload?: (this: FileUpload & ContextUser, fileData: FileData) => MaybePromise<boolean | string>;
  chunkSize?: number | 'dynamic';
  allowWebWorkers?: boolean;
  type?: string;
}

export interface FileUploadConfig {
  /** @internal */
  _debug: (...args: unknown[]) => void;
  file: File | Blob | string;
  fileData: FileData;
  isBase64?: boolean;
  onAbort?: (this: FileUpload, file: FileData & Partial<File>) => void;
  beforeunload?: (e: BeforeUnloadEvent | Event) => string;
  /** @internal */
  _onEnd?: () => void;
  /** @internal Removes the upload on the server, never rejects. */
  _abortOnServer?: () => Promise<void>;
  /** @internal */
  _Abort?: string;
  fileId?: string;
  fileLength?: number;
  debug?: boolean | ((...args: unknown[]) => void);
  ddp?: DDP.DDPStatic;
  chunkSize?: number | 'dynamic';
}

/**
 * FileUpload: object returned by `.insert()` with `autoStart: false`; wrapped by UploadInstance otherwise.
 */
export class FileUpload extends EventEmitter {
  config: FileUploadConfig;
  file: FileData & Partial<File>;
  state: ReactiveVar<'active' | 'paused' | 'aborted' | 'completed'>;
  onPause: ReactiveVar<boolean>;
  progress: ReactiveVar<number>;
  continueFunc: () => void;
  /** @internal `true` when paused because the connection was lost; such pause is resumed on reconnect. */
  isAutoPaused: boolean;
  estimateTime: ReactiveVar<number>;
  estimateSpeed: ReactiveVar<number>;
  remainingTime: ReactiveVar<string>;
  /** Created when the upload starts. */
  estimateTimer: number | null;
  constructor(config: FileUploadConfig);
  /** @internal */
  _startEstimateTimer(): void;
  /** @internal */
  _stopEstimateTimer(): void;
  /** @internal */
  _isFinished(): boolean;
  /** @internal */
  _pause(isAuto: boolean): void;
  pause(): void;
  /** Resumes only when the DDP connection is connected. */
  continue(): void;
  toggle(): void;
  /** Does nothing after the upload is aborted, failed, or completed. Never rejects. */
  abort(): Promise<void>;
  /** Only on manual (`autoStart: false`) uploads. */
  start(): Promise<void>;
  /** Only on manual (`autoStart: false`) uploads. */
  pipe(func: (data: string) => string): FileUpload;
}

export interface UploadInstanceConfig {
  ddp?: DDP.DDPStatic;
  file: File | Blob | string;
  fileId?: string;
  meta?: MetadataType;
  type?: string;
  onError?: (this: FileUpload, error: Meteor.Error, fileData: FileData) => void;
  onAbort?: (this: FileUpload, file: FileData) => void;
  onStart?: (this: FileUpload, error: Meteor.Error | null, fileData: FileData) => void;
  fileName?: string;
  isBase64?: boolean;
  transport: MeteorFilesTransportType;
  chunkSize: number | 'dynamic';
  onUploaded?: (this: FileUpload, error: Meteor.Error | null, data: FileObj) => void;
  onProgress?: (this: FileUpload, progress: number, fileData: FileData) => void;
  onBeforeUpload?: (this: FileUpload & ContextUser, fileData: FileData) => MaybePromise<boolean | string>;
  allowWebWorkers: boolean;
  disableUpload?: boolean;
  _debug?: (...args: unknown[]) => void;
  debug?: boolean | ((...args: unknown[]) => void);
}

/**
 * @internal
 * Result of one upload request.
 * `cancelled`: paused or ended; `network`: no response; `retry`: server asked to try again (502, 503, 504); `fatal`: other errors.
 */
export type UploadRequestOutcome =
  | { ok: true; result?: { status: number } & Record<string, unknown> }
  | { ok: false; kind: 'cancelled' | 'network' | 'retry' | 'fatal'; error?: Meteor.Error };

/**
 * UploadInstance – internal class used for handling file uploads.
 */
export class UploadInstance extends EventEmitter {
  config: UploadInstanceConfig;
  collection: FilesCollection;
  /** Created in `start()`. */
  worker: Worker | null | false;
  fetchControllers: { [uid: string]: AbortController };
  transferTime: number;
  fetchTimeouts: { [uid: string]: ReturnType<typeof setTimeout> };
  trackerCompConnection: Tracker.Computation | null;
  trackerCompPause: Tracker.Computation | null;
  /** Number of chunks acknowledged by the server. */
  sentChunks: number;
  fileLength: number;
  startTime: { [chunkId: number]: number };
  /** `true` after the server accepted EOF. */
  EOFsent: boolean;
  /** @internal `true` after the server accepted Start. */
  isStarted: boolean;
  /** @internal */
  isStartCalled?: boolean;
  /** @internal */
  startSent: boolean;
  /** @internal `true` when a Start request failed without a response, so the server may have the upload. */
  startMaybeReceived: boolean;
  /** @internal */
  startOpts?: { file: FileData; fileId: string; chunkSize: number; fileLength: number; FSName?: string };
  /** @internal The one request in flight. */
  inFlight: { kind: 'start' | 'eof' } | { kind: 'chunk'; chunkId: number } | null;
  /** @internal */
  retryAttempt: number;
  /** @internal */
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** @internal */
  isReadEnd: boolean;
  /** @internal */
  hasTimers: boolean;
  fileId: string;
  FSName: string;
  pipes: Array<(data: string) => string>;
  fileData: FileData;
  result: FileUpload;
  beforeunload: (e: BeforeUnloadEvent | Event) => string;
  /** @internal */
  _setProgress: (progress: number) => void;
  constructor(config: UploadInstanceConfig, collection: FilesCollection);
  /** @internal */
  _isConnected(): boolean;
  /** @internal */
  _getSessionToken(): string | null;
  /** @internal */
  _cancelPending(reason: Meteor.Error): void;
  /** @internal Never rejects. */
  _abortOnServer(): Promise<void>;
  /** @internal */
  _error(error: Meteor.Error, data?: unknown): this;
  /** @internal */
  _end(error?: Meteor.Error, data?: unknown): FileUpload;
  /** @internal */
  _pump(): void;
  /** @internal */
  _afterRequest(outcome: UploadRequestOutcome): void;
  /** @internal */
  _sendChunk(evt: { data: { bin: string; chunkId: number } }): Promise<void>;
  /** @internal */
  _sendStart(): Promise<void>;
  /** @internal */
  _sendEOF(): Promise<void>;
  /** @internal */
  _failure(error: unknown, isNetwork: boolean): UploadRequestOutcome;
  /** @internal Never rejects. */
  _sendRequest(conf: { methodName: string; payload: Record<string, unknown>; timeout?: number; headers: Record<string, string> }): Promise<UploadRequestOutcome>;
  /** @internal */
  _proceedChunk(chunkId: number): Promise<void>;
  /** @internal */
  _upload(): Promise<this>;
  /** @internal */
  _prepare(): Promise<void>;
  /** @internal */
  _setup(): void;
  /** Pipes run in the order they were added. */
  pipe(func: (data: string) => string): this;
  start(): Promise<FileUpload>;
  manual(): FileUpload;
}

/**
 * FileCursor – internal class representing a single file document.
 * Instances are returned from methods such as `.findOne()` or via iteration over a FilesCursor.
 */
export class FileCursor {
  constructor(_fileRef: FileObj, _collection: FilesCollection);
  _fileRef: FileObj;
  _collection: FilesCollection;
  /** Client only, throws on server. */
  remove(callback?: (error: Meteor.Error | null, count?: number) => void): FileCursor;
  removeAsync(): Promise<FileCursor>;
  link(version?: string, uriBase?: string): string;
  get(): FileObj;
  get<K extends keyof FileObj>(property: K): FileObj[K];
  get(property: string): unknown;
  fetch(): FileObj[];
  fetchAsync(): Promise<FileObj[]>;
  /** Client only, throws on server. */
  with(): FileCursor & FileObj;
  withAsync(): Promise<FileCursor & FileObj>;
}

/**
 * FilesCursor – internal class representing a cursor over file documents.
 */
export class FilesCursor<S = unknown, O = unknown> {
  constructor(
    _selector: MeteorFilesSelector<S>,
    options: MeteorFilesOptions<O>,
    _collection: FilesCollection
  );
  _collection: FilesCollection;
  _selector: MeteorFilesSelector<S>;
  _current: number;
  cursor: Mongo.Cursor<FileObj>;
  /** Synchronous methods (`get`, `fetch`, `next`, `each`, `map`, and others) work on client only and throw `Meteor.Error` on server; use `*Async` on server. */
  get(): FileObj[];
  getAsync(): Promise<FileObj[]>;
  hasNextAsync(): Promise<boolean>;
  next(): FileObj | undefined;
  nextAsync(): Promise<FileObj | undefined>;
  hasPrevious(): boolean;
  hasPreviousAsync(): Promise<boolean>;
  previous(): FileObj | undefined;
  previousAsync(): Promise<FileObj | undefined>;
  fetch(): FileObj[];
  fetchAsync(): Promise<FileObj[]>;
  first(): FileObj | undefined;
  firstAsync(): Promise<FileObj | undefined>;
  last(): FileObj | undefined;
  lastAsync(): Promise<FileObj | undefined>;
  /** @deprecated Use `countDocuments()`. */
  count(): number;
  countDocuments(options?: CountDocumentsOptions): Promise<number>;
  /** Client only. */
  remove(callback?: (error: Meteor.Error | null, count?: number) => void): FilesCursor<S, O>;
  removeAsync(): Promise<number>;
  forEach(callback: (file: FileObj, index: number, cursor: Mongo.Cursor<FileObj>) => void, context?: object): FilesCursor<S, O>;
  forEachAsync(callback: (file: FileObj, index: number, cursor: Mongo.Cursor<FileObj>) => void | Promise<void>, context?: object): Promise<FilesCursor<S, O>>;
  each(): FileCursor[];
  eachAsync(): Promise<FileCursor[]>;
  map<T>(callback: (file: FileObj, index: number, cursor: Mongo.Cursor<FileObj>) => T, context?: object): T[];
  mapAsync<T>(callback: (file: FileObj, index: number, cursor: Mongo.Cursor<FileObj>) => T | Promise<T>, context?: object): Promise<T[]>;
  current(): FileObj | undefined;
  currentAsync(): Promise<FileObj | undefined>;
  observe(callbacks: Mongo.ObserveCallbacks<FileObj>): Meteor.LiveQueryHandle;
  observeAsync(callbacks: Mongo.ObserveCallbacks<FileObj>): Promise<Meteor.LiveQueryHandle>;
  observeChanges(callbacks: Mongo.ObserveChangesCallbacks<FileObj>): Meteor.LiveQueryHandle;
  observeChangesAsync(callbacks: Mongo.ObserveChangesCallbacks<FileObj>): Promise<Meteor.LiveQueryHandle>;
}

export class FilesCollection extends FilesCollectionCore {
  constructor(config: FilesCollectionConfig);
}

// --------------------------------------------------------------------------
// Client/Browser-specific overloads for FilesCollection
// --------------------------------------------------------------------------
export interface FilesCollection {
  /**
   * Finds a document and wraps it in a FileCursor. Client only, throws `Meteor.Error(404)` on the server.
   */
  findOne<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): (FileCursor & FileObj) | null;

  /**
   * Inserts a file into the collection and returns an instance of FileUpload/UploadInstance.
   * @param config - The insert options.
   * @param autoStart - Whether to start the upload immediately.
   */
  insert(config: InsertOptions, autoStart?: true): UploadInstance;
  insert(config: InsertOptions, autoStart: false): FileUpload;
  insert(config: InsertOptions, autoStart?: boolean): FileUpload | UploadInstance;

  /**
   * Asynchronously inserts a file into the collection.
   * @param config - The insert options.
   * @param autoStart - Whether to start the upload immediately.
   */
  insertAsync(config: InsertOptions, autoStart?: true): Promise<UploadInstance>;
  insertAsync(config: InsertOptions, autoStart: false): Promise<FileUpload>;
  insertAsync(config: InsertOptions, autoStart?: boolean): Promise<FileUpload | UploadInstance>;

  /**
   * Removes one file from the collection. Client only, throws on server.
   * @param _id - `_id` of the file to remove.
   * @param callback - Optional callback function.
   */
  remove(_id: string, callback?: (error: Meteor.Error | null, count?: number) => void): FilesCollection;

  /**
   * Asynchronously removes files/documents from the collection.
   * On the client accepts only a String `_id` and rejects with `Meteor.Error(401)` when `allowClientCode` is `false`.
   * On the server accepts any selector.
   * @param selector - A Mongo-style selector. On the client, a String `_id`.
   */
  removeAsync<S>(selector?: MeteorFilesSelector<S>): Promise<number>;

  /**
   * Returns an object with the current user's information.
   * On server accepts the HTTP context and uses `config.getUser` when set.
   */
  _getUser(http?: Pick<ContextHTTP, 'request' | 'response'>): ContextUser;
}

export interface AddFileOpts {
  type?: string;
  meta?: MetadataType;
  fileId?: string;
  fileName?: string;
  userId?: string;
}

export interface WriteOpts {
  name?: string;
  type?: string;
  meta?: MetadataType;
  userId?: string;
  fileId?: string;
}

export interface LoadOpts {
  headers?: Record<string, string>;
  name?: string;
  type?: string;
  meta?: MetadataType;
  userId?: string;
  fileId?: string;
  timeout?: number;
}

// --------------------------------------------------------------------------
// Server-specific overloads for FilesCollection
// --------------------------------------------------------------------------
export interface FilesCollection {

  /**
   * Downloads a file by preparing HTTP response and piping file data.
   * @param http - HTTP context.
   * @param version - Requested version (default is 'original').
   * @param fileRef - The file object.
   */
  download(http: ContextHTTP, version?: string, fileRef?: FileObj): Promise<void>;

  /**
   * Serves a file over HTTP.
   * @param http - HTTP context.
   * @param fileRef - The file object.
   * @param vRef - The file version reference.
   * @param version - Requested version.
   * @param readableStream - Optional readable stream.
   * @param _responseType - Optional response code.
   * @param force200 - Whether to force a 200 response code.
   */
  serve(
    http: ContextHTTP,
    fileRef: FileObj,
    vRef: Partial<FileData & MetadataType>,
    version?: string,
    readableStream?: NodeJS.ReadableStream | null,
    _responseType?: string,
    force200?: boolean
  ): void;

  /**
   * Adds an existing file on disk to the FilesCollection.
   * @param path - The path to the file.
   * @param opts - Optional file data options.
   * @param proceedAfterUpload - Whether to trigger onAfterUpload hook.
   */
  addFile(path: string, opts?: AddFileOpts, proceedAfterUpload?: boolean): Promise<FileObj>;

  /**
   * Writes a file buffer to disk and inserts the file document into the collection.
   * @param buffer - The file's buffer.
   * @param opts - Optional file data options.
   * @param proceedAfterUpload - Whether to trigger onAfterUpload hook.
   */
  writeAsync(buffer: Buffer, opts?: WriteOpts, proceedAfterUpload?: boolean): Promise<FileObj>;

  /**
   * Loads a file from a URL and inserts it into the collection.
   * @param url - The URL to load.
   * @param opts - Optional file data options.
   * @param proceedAfterUpload - Whether to trigger onAfterUpload hook.
   */
  loadAsync(url: string, opts?: LoadOpts, proceedAfterUpload?: boolean): Promise<FileObj>;

  /**
   * Unlinks (removes) a file from the filesystem.
   * @param fileRef - The file object.
   * @param version - Optional file version.
   * @param callback - Optional callback.
   */
  unlink(fileRef: FileObj, version?: string, callback?: (error?: Error | null) => void): FilesCollection;

  /**
   * Asynchronously unlinks (removes) a file from the filesystem.
   * @param fileRef - The file object.
   * @param version - Optional file version.
   */
  unlinkAsync(fileRef: FileObj, version?: string): Promise<FilesCollection>;

  /**
   * Asynchronously removes files/documents from the collection.
   * (Server override.)
   */
  removeAsync<S>(selector?: MeteorFilesSelector<S>): Promise<number>;

  /** Link Mongo.Collection `deny` rules. */
  deny(rules: Mongo.AllowDenyOptions): Mongo.Collection<FileObj>;
  /** Link Mongo.Collection `allow` rules. */
  allow(rules: Mongo.AllowDenyOptions): Mongo.Collection<FileObj>;
  /** Deny all client-side `insert`, `update`, `remove`. */
  denyClient(): Mongo.Collection<FileObj>;
  /** Allow all client-side `insert`, `update`, `remove`. */
  allowClient(): Mongo.Collection<FileObj>;
}
