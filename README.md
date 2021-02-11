Web util for building and running .NET / C# text-based programs ([CLI](https://wikipedia.org/wiki/Command-line_interface) / [TUI](https://wikipedia.org/wiki/Text-based_user_interface))

##Features
- Run .NET assemblies.
- Compile C# code with `msc` or `roslyn`.
- Virtual file system with persistance, allowing you to come back to your code / compiled assemblies.
- [Terminals](https://wikipedia.org/wiki/Terminal_emulator) for interacting with built programs, and a docking UI for multiple programs to run at the same time.

##How does it work?
- A WebAssembly build of Mono is used to run .NET assemblies (Blazor ISN'T used here as it doesn't provide any benefit on top of Mono for this scenario).
- Each tab is an AppDomain which allows seperate `System.Console` interactions.
- `xterm.js` provides the terminals, `Monaco` provides the code editor, `PhosphorJS` provides the docking, `Marked` provides a markdown previewer.

##Notes
- This project is mostly suited for small text-based programs. If you want something more try [Blazor](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor) or [Uno Platform](https://github.com/unoplatform/uno).
- [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) (mounted to /idb/) is used for storage. It should be fairly large, but if you're low on disk space (or creating very large files) you may lose data.
- A list of built-in commands can be found [here](TODO) - md(markdown),edit(monaco),mcs(mcs),csc(csc/roslyn),roslyn(explicit roslyn),ls,dir,cd,pwd,mkdir,cp,clear,cls

##Resources
- [Terminal.Gui](https://github.com/migueldeicaza/gui.cs) is useful for building text-based user interfaces with C#.

##Self hosting / running locally
- All content is statically delivered, so any hosting software should work. There's a very simple web server under `hosting/svr.cs`.
- NOTE: Some form of a server is required as wasm wont load from a `file://` url.

##TODO
[X] Context menu clicking body, allow terminals to be created when nothing else is there
[X] Context menu for tabs (copy file path, save, etc)
[X] Fix monaco tab focus
[ ] Mardown ui (showdownjs?)
[ ] Hook up console
[ ] Appdomains
[ ] Dropdown list when there's too many tabs (VisualStudio-like)
[ ] Look at - mcs (compiler), Roslyn (compiler)
[ ] Color scheming
[ ] Debugger? This will probably never happen...
[ ] Smaller builds
[ ] DotNetAnywhere
[ ] Synchronization across brower tabs / windows
[ ] rotor,csc,mono -> jslinux,halfix,v86
[ ] ctrl+tab to switch tabs (some sort of gridview / list to state what tabs are what - include a search bar)
[ ] ctrl+t to open the tab menu
[ ] ctrl+n to create a new terminal
[ ] ctrl+b to open the base terminal?
[ ] Add ability to hide tabs (essentially create header/footers). This will require extra menu items to show them again.
[ ] Websockets / remote file storage. Also maybe hook up the virtual file system so a locally hosted SMB server can use it?

##Related
- https://github.com/nbarkhina/CSharp-In-Browser/tree/master
- https://github.com/Suchiman/Runny