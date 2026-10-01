# About upload Transports

## DDP (WebSockets)

DDP (*Distributed Data Protocol*) built by the Meteor team on top of WebSockets via [SockJS](https://github.com/sockjs) library. DDP provides authentication, data standardization (*via EJSON*), and of course fallback to http, with long polling, if WebSockets is not available or not supported by browser.

The pros:

- Persistent connection;
- Common way for Meteor to communicate with the server.

The cons:

- "Magic" overhead inside DDP and EJSON;
- Only one data-transfer per time unit (*blocks other DDP requests, like methods, subs, etc.*);
- It's synchronous.

## HTTP (TCP/IP)

Well known way to exchange data between browser and server. To solve issue with opening connection and first-byte exchange use [HTTP/2](https://en.wikipedia.org/wiki/HTTP/2), [SSL/TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security), SSL session cache and OCSP stapling.

From [Is TLS Fast Yet](https://istlsfastyet.com/):
> Unlike HTTP/1.1, HTTP/2 requires only a single connection per origin, which means fewer sockets, memory buffers, TLS handshakes, and so on.

The pros:

- Asynchronous, unordered and simultaneous requests (*depends on the browser, usually up to 10 simultaneous connections*);
- No data-processing/encoding, we send data as it is;
- Speed.

The cons:

- HTTP (*Hypertext Transfer Protocol*) as you see from full name of the protocol it was initially created to transfer *hypertext*, other words HTML markup. So it was created for text-based data, not binary (*files*).

## Upload rules (both transports)

An upload is one Start request, chunks `1..N` in order, and one EOF request. These rules apply to DDP methods and HTTP routes alike:

- Start: the server validates `chunkSize` (integer, `1` to 16 MiB), `file.size` (integer, `1` or more, empty files can not be uploaded), and the chunk count. Invalid values get `400`. Start returns `409` when the file id or the target path already exists or is claimed by another pending upload. HTTP Start bodies (including `meta`) are limited to 1 MiB
- Write: each chunk needs a `chunkId` in `1..N` and a length of at most `chunkSize` (the last chunk is limited by the declared size). The total can not exceed the declared size. HTTP chunk bodies are limited to the base64 size of `chunkSize` plus 4 KiB, over that the server replies `413`
- EOF: HTTP EOF bodies are limited to 64 KiB. The server stores the real size found on disk, not the one the client declared
- Owner only: Write, EOF, and `_Abort` from a different user than the one who started the upload get `403`. `_Abort` on an unknown or foreign upload id gets `404`
- Lost uploads: `408` means `_preCollection` has no record of the upload (it expired after `continueUploadTTL`, it finished, or the id is unknown). `410` means the record exists but the server can not resume it, because its file was removed or the record was created before 4.0. A replaced file gets `409`
- Repeated EOF: when the response to EOF was lost, an authenticated owner can send EOF again and receives the stored file record. Anonymous uploads get `408`
- Idle uploads: the server closes the file handle after `uploadIdleTimeout` and reopens it with the next chunk
- Chunk limit: an upload has at most 100000 chunks. The client raises `chunkSize` for larger files (up to 16 MiB). The server rejects Start with more chunks with `400`
- Resume: the server records each written chunk in the upload record. After a server restart, an unfinished upload continues within `continueUploadTTL`, and EOF succeeds once every chunk is recorded. When the server can not record a chunk, it replies `503` and the client sends the chunk again

HTTP error responses have a JSON body `{ "error": <status code>, "reason": "<text>", "isClientSafe": true }`. `isClientSafe` is `true` only for `4xx` errors that are safe to show to users. The server replaces the reason of every `5xx` error with a generic text (`503` says to try again) and logs details when `debug` is on. A malformed Start request gets `400`.

## RTC Data Channel (UDP)

This transport is experimental and exists only in the [webrtc-data-channel](https://github.com/veliovgroup/Meteor-Files/tree/webrtc-data-channel) branch. That branch is outdated and was never merged to `master`, so it does not work with Meteor 3 or the current package version. The list below describes the idea, not a supported feature.

The pros:

- Single socket connection;
- Direct tunneled connection from Client to Server;
- Pure binary data support;
- Native implementation and support on mobile devices;
- It's UDP.

The cons:

- No mobile browsers support;
- Chunk size limited to 64KB;
