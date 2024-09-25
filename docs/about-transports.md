# About upload Transports

## DDP (WebSockets)

DDP (*Distributed Data Protocol*) build by MDG (*Meteor Dev Group*) on top of WebSockets via [SockJS](https://github.com/sockjs) library. DDP provides authentication, data standardization (*via EJSON*), and of course fallback to http, with long polling, if WebSockets is not available or not supported by browser.

The pros:

- Persistent connection;
- Common way for Meteor to communicate with the server.

The cons:

- “magic” overhead inside DDP and EJSON;
- Only one data-transfer per time unit (*blocks other DDP requests, like methods, subs, etc.*);
- It's synchronous.

## HTTP (TCP/IP)

Well known way to exchange data between browser and server. To solve issue with opening connection and first-byte exchange use [HTTP/2](https://en.wikipedia.org/wiki/HTTP/2), [SSL/TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security), SSL session cache and OCSP stapling.

From [Is TLS Fast Yet](https://istlsfastyet.com/):
> Unlike HTTP/1.1, HTTP/2 requires only a single connection per origin, which means fewer sockets, memory buffers, TLS handshakes, and so on.

The pros:

- Asynchronous, unordered and simultaneous requests (*depends from browser, usually up to 10 simultaneous connections*);
- No data-processing/encoding, we send data as it is;
- Speed.

The cons:

- HTTP (*Hypertext Transfer Protocol*) as you see from full name of the protocol it was initially created to transfer *hypertext*, other words HTML markup. So it was created for text-based data, not binary (*files*).

## RTC Data Chanel (UDP)

This transport supported only in [webrtc-data-channel](https://github.com/veliovgroup/Meteor-Files/tree/webrtc-data-channel) branch. It's in testing mode, we're waiting for community feedback, before merging to `master`. If you're interested in RTC/DC uploads, try this branch locally. Any feedback on RTC/DC usage for uploads is highly appreciated!

The pros:

- Single socket connection;
- Direct tunneled connection from Client to Server;
- Pure binary data support;
- Native implementation and support on mobile devices;
- It's UDP.

The cons:

- No mobile browsers support;
- Chunk size limited to 64KB;
