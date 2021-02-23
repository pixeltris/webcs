# webcs

Compile / run C# in a web browser (powered by [Mono](https://github.com/mono/mono/tree/master/sdks/wasm)).

Try it here https://pixeltris.github.io/webcs

## Features
- Run .NET assemblies.
- Compile C# code with `msc` or `roslyn`.
- Client sided code execution with caching for offline usage.
- Virtual file system with persistance, allowing you to come back to your code / compiled assemblies.
- Terminals for interacting with `Console` programs, and a docking UI for multiple programs to run at the same time.

## Additional info
- IndexedDB (mounted to `/idb/`) is used for storage. It should be fairly large, but if you're low on disk space (or creating very large files) you may lose data.
- A list of built-in terminal commands can be found [here](TODO) - md(markdown),edit(monaco),mcs(mcs),csc(csc/roslyn),roslyn(explicit roslyn),ls,dir,cd,pwd,mkdir,cp,clear,cls
- [Terminal.Gui](https://github.com/migueldeicaza/gui.cs) is useful for building text-based user interfaces with C#.
- [Self-hosting](/extra/README.md#Self-hosting) **lt;dr use any static web server**.

## Dependencies
This project has a few dependencies. There aren't any package managers used here. To update dependencies you can find urls in [index.html](/index.html) and [extra-urls.txt](/extra/extra-urls.txt).
The additional dependencies are subject to change.
- Required (js): `Mono` (.NET wasm runtime), `xterm.js` (terminals), `Monaco` (code editor), `PhosphorJS` (docking / menus), `markdown-it` (markdown), `Font Awesome` (font based icons).
- Additional (js): `jquery`+`jquery-ui`, `toastr` (notifications), `SlickGrid` (data grid), `chart.js` (charts), `forge` (js TLS).
- Additional (cs): `websocket-sharp` (websockets), `BouncyCastle` (crypto / certificate generation).

## TODO
- [x] Context menu clicking body, allow terminals to be created when nothing else is there
- [x] Context menu for tabs (copy file path, save, etc)
- [x] Fix monaco tab focus
- [x] Mardown ui
- [x] Color scheming
- [ ] Make dark theme less dark / improve contrasts. Might also need larger fonts?
- [ ] Hook up console
- [ ] Appdomains
- [ ] Dropdown list when there's too many tabs (VisualStudio-like)
- [ ] Look at - mcs (compiler), Roslyn (compiler)
- [ ] Debugger? This will probably never happen...
- [ ] Smaller builds
- [ ] DotNetAnywhere
- [ ] Synchronization across brower tabs / windows
- [ ] rotor(sccomp/scc),dotgnu,old msc versions
- [ ] ctrl+tab to switch tabs (some sort of gridview / list to state what tabs are what - include a search bar)
- [ ] ctrl+t to open the tab menu
- [ ] ctrl+n to create a new terminal
- [ ] ctrl+b to open the base terminal?
- [ ] Add ability to hide tabs (essentially create header/footers). This will require extra menu items to show them again.
- [ ] Websockets / remote file storage. Keep it simple. Add "WEBCS-READONLY.txt" check on any readonly folders. Project will be called WcsEx (WcsEx.exe) - WinForms will be called WcsWinForms (but System.Windows.Forms.dll)
- [ ] https://github.com/kjur/jsrsasign / https://github.com/digitalbazaar/forge / http://www.bouncycastle.org/csharp/

## Related
- https://github.com/nbarkhina/CSharp-In-Browser
- https://github.com/Suchiman/Runny
- https://github.com/unoplatform/uno
- https://github.com/bridgedotnet/Bridge
- https://github.com/roozbehid/WasmWinforms