import { EventEmitter } from 'eventemitter3';
import type { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import type { ReactiveVar } from 'meteor/reactive-var';
import type SimpleSchema from 'simpl-schema';
import type * as http from 'node:http';
import type { IncomingMessage } from 'connect';
import type { DDP } from 'meteor/ddp';

declare module 'meteor/ostrio:files' {
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
    userId: string;
    user: () => Meteor.User;
  }

  export interface ContextUpload {
    file: object;
    /** On server only. */
    chunkId?: number;
    /** On server only. */
    eof?: boolean;
  }

  export type MeteorFilesTransportType = 'http' | 'ddp';
  export type MetadataType = Record<string, unknown> | {};
  export type MeteorFilesSelector<S> = Mongo.Selector<S> | Mongo.ObjectID | string;
  export type MeteorFilesOptions<O> = Mongo.Options<O>;
  export type FileHandleCache = Map<string, WriteStream>;

  export interface Version {
    extension: string;
    meta: MetadataType;
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
    extensionWithDot: string;
    _storagePath: string;
    _downloadRoute: string;
    _collectionName: string;
    public?: boolean;
    meta?: MetadataType;
    userId?: string;
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
     * @param permissions - The file permissions (octal string) to use when opening the file (e.g., '611' or '0o777').
     */
    constructor(path: string, maxLength: number, file: FileObj, permissions: string);

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
    debug?: boolean;
    downloadRoute?: string;
    collectionName?: string;
    storagePath: (data: Partial<FileObj>) => string;

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
    findOneAsync<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): Promise<FileCursor | null>;

    /**
     * Find and return a FileCursor for a matching document (client only).
     * @param selector - Mongo-style selector.
     * @param options - Mongo query options.
     * @returns {FileCursor | null} The FileCursor instance or null if not found.
     * @throws {Meteor.Error} If called on the server.
     */
    findOne<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): FileCursor | null;

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
     * @param options - Mongo query options.
     * @returns {Promise<number>} The number of matching records.
     */
    countDocuments<S, O>(selector?: MeteorFilesSelector<S>, options?: MeteorFilesOptions<O>): Promise<number>;

    /**
     * Return a downloadable URL for the given file.
     * @param fileRef - Partial file object reference.
     * @param version - File version (default is 'original').
     * @param uriBase - Optional URI base.
     * @returns {string} The download URL, or an empty string if the file is invalid.
     */
    link(fileRef: Partial<FileObj>, version?: string, uriBase?: string): string;
  }

  export interface FilesCollectionConfig {
    storagePath?: string | ((fileObj: FileObj) => string);
    collection?: Mongo.Collection<FileObj>;
    collectionName?: string;
    continueUploadTTL?: string;
    ddp?: DDP.DDPStatic;
    cacheControl?: string;
    responseHeaders?: { [x: string]: string } | ((responseCode?: string, fileObj?: FileObj, versionRef?: Version, version?: string) => { [x: string]: string });
    throttle?: number | boolean;
    downloadRoute?: string;
    schema?: SimpleSchema | Record<string, unknown>;
    chunkSize?: number | 'dynamic';
    namingFunction?: (fileObj: FileObj) => string;
    permissions?: number;
    parentDirPermissions?: number;
    integrityCheck?: boolean;
    strict?: boolean;
    downloadCallback?: (this: ContextHTTP & ContextUser, fileObj: FileObj) => boolean;
    protected?: boolean | ((this: ContextHTTP & ContextUser, fileObj: FileObj) => boolean | number);
    public?: boolean;
    onBeforeUpload?: (this: ContextUpload & ContextUser, fileData: FileData) => boolean | string;
    onBeforeRemove?: (this: ContextUser, cursor: Mongo.Cursor<FileObj>) => boolean;
    onInitiateUpload?: (this: ContextUpload & ContextUser, fileData: FileData) => void;
    onAfterUpload?: (fileObj: FileObj) => void;
    onAfterRemove?: (files: ReadonlyArray<FileObj>) => void;
    onbeforeunloadMessage?: string | (() => string);
    allowClientCode?: boolean;
    debug?: boolean;
    interceptDownload?: (http: object, fileObj: FileObj, version: string) => boolean;
  }

  export interface InsertOptions {
    file: File | String;
    fileId?: string;
    fileName?: string;
    isBase64?: boolean;
    meta?: MetadataType;
    transport?: MeteorFilesTransportType;
    ddp?: DDP.DDPStatic;
    onStart?: (error: Meteor.Error, fileData: FileData) => void;
    onUploaded?: (error: Meteor.Error, fileObj: FileObj) => void;
    onAbort?: (fileData: FileData) => void;
    onError?: (error: Meteor.Error, fileData: FileData) => void;
    onProgress?: (progress: number, fileData: FileData) => void;
    onBeforeUpload?: (fileData: FileData) => boolean;
    chunkSize?: number | 'dynamic';
    allowWebWorkers?: boolean;
    type?: string;
  }

  export interface FileUploadConfig {
    _debug: (...args: unknown[]) => void;
    file: File;
    fileData: FileData;
    isBase64?: boolean;
    onAbort?: (this: FileUpload, file: FileData & Partial<File>) => void;
    beforeunload?: (e: BeforeUnloadEvent | Event) => string;
    _onEnd?: () => void;
    fileId?: string;
    debug?: boolean;
    ddp?: DDP.DDPStatic;
    chunkSize?: number | 'dynamic';
  }

  /**
   * FileUpload – an internal class returned by the .insert() method.
   */
  export class FileUpload extends EventEmitter {
    config: FileUploadConfig;
    file: FileData & Partial<File>;
    state: ReactiveVar<string>;
    onPause: ReactiveVar<boolean>;
    progress: ReactiveVar<number>;
    continueFunc: () => void;
    estimateTime: ReactiveVar<number>;
    estimateSpeed: ReactiveVar<number>;
    estimateTimer: number;
    constructor(config: FileUploadConfig);
    pause(): void;
    continue(): void;
    toggle(): void;
    abort(): void;
  }


  export interface UploadInstanceConfig {
    ddp?: DDP.DDPStatic;
    file: File;
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
    onProgress?: (
      this: FileUpload,
      progress: number,
      fileData: FileData,
      info?: { chunksSent: number; chunksLength: number; bytesSent: number }
    ) => void;
    onBeforeUpload?: (this: FileUpload, fileData: FileData) => boolean | string | Promise<boolean | string>;
    allowWebWorkers: boolean;
    disableUpload?: boolean;
    _debug?: (...args: unknown[]) => void;
    debug?: boolean;
  }

  /**
   * UploadInstance – internal class used for handling file uploads.
   */
  export class UploadInstance extends EventEmitter {
    config: UploadInstanceConfig;
    collection: FilesCollection;
    worker: Worker | null | false;
    fetchControllers: { [uid: string]: AbortController };
    transferTime: number;
    trackerComp: Tracker.Computation | null;
    sentChunks: number;
    fileLength: number;
    startTime: { [chunkId: number]: number };
    EOFsent: boolean;
    fileId: string;
    FSName: string;
    pipes: Array<(data: string) => string>;
    fileData: FileData;
    result: FileUpload;
    beforeunload: (e: BeforeUnloadEvent | Event) => string;
    _setProgress: (progress: number) => void;
    constructor(config: UploadInstanceConfig, collection: FilesCollection);
    error(error: Meteor.Error, data?: unknown): this;
    end(error?: Meteor.Error, data?: unknown): FileUpload;
    sendChunk(evt: { data: { bin: string; chunkId: number } }): void;
    sendEOF(): void;
    proceedChunk(chunkId: number): void;
    upload(): this;
    prepare(): void;
    pipe(func: (data: string) => string): this;
    start(): Promise<FileUpload> | FileUpload;
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
    remove(): FileCursor;
    removeAsync(): Promise<FileCursor>;
    link(version?: string, uriBase?: string): string;
    get(property?: string): FileObj | unknown;
    fetch(): FileObj[];
    fetchAsync(): Promise<FileObj[]>;
    with(): FileCursor;
  }

  /**
   * FilesCursor – internal class representing a cursor over file documents.
   */
  export class FilesCursor<S, O> {
    constructor(
      _selector: MeteorFilesSelector<S>,
      options: MeteorFilesOptions<O>,
      _collection: FilesCollection
    );
    _collection: FilesCollection;
    _selector: MeteorFilesSelector<S>;
    _current: number;
    cursor: Mongo.Cursor<FileObj>;
    get(): FileObj[];
    getAsync(): Promise<FileObj[]>;
    hasNext(): boolean;
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
    count(): number;
    countAsync(): Promise<number>;
    remove(callback?: Function): FilesCursor<S, O>
    removeAsync(): Promise<number>;
    forEach(callback: Function, context?: object): FilesCursor<S, O>;
    forEachAsync(callback: Function, context?: object): Promise<FilesCursor<S, O>>;
    each(): FileCursor[];
    eachAsync(): Promise<FileCursor[]>;
    map(callback: Function, context?: object): FileObj[];
    mapAsync(callback: Function, context?: object): Promise<FileObj[]>;
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
     * Inserts a file into the collection and returns an instance of FileUpload/UploadInstance.
     * @param config - The insert options.
     * @param autoStart - Whether to start the upload immediately.
     */
    insert(config: InsertOptions, autoStart?: boolean): FileUpload | UploadInstance;

    /**
     * Asynchronously inserts a file into the collection.
     * @param config - The insert options.
     * @param autoStart - Whether to start the upload immediately.
     */
    insertAsync(config: InsertOptions, autoStart?: boolean): Promise<FileUpload | UploadInstance>;

    /**
     * Removes files/documents from the collection.
     * @param selector - A Mongo-style selector.
     * @param callback - Optional callback function.
     */
    remove<S>(selector: MeteorFilesSelector<S>, callback?: Function): FilesCollection;

    /**
     * Asynchronously removes files/documents from the collection.
     * @param selector - A Mongo-style selector.
     */
    removeAsync<S>(selector: MeteorFilesSelector<S>): Promise<number>;

    /**
     * Returns an object with the current user's information.
     */
    _getUser(): ContextUser;
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
    headers?: Object;
    name?: string;
    type?: string;
    meta?: Object;
    userId?: string;
    fileId?: string;
    timeout?: Number;
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
    unlink(fileRef: FileObj, version?: string, callback?: Function): FilesCollection;

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
    removeAsync<S>(selector: MeteorFilesSelector<S>): Promise<number>;
  }
}
