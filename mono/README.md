## Updating mono
- Download [the latest mono wasm build](https://jenkins.mono-project.com/job/test-mono-mainline-wasm/label=ubuntu-1804-amd64/lastSuccessfulBuild/Azure/) ~ [currently using this](https://jenkins.mono-project.com/job/test-mono-mainline-wasm/label=ubuntu-1804-amd64/lastSuccessfulBuild/Azure/processDownloadRequest/5604/ubuntu-1804-amd64/sdks/wasm/mono-wasm-29f202f72fe.zip) ~ [official guide](https://github.com/mono/mono/blob/master/sdks/wasm/docs/getting-started/obtain-wasm-sdk.md)
- Copy `builds/release/dotnet.wasm`, `builds/release/dotnet.js`
- Comment out the following in dotnet.js (conflict with PhosphorJS) `ENVIRONMENT_IS_NODE=typeof process==="object"&&typeof process.versions==="object"&&typeof process.versions.node==="string";`
- Copy required assemblies from `wasm-bcl/wasm` to `managed` (see below for list of minimum required assemblies)
- To update `mcs.exe` see `mcs-host.cs`

## Minimum required assemblies (for "Hello world")
- mscorlib.dll (4.09 MB)
- netstandard.dll (97.5 KB)
- System.dll (1.75 MB)
- WebAssembly.Bindings.dll (37.0 KB)

## dotnet-extra.js
- mono is built using Emscripten without an IndexedDB mount point. dotnet-extra.js adds this in (mounts to `/idb`). Updates to this generally shouldn't be required.

## /amanaged/bin
- Anything in this folder will be treated as a command line program. This is where you should put your versions of tools such as `ls`, `cd`, `pwd`, etc.

## /managed/sdk
- sdk / gac, put all assemblies here for referenceing (see `wasm-bcl/wasm`)