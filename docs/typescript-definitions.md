# TypeScript Definitions

```ts
declare module "meteor/ostrio:files" {

  import { Mongo } from 'meteor/mongo';
  import { ReactiveVar } from 'meteor/reactive-var';

  class FileObj {
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
    extension?: string;
    _storagePath: string;
    _downloadRoute: string;
    _collectionName: string;
    public?: boolean;
    meta?: Object;
    userId?: string;
    updatedAt?: Date;
    versions: Object;
  }

  type FileRef = any; // File record from Mongo DB... don't know the details yet

  interface FileData {
    size: number;
    type: string;
    mime: string;
    "mime-type": string;
    ext: string;
    extension: string;
    name: string;
  }

  interface FilesCollectionConfig {
    storagePath?: string;
    collection?: Mongo.Collection<any>;
    collectionName?: string;
    continueUploadTTL?: string;
    ddp?: Object;
    cacheControl?: string;
    responseHeaders?: { [x: string]: string } | ((responseCode?, fileRef?, versionRef?, version?) => { [x: string]: string });
    throttle?: number | boolean;
    downloadRoute?: string;
    schema?: Object;
    chunkSize?: number;
    namingFunction?: () => string;
    permissions?: number;
    parentDirPermissions?: number;
    integrityCheck?: boolean;
    strict?: boolean;
    downloadCallback?: (fileObj: FileObj) => boolean;
    protected?: boolean | ((fileObj: FileObj) => boolean | number);
    public?: boolean;
    onBeforeUpload?: (fileData: FileData) => boolean | string;
    onBeforeRemove?: (cursor: Mongo.Cursor<any>) => boolean;
    onInitiateUpload?: (fileData: FileData) => void;
    onAfterUpload?: (fileRef: FileRef) => any;
    onAfterRemove?: (files: Object[]) => any;
    onbeforeunloadMessage?: string | (() => string);
    allowClientCode?: boolean;
    debug?: boolean;
    interceptDownload?: (http: any, fileRef: any, version: string) => boolean;
  }

  export interface SearchOptions {
    sort?: Mongo.SortSpecifier;
    skip?: number;
    limit?: number;
    fields?: Mongo.FieldSpecifier;
    reactive?: boolean;
    transform?: Function;
  }

  export interface InsertOptions {
    file: File | Object | string;
    isBase64?: boolean;
    meta?: { [x: string]: any };
    transport?: 'ddp' | 'http'
    onStart?: (error: Object, fileData: Object) => any;
    onUploaded?: (error: Object, fileData: Object) => any;
    onAbort?: (fileData: Object) => any;
    onError?: (error: Object, fileData: Object) => any;
    onProgress?: (progress: number, fileData: Object) => any;
    onBeforeUpload?: (fileData: Object) => any;
    streams?: number | 'dynamic';
    chunkSize?: number | 'dynamic';
    allowWebWorkers?: boolean;
  }

  export interface LoadOptions {
    fileName: string;
    meta?: Object;
    type?: string;
    size?: number;
  }

  export class FileUpload {
    file: File;
    onPause: ReactiveVar<boolean>;
    progress: ReactiveVar<number>;
    estimateTime: ReactiveVar<number>;
    estimateSpeed: ReactiveVar<number>;
    state: ReactiveVar<'active' | 'paused' | 'aborted' | 'completed'>;

    pause();
    continue();
    toggle();
    pipe();
    start();
    on(event: string, callback: Function): void;
  }

  export class FileCursor extends FileObj { // Is it correct to say that it extends FileObj?
    remove(callback: (err) => void): void;
    link(): string;
    get(property: string): Object | any;
    fetch(): Object[];
    with(): ReactiveVar<FileCursor>;
  }

  export class FilesCursor extends Mongo.Cursor<FileObj> {
    cursor: Mongo.Cursor<FileObj>; // Refers to base cursor? Why is this existing?

    get(): Object[];
    hasNext(): boolean;
    next(): Object;
    hasPrevious(): boolean;
    previous(): Object;
    first(): Object;
    last(): Object;
    remove(callback: (err) => void): void;
    each(): FileCursor[];
    current(): Object | undefined;
  }

  export class FilesCollection {
    collection: Mongo.Collection<FileObj>;
    schema: any;

    constructor(config: FilesCollectionConfig)

    find(selector?: Mongo.Selector, options?: SearchOptions): FilesCursor;
    findOne(selector?: Mongo.Selector, options?: SearchOptions): FileCursor;
    insert(settings: InsertOptions, autoStart?: boolean): FileUpload;
    remove(select: Mongo.Selector, callback: (error) => any): FilesCollection;
    link(fileRef: FileRef, version?: string): string;
    allow(options: Mongo.AllowDenyOptions): void;
    deny(options: Mongo.AllowDenyOptions): void;
    denyClient(): void;
    on(event: string, callback: (fileRef: FileRef) => void): void;
    unlink(fileRef: FileRef, version?: string): FilesCollection;
    addFile(path: string, opts: LoadOptions, callback: (err: any, fileRef: FileRef) => any, proceedAfterUpload: boolean);
    load(url: string, opts: LoadOptions, callback: (err: any, fileRef: FileRef) => any, proceedAfterUpload: boolean);
    write(buffer: Buffer, opts: LoadOptions, callback: (err: any, fileRef: FileRef) => any, proceedAfterUpload: boolean);
  }
}
```
