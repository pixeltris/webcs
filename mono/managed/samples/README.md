## About

This folder contains code samples to get familiar with webcs.

## Usage

Run `dotnet samples` in webcs to pull these files into the virtual filesystem.

*`dotnet samples` internally runs `mkdir samples`, `cd samples`, `github -d https://github.com/pixeltris/webcs/tree/master/mono/managed/samples`*

Follow the sequence of commands at the top of a given file and use `edit [FILENAME]` to modify the code.

## Samples

- [process-args.cs](process-args.cs) - Writes `WebcsProcess.Args` to the terminal.
- [process-cwd.cs](process-cwd.cs) - Usage of `WebcsProcess.CurrentDirectory`.
- [process-title.cs](process-title.cs) - Usage of `WebcsProcess.TabTitle`.
- [process-hang.cs](process-hang.cs) - Shows what happens when you don't call `WebcsProcess.Exit`.
- [process-exit-early.cs](process-exit-early.cs) - Shows what happens if you call `WebcsProcess.Exit` but continue code execution.
- [async-loop.cs](async-loop.cs) - Example of async code which outputs to the terminal, then waits 1 second, and repeats 5 times.
- [nuget-json.cs](nuget-json.cs) - Usage of the `nuget` command to fetch and use the package `Newtonsoft.Json`.
- [github-hello.cs](github-hello.cs) - Usage of the `github` command to fetch a "Hello world" project and compile / run it unmodified.
- [fileout.cs](fileout.cs) - Writes a file using code. You can then use the `fs out [PATH]` command to save the file to your device.
- [main.cs](main.cs) - Usage of the `Main` entry point function.