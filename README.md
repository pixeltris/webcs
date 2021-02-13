Fully client sided web tool for coding and running .NET / C# programs.

## Features
- Run .NET assemblies.
- Compile C# code with `msc` or `roslyn`.
- Virtual file system with persistance, allowing you to come back to your code / compiled assemblies.
- Terminals for interacting with `Console` programs, and a docking UI for multiple programs to run at the same time.
- WinForms implementaion (extremely basic / stripped down).

## How does it work?
- A WebAssembly build of Mono is used to run .NET assemblies (Blazor *isn't* used here as it doesn't provide any benefit on top of Mono for this scenario).
- `xterm.js` (terminals), `Monaco` (code editor), `PhosphorJS` (docking/menus), `markdown-it` (markdown), `awesome-notifications` (notifications).

## Notes / resources / help
- *This project is suited for simple programs. If you want to use C#/.NET in a web browser and want something more try [Blazor](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor), [Uno Platform](https://github.com/unoplatform/uno), or [Bridge.NET](https://github.com/bridgedotnet/Bridge).
- *Don't use this project for "real" coding. If you want to code in a web browser use https://github.com/cdr/code-server or https://github.com/eclipse-theia/theia.*
- IndexedDB (mounted to `/idb/`) is used for storage. It should be fairly large, but if you're low on disk space (or creating very large files) you may lose data.
- A list of built-in terminal commands can be found [here](TODO) - md(markdown),edit(monaco),mcs(mcs),csc(csc/roslyn),roslyn(explicit roslyn),ls,dir,cd,pwd,mkdir,cp,clear,cls
- [Terminal.Gui](https://github.com/migueldeicaza/gui.cs) is useful for building text-based user interfaces with C#.
- [Self-hosting](/hosting/README.md) **lt;dr use any static web server**.

## TODO
- [X] Context menu clicking body, allow terminals to be created when nothing else is there
- [X] Context menu for tabs (copy file path, save, etc)
- [X] Fix monaco tab focus
- [X] Mardown ui
- [/] Color scheming - TODO: Finish this (add xterm light theme, add dark context menus, add dark docking, add dark scroll bars (xterm / markdown))
- [ ] Hook up console
- [ ] Appdomains
- [ ] Dropdown list when there's too many tabs (VisualStudio-like)
- [ ] Look at - mcs (compiler), Roslyn (compiler)
- [ ] Debugger? This will probably never happen...
- [ ] Smaller builds
- [ ] DotNetAnywhere
- [ ] Synchronization across brower tabs / windows
- [ ] rotor,csc,mono -> jslinux,halfix,v86
- [ ] ctrl+tab to switch tabs (some sort of gridview / list to state what tabs are what - include a search bar)
- [ ] ctrl+t to open the tab menu
- [ ] ctrl+n to create a new terminal
- [ ] ctrl+b to open the base terminal?
- [ ] Add ability to hide tabs (essentially create header/footers). This will require extra menu items to show them again.
- [ ] Websockets / remote file storage. Also maybe hook up the virtual file system so a locally hosted SMB server can use it?
- [ ] x-spreadsheets/ag-grid/reactgrid? chart.js?
- [ ] https://github.com/f3oall/awesome-notifications
- [ ] Simple WinForms implementaion
- [ ] WinForm web GUI designer? Very complex, unlikely to ever happen.

## Related
- https://github.com/nbarkhina/CSharp-In-Browser
- https://github.com/Suchiman/Runny
- https://github.com/unoplatform/uno
- https://github.com/bridgedotnet/Bridge
- https://github.com/roozbehid/WasmWinforms