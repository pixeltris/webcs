# Self-hosting

**Content is statically delivered, so you generally don't need to use anything listed here.**

*Some form of a server is required as wasm wont load from a `file://` url.* `StaticFileServer` can be used if you don't have your own.

## StaticFileServer
A simple static web server which gives the web browser whatever it asks for (within the sub folders).

## webcs
Provides additional functionality (remote file storage, remote access, etc) (TODO).

## CertificateGenerator
Uses BouncyCastle.dll to generate self-signed X.509 certificates. These would need to be added to a cert store to be trusted (your browser cert store, or OS cert store).