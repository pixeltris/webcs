# Getting started

This gives a very basic introduction to using webcs and a list of available commands.

See [samples](/mono/managed/samples#about) and [how it works](HowItWorks.md).

## Hello world

```
dotnet load
dotnet new hello
dotnet build
hello.exe
```

Creates a new project, builds it, and runs it. Example output:

```
Hello world
Enter your name: pixeltris
Hi there 'pixeltris'
Process exiting
```

To expand on this:

- `dotnet load` load the .NET runtime ([Mono](https://github.com/dotnet/runtime/tree/main/src/mono/wasm)).
- `dotnet new hello` create a new folder named `hello`, `cd` into it, create `hello.csproj` / `Program.cs`.
- `dotnet build` search for a `.csproj` with the current folder name (`hello.csproj`) and compile using [roslyn](https://github.com/dotnet/roslyn).
- `hello.exe` search for `hello.exe` and run via `dotnet hello.exe [ARGS]` (`Assembly.Load` and invoke `WebcsMain`).

# Commands

[xterm-commands.js](/ui/xterm-commands.js)

### dotnet

.NET command line tools

- `dotnet load` Load the .NET runtime
  - `-q` Load quietly (no output). Without this flag each fetched assembly will be logged to the terminal.
- `dotnet loadq` Alias for `dotnet load -q`.
- `dotnet l` / `dotnet lq` Aliases for `dotnet load` / `dotnet loadq`.
- `donet new [NAME]` Create folder of `[NAME]`, cd into it, create `[NAME].csproj` / `Program.cs`.
- `dotnet build [PATH]` Build csproj at `[PATH]`.
- `dotnet build` Build csproj with the current folder name (e.g. cwd `/hello/` builds `/hello/hello.csproj`).
- `dotnet csc [PATH(s)]` Build source files.
  - `-reference:[PATH]` Reference an assembly (short: `-r:`).
  - `-target:[TYPE]` Target binary type `exe` / `dll` (short: `-t:`).
  - `-out:[PATH]` Set assembly output name.
  - `-recurse:[PATH]` Recursive include files in `[PATH]`.
  - `-unsafe[+|-]` Allow unsafe code (currently enabled by default).
  - Note: `[PATH(s)]` can be include `*.cs` (all files) or `**.cs` (all files recursive).
  - Note: You'll almost always want `/r:webcs.exe`.
- `dotnet getcomp` Get available compilers (and list the active compiler language versions).
- `dotnet setcomp` Set the active compiler (`roslyn` / `mcs`).
- `dotnet samples` Fetch `/mono/managed/samples/` files from github.
- `dotnet version` Get version info of .NET / webcs.
- `dotnet help` Show help (no command specifics unfortunately).
- `dotnet [BINARY] [ARGS]` Run the given `[BINARY]` with `[ARGS]` (e.g. `dotnet hello.exe arg1 arg2`).
  - `--main` Force run `Main`.
  - `--mainc` Force run `Main` and do not redirect console output to the terminal.
  - `--rdc` Redirect console output to the terminal.
  - Note: Async programs not designed for webcs will continue execution after "termination" and things like terminal output may produce undesired results.

### edit

Open a text editor `[PATH(s)]`

- `-f` Don't focus the new text editor.
- `-t` Create the file (if it doesn't exist).

### github

Fetch files from a github repo `[URL]`

- `-r` Check rate limits / used quota (60 requests per hour).
- `-f` Fetch single file (based on url).
- `-d` Fetch sub directory (based on url).

### nuget

Fetch a nuget package and extract "lib" `[URL]` / `[NAME]`

- `-v:[VERSION]` Version to fetch.
- `-sn` Save as file and do not extract.
- `-s` Save as a file.
- `-n` Do not extract.
- `-e` Extract all.
- Note: The `unzip` command can be used to extract from a saved `.nuget` file.

### fs

Transfer files in / out of the virtual filesystem

- `in` Transfer files in (`^C` to cancel).
- `out` Transfer `[PATH(s)]` out.

### fsync

Sync persistance storage (IndexedDB `/idb/`, localStorage `/loc/`)

- `load` Load instead of save.
- Note: `/idb/` doesn't exist for some browsers (i.e. Firefox private browsing).

### zip

Create a zip of `[NAME]` with content of `[PATH(s)]`

- `-r` Top level directory contents go into the root of the zip.

### unzip

Unzip `[PATH(s)]`

- `-d:[PATH]` Output directory (it must already exist).

### theme

Set the UI theme `[NAME]`

- `-l` List theme names.

### termnew

Create a new terminal `[NAME]`

- `-f` Don't focus the terminal.
- `-p` Use current working directory.

### termname

Set the terminal tab `[NAME]`

### cd

Change working directory [PATH]

### cp

Copy `[SOURCE(s)]` to `[DEST]`

- `-r` Recursive copy.

### ls

List directory contents `[PATH]`

- `-l` Long format.
- `-a` Show hidden entries (.).

### mv

Move `[SOURCE(s)]` to `[DEST]`

### touch

Update modify date `[PATH(s)]`

- `-c` Do not create files.

### mkdir

Create directory `[PATH(s)]`

- `-p` Make parent directories as needed.

### rmdir

Remove empty directory `[PATH(s)]`

### rm

Remove / delete `[PATH(s)]`

- `-r` Recursive delete.

### pwd

Print working directory

### exit

Close the terminal

### clear

Clear the screen (visible buffer)

### reset

Reset the screen (clear entire buffer / reset state)