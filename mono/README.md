## Mono wasm info

- The mono wasm runtime code can be found [here](https://github.com/dotnet/runtime/tree/main/src/mono/wasm) with more build instructions [here](https://github.com/dotnet/runtime/blob/main/docs/workflow/building/libraries/webassembly-instructions.md)
- Examples of using the wasm runtime can be found [here](https://github.com/dotnet/runtime/tree/main/src/mono/sample/wasm)
- If you google "mono wasm" you might find [this](https://github.com/mono/mono/tree/main/sdks/wasm) or [this guide](https://github.com/mono/mono/blob/main/sdks/wasm/docs/getting-started/obtain-wasm-sdk.md). This is outdated and should be ignored (though some info is still semi-relevant ~ [permalink](https://github.com/mono/mono/tree/fbdbe8395949668d2584dcbc0072029da9ac7a86/sdks/wasm))
- If you're interested in .NET wasm discussion (and not Blazor) then the [dotnet discord](https://aka.ms/dotnet-discord) channel #webassembly is a good resource

Currently Blazor is the only officially supported avenue for running .NET in a browser. Quote by [@lambdageek](https://github.com/lambdageek) from #webassembly on discord (Sept 16 2021 at 09:52 PM UTC) `Hey folks. The only supported WebAssembly workflow (in .NET 5 and .NET 6) is via Blazor WebAssembly.  There is no official public API for just a bare webassembly project, so there's not much (any) documentation for it.` Further discussion mentioned how you're free to use the runtime but APIs may break.

## Mono wasm interop
- [This](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/mono/wasm/runtime/driver.c#L438) and [this](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/mono/wasm/runtime/corebindings.c#L35) exposes interop functions for C# to interact with JS via equivalent InternalCall flagged functions found [here](https://github.com/dotnet/runtime/blob/a546fa486cedbabe3d9cf9fbf25debf7e7578698/src/libraries/Common/src/Interop/Browser/Interop.Runtime.cs).
- Wrappers / helpers of the above exist in [System.Private.Runtime.InteropServices.JavaScript](https://github.com/dotnet/runtime/tree/1b423c3184e833d6e4b725fe4f8b97267bb82dc0/src/libraries/System.Private.Runtime.InteropServices.JavaScript/src/System/Runtime/InteropServices/JavaScript) which wrap the exposed functions mentioned above.
- [This](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/mono/wasm/runtime/cwraps.ts#L73-L131) exposes interop functions for JS to interact with C#, with additional functions [here](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/mono/wasm/runtime/method-calls.ts).
- [cs-to-js.ts](https://github.com/dotnet/runtime/blob/da0e0f73e24036a88411dde8158df80e5f4bff01/src/mono/wasm/runtime/cs-to-js.ts) / [js-to-cs.ts](https://github.com/dotnet/runtime/blob/da0e0f73e24036a88411dde8158df80e5f4bff01/src/mono/wasm/runtime/js-to-cs.ts) includes raw introp code (boxing, unboxing, etc).

Tests (useful reference code)
- Some mixed interop tests [here](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/libraries/System.Private.Runtime.InteropServices.JavaScript/tests/System/Runtime/InteropServices/JavaScript/MarshalTests.cs#L323-L325) / [here](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/libraries/System.Private.Runtime.InteropServices.JavaScript/tests/System/Runtime/InteropServices/JavaScript/HelperMarshal.cs) / [here](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/mono/wasm/test-main.js#L223).
- Tests of `System.Private.Runtime.InteropServices.JavaScript` [here](https://github.com/dotnet/runtime/blob/69b5d67d9418d672609aa6e2c418a3d4ae00ad18/src/libraries/System.Private.Runtime.InteropServices.JavaScript/tests/System/Runtime/InteropServices/JavaScript/JavaScriptTests.cs).

## Updating mono for webcs
- [Download the latest mono wasm build](https://www.nuget.org/packages/Microsoft.NETCore.App.Runtime.Mono.browser-wasm/)
- Navigate to `/runtimes/browser-wasm/native/`
- Copy `dotnet.wasm`, `dotnet.js` to `/mono/`
- Copy `icudt` files to `/mono/managed/icu/`
- Copy `System.Private.CoreLib.dll` to `/mono/managed/sdk/`
- Copy everything from `/runtimes/browser-wasm/lib/netXXX/` to `/mono/managed/sdk/`
- Bump the version number in `index.html`
- Update the assembly / file size list below for "Hello world" (optional)

*See `Compression` below.*

TODO: Find out difference between [this](https://www.nuget.org/packages/Microsoft.NETCore.App.Runtime.Mono.browser-wasm/) runtime (which is being used) and [this](https://www.nuget.org/packages/Microsoft.NETCore.App.Runtime.browser-wasm/) runtime  
NOTE: There seem to be issues with both roslyn / mcs under `Microsoft.NETCore.App.Runtime.browser-wasm` 5.0.13

## Minimum assemblies for "Hello world"
- System.Private.CoreLib.dll (3.29 MB)
- mscorlib.dll (56.1 KB)
- System.Runtime.dll (40.1 KB)
- System.Console.dll (51.1 KB)
- System.Collections.dll (99.6 KB)
- System.Private.Uri.dll (98.1 KB)
- System.Threading.dll (43.6 KB)
- System.Runtime.InteropServices.dll (37.1 KB)
- System.Private.Runtime.InteropServices.JavaScript.dll (48.1 KB)

## Updating roslyn
- Download the latest build from [here](https://www.nuget.org/packages/Microsoft.CodeAnalysis.CSharp) and [here](https://www.nuget.org/packages/Microsoft.CodeAnalysis.Common)
- Copy the desired dlls into `/mono/managed/bin/roslyn/`
- Bump the version number in `WebcsCompilerRoslyn` [webcs.cs](/mono/managed/bin/webcs/webcs.cs)

*See `Compression` below.*

## Updating mcs
- See `WebcsCompilerMcs` [webcs.cs](/mono/managed/bin/webcs/webcs.cs)

## /mono/dotnet-extra.js
- The mono runtime is loaded in here (as opposed to `mono_load_runtime_and_bcl`). `/mono/managed/files.json` lists all known files in `/mono/managed/` which allows it to find files on the static web server.
- IndexedDB / localStorage mount points aren't included in the runtime. dotnet-extra.js has code for them and mounts them to `/idb/` and `/loc/`.

## /mono/sdk/
Libraries copied from the mono wasm runtime.

## /mono/bin/
All other types of libraries / binaries.

## /mono/icu/
"International Components for Unicode" files (currently unused).

## /mono/samples/
Sample code. These can be fetched via `dotnet samples`.

## Compression

Compression is optional but it's used for the files found in this repo as it's hosted on GitHub Pages which doesn't gzip the files by default. If you're self hosting it'll be more efficient to use content encoding compression.

```
mkdir cmp
cd cmp
fs in <--- create managed.zip by zipping the managed folder and select it
unzip managed.zip
compress -brotli -r managed -l:9
fs out out/managed
```

gzip alternative: `compress -gzip -r managed -l:9`

At this point you want to copy the files you want and delete the originals. You'll also want to re-run genfiles.exe

Getting original files back:

```
mkdir uncmp
cd uncmp
fs in <--- create managed.zip by zipping the managed folder and select it
unzip managed.zip
compress -d -r managed
fs out out/managed
```