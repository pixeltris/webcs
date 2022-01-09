# About

If webcs is taken further blocking operations need to be considered.

## Synchronous/blocking operations (getline / Console.ReadLine)

It's possible to do synchronous/blocking operations but it requires that code execution occurs in a worker thread.

### Example 1

- Create worker where execution occurs.
- Create SharedArrayBuffer between worker/main thread.
- When sync operation needs to complete the worker thread does an Atomics.wait() on the SharedArrayBuffer. This blocks the thread.
- The main thread does a Atomics.notify() on the SharedArrayBuffer. This continues execution of the blocker worker.
- The worker can now take data from the SharedArrayBuffer to process (i.e. update stdin)

As the worker thread gets blocked during this you can cleanly create a getline()/Console.ReadLine() implementation

wasmer-js implementation:
- https://github.com/wasmerio/wasmer-js/blob/55fa8c17c56348c312a8bd23c69054b1aa633891/packages/wasm-terminal/src/process/process.ts#L228
- https://github.com/wasmerio/wasmer-js/blob/4c34bb0e584cc24036c3d6d7419550ff9c9ab502/packages/wasm-terminal/src/io-device-window/io-device-window.ts#L156

### Example 2

- Create worker where execution occurs.
- When sync operation needs to complete the worker thread uses XMLHttpRequest (sync) along with a fetch hook to handle the request which then does a postMessage to the main thread and returns any queued responses. main thread then postMessage back and then in the worker "message" event handler it then queues any data to the next XMLHttpRequest call.

em-shell implementation:
- https://github.com/tbfleming/em-shell/blob/ff20ba6409c0255adc19da3dabcb8ee0f6db55dd/worker.js#L24
- https://github.com/tbfleming/em-shell/blob/ff20ba6409c0255adc19da3dabcb8ee0f6db55dd/service.js#L169

### Example 3

Same as "Example 2", but in this case it uses importScripts as the synchronous/blocking function.

runno implementation:
- https://github.com/taybenlor/runno/commit/6e8787d700eb63d9a398ce55320786030c000dbb#diff-d1c3adcc970285fbef19c9b5db5f81b430609cfa67ab76d120b3eba9e0c30106

### Example 4 (an exact implementation)

This is an implementation of Console.ReadLine in the exact way that we're after (using similar techniques to the ones above)

- https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/WasmCSharpEditor/wwwroot/service-worker.js#L8-L9
  - This hooks `fetch` in the main thread
- https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/JSWrapper/wwwroot/js/OnFetchHandler.js#L3
  - `IsSpecial` returns true when the fetched url is `_content/JSWrapper/Dummy.html` (which doesn't exist)
- https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/JSWrapper/wwwroot/js/OnFetchHandler.js#L15
  - `GetSpecialResponse` is called on the dummy request. The "action" defines what should happen. In this case it's "GetInput" which is the given handler name for Console.ReadLine
  - This function will keep doing a `setTimout` call until user input has been provided
- https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/WasmCSharpEditor/Components/VirtualConsole.razor#L99
  - A little unintuitive, but this is a blazor handler for the user input which then uses `SendMessage` which calls [this](https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/JSWrapper/wwwroot/js/UIMessageSender.js#L1) which does a `postMessage` and is finally picked up by the above "special" fetch code which is waiting on the message.
- `Console.SetIn` is called to redirect input to this https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/CSharpCompiler/IO/WorkerTextReader.cs
- `ConsoleWorkerReader.ReadInput` is called by the above input redirector https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/JSWrapper/WorkerSyncConnection/WorkerConsoleReader.cs#L19
- `GetInput` in the js side does a synchronous XMLHttpRequest to the dummy url mentioned above and blocks any further C# code execution until the hooked `fetch` function returns a value (when the user provides input) https://github.com/2427dkusiro/WasmCSharpEditor/blob/2474c572b7b181e38e6933fc8bbd215861437be4/src/JSWrapper/wwwroot/js/WorkerConsoleReader.js

### Related

- FS.createLazyFile (library_fs.js) supports blocking file loading on worker threads via a sync XMLHttpRequest call
- emscripten Asyncify provides ways to do blocking operations by saving / restoring stack frame. This has various limitations and is not really suitable as a general purpose solution
- https://stackoverflow.com/questions/51351983/worker-using-synchronous-xmlhttprequest-to-get-data-from-gui
- https://github.com/emscripten-core/emscripten/issues/6115
- https://github.com/xtermjs/xterm.js/issues/1546#issuecomment-402547923
- https://github.com/ilyaigpetrov/ncurses-for-emscripten / https://github.com/jamesbiv/ncurses-emscripten / https://github.com/coolwanglu/PDCurses.js / https://github.com/rhaberkorn/emcurses