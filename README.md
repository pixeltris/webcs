Web util for building and running .NET/C# text based programs (CLI/TUI)

Use cases:
- Writing C# without proper dev tools
- Sharing simple .NET tools without having to distribute binaries
- Building a TUI focused toolset

- Blazor
- DotNetAnywhere
- mcs (compiler)
- Roslyn (compiler)
- IL2C, IL2CPP

"mono" folder info:
- https://jenkins.mono-project.com/job/test-mono-mainline-wasm/label=ubuntu-1804-amd64/lastSuccessfulBuild/Azure/processDownloadRequest/5604/ubuntu-1804-amd64/sdks/wasm/mono-wasm-29f202f72fe.zip
- builds/release/dotnet.wasm, builds/release/dotnet.js, runtime.js
- mono-config.js was created manually

https://github.com/mono/mono/blob/master/sdks/wasm/docs/getting-started/obtain-wasm-sdk.md
https://jenkins.mono-project.com/job/test-mono-mainline-wasm/label=ubuntu-1804-amd64/lastSuccessfulBuild/Azure/
https://jenkins.mono-project.com/job/test-mono-mainline-wasm/label=ubuntu-1804-amd64/lastSuccessfulBuild/Azure/processDownloadRequest/5604/ubuntu-1804-amd64/sdks/wasm/mono-wasm-29f202f72fe.zip