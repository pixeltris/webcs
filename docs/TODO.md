## TODO
- Fix monaco editor context menu appearing below other content. Due to where the monaco context menu is placed in the DOM hierarchy the solution is most likely to remove all z-index specifiers from PhosphorJS
- Improve color schemes (both "dark" and "light" have contrast issues)
- Fix bug where context menu items like Tabs/Close can get stuck after closing the context menu
- Look into bug where terminal history seems to get culled
- Look into bug where terminal scroll bar seems to vanish sometimes until terminal is resized (likely related to the issue mentioned in the ui.js function createXTerm)
- Look into bug where mcs.exe seems to alternate throwing an exception on each compile
- Fix bug where you can't actually kill `dotnet load`

## Maybe...
- Support gist.github.com
- Support saving / loading .NET runtime from /idb/ (IndexedDB) (and as such avoid "dotnet load" on every page load)
- Add an emscripten filesystem which wraps the loaded assemblies so that it can be passed directly to mcs (rather than having to duplicate them into /sdk/)
- Support for accessing repos on other sites (unauthed) ([gitlab](https://docs.gitlab.com/ee/user/gitlab_com/index.html#gitlabcom-specific-rate-limits), [bitbucket](https://support.atlassian.com/bitbucket-cloud/docs/api-request-limits/)) NOTE: gitlab has CORS issues on raw files (but you can do it via the API) ref [#16732](https://gitlab.com/gitlab-org/gitlab/-/issues/16732), bitbucket seems to be OK
- Dropdown list when there are too many tabs (VisualStudio-like)
- Caching for offline use (service workers)
- Debugger? Idealy would want a JS UI dedicated to this
- Optionally use workers to allow for "process" isolation and blocking operations like Console.ReadLine() https://github.com/Tewr/BlazorWorker/blob/073c7b01e79319119947b427674b91804b784632/src/BlazorWorker/BlazorWorker.js
- Keyboard shortcuts for navigating the UI (switching tabs, creating tabs, closing tabs, resizing content, etc)
- Mobile UI (maybe out of scope for this project - it would require a seperate / fresh UI and probably a custom soft keyboard suitable for programming. the UX for this would be hard to get right and it might be a lot of code)
- OmniSharp https://github.com/OmniSharp/csharp-language-server-protocol/issues/456
- Consider creating a terminal multiplexer as an alternative to the docking UI https://github.com/rse/stmux