**All content is statically delivered, so you generally shouldn't need to use anything here.** *However, some form of a server is required as wasm wont load from a `file://` url.*

There are a couple of optional non-static features which provide additional functionality (remote file storage, remote access, etc) (TODO).

Additionally there's a simple web server `svr.cs` for hosting on localhost (if you don't have your own at hand).

## svr.cs
A simple web server which gives the web browser whatever it asks for.