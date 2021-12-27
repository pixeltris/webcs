// We want to support looking up all known assemblies from a json file (everything listed under /mono/managed/).
// This avoids us having to probe non-existent urls and allows us to do our own assembly lookup.
//
// (Blazor loader) https://github.com/dotnet/aspnetcore/blob/b569ccf308f5c95b0e1d2a5df2163e0716822db9/src/Components/Web.JS/src/Platform/Mono/MonoPlatform.ts
// (Blazor resource loader) https://github.com/dotnet/aspnetcore/blob/b569ccf308f5c95b0e1d2a5df2163e0716822db9/src/Components/Web.JS/src/Platform/WebAssemblyResourceLoader.ts
// (Mono loader) https://github.com/dotnet/runtime/blob/80765225d8f86b2e00c4344a517c57094cd8a479/src/mono/wasm/runtime/startup.ts#L298
// (Uno loader) https://github.com/unoplatform/Uno.Wasm.Bootstrap/blob/main/src/Uno.Wasm.Bootstrap/WasmScripts/uno-bootstrap.js

const WCS_FILE_BEHAVIOR_ASSEMBLY = 'assembly';
const WCS_FILE_BEHAVIOR_PDB = 'pdb';
const WCS_FILE_BEHAVIOR_ICU = 'icu';

var WebcsInterop = {
    logFileLoads: false,
    hasInitLoadError: false,
    initProgressCount: 0,
    initProgressTarget: 0,
    rootDir: { dirs: [], files: [] },
    allFilesByName: [],// Duplicates are ignored. First come, first serve (based on json file list order).
    mainFileList: [
        // Minimum required for "Hello world"
        'System.Private.CoreLib.dll', 'mscorlib.dll', 'System.Runtime.dll', 'System.Console.dll', 'System.Collections.dll', 'System.Private.Uri.dll', 'System.Threading.dll', 'System.Runtime.InteropServices.dll', 'System.Private.Runtime.InteropServices.JavaScript.dll',
        // Everything else
        'webcs.exe',
        //'System.Private.Xml.dll', 'System.Xml.dll',
    ],
    disablePreLoad: true,// If false load .NET runtime on page load. If true load it when requested (terminal command)
    fullLoaderUsePrompt: false,// If true prompt (y/n in terminal) when fetching full .NET runtime
    fullLoaderUseSimpleProgressBar: false,// If true output a simple loading progress bar when fetching full .NET runtime
    isRuntimeInitialized: false,
    fileListUrl: '/mono/managed/files.json',
    entryPointBinaryName: 'webcs.exe',
    entryPointClassName: 'Webcs',
    mountPointDir: 'managed',
    mountPointUrl: '/mono/managed/',
    localStorageMountPoint: '/loc',
    indexedDbMountPoint: '/idb',
    init_mono_globalization_mode: null,//'invariant' / 'icu'
    init_mono_debug_level: 0,
    webcsOnTabClosed: null,
    webcsOnReadLine: null,
    webcsOnProcessExit: null,
    webcsOnProcessKill: null,
    webcsRunMain: null,
    onPageLoad: function () {
        this.initProgressCount = 0;
        this.initProgressTarget = this.mainFileList.length;
        if (this.initProgressTarget > 0) {
            // Add an entry for dotnet.js / dotnet.wasm load time.
            // Add an entry for the json file list.
            // Add an entry to represent additional execution time for webcs
            this.initProgressTarget += 3;
        }
        this.initProgressRefresh();
    },
    setInitLoadingText: function(str) {
        var el = document.getElementById('pageLoadingDiv');
        if (el != null) {
            el.innerHTML = str;
        }
    },
    initLoadError: function(str) {
        if (this.hasInitLoadError) {
            return;
        }
        this.hasInitLoadError = true;
        this.setInitLoadingText('ERROR: ' + str);
    },
    initProgressRefresh: function() {
        if (this.hasInitLoadError) {
            return;
        }
        if (this.disablePreLoad) {
            this.setInitLoadingText('Loading...');
        } else {
            this.setInitLoadingText('Loading... (' + this.initProgressCount + '/' + this.initProgressTarget + ')');
        }
    },
    initProgressStep: function() {
        if (this.initProgressCount >= this.initProgressTarget) {
            return;
        }
        this.initProgressCount++;
        this.initProgressRefresh();
    },
    tryPushLoadedFile: function(fileInfo, url) {
        if (!MONO.loaded_files) {
            MONO.loaded_files = [];
        }
        let shouldAddFile = true;
        for (let j = 0; j < MONO.loaded_files.length; j++) {
            if (MONO.loaded_files[j].file == fileInfo.name) {
                shouldAddFile = false;
                break;
            }
        }
        if (shouldAddFile) {
            MONO.loaded_files.push({ file: fileInfo.name, url: url });
            return true;
        }
        return false;
    },
    loadFiles: function(files, callback, callbackStep) {
        if (!MONO.mono_wasm_add_assembly) {
            MONO.mono_wasm_add_assembly = Module.cwrap('mono_wasm_add_assembly', 'number', ['string', 'number', 'number']);
            MONO.mono_wasm_add_satellite_assembly = Module.cwrap('mono_wasm_add_satellite_assembly', 'void', ['string', 'string', 'number', 'number']);
        }
        if (this.logFileLoads) {
            console.log('WebcsInterop.loadFiles', JSON.stringify(files));
        }
        // NOTE: Worth looking at _apply_configuration_from_args (mono_wasm_setenv, mono_wasm_set_runtime_options)
        var fileInfos = [];
        for (var i = 0; i < files.length; i++) {
            var filePath = files[i];
            var fileInfo = null;
            var slashIndex = filePath.indexOf('/');
            if (slashIndex >= 0) {
                // Path information is provided. Assume this is a fully qualified path.
                var pathSplitted = filePath.split('/').filter(x => x);
                if (pathSplitted[0] == this.mountPointDir) {
                    pathSplitted.shift();
                }
                var dir = this.rootDir;
                for (var j = 0; j < pathSplitted.length; j++) {
                    var pathElement = pathSplitted[j];
                    if (j == pathSplitted.length - 1) {
                        fileInfo = dir.files[pathElement];
                    } else {
                        dir = dir.dirs[pathElement];
                        if (!dir) {
                            break;
                        }
                    }
                }
            } else {
                // TODO: Do something better here. Maybe remove allFilesByName as it's a bit unnecessary.
                // Also need to do our own assembly resolving...
                // - https://github.com/mono/mono/blob/main/mono/metadata/assembly.c
                // - https://github.com/dotnet/runtime/blob/main/src/mono/mono/metadata/assembly.c
                // - https://github.com/godotengine/godot/blob/7cbdb9b4c36dfd44ab120d5bce37f0a27439ca6b/modules/mono/mono_gd/gd_mono_assembly.cpp#L224
                // Maybe have this.allAssemblies which is a map of assemblies, each entry contains a list of fileInfos? and then do resolving from that?
                fileInfo = this.allFilesByName[filePath];
            }
            if (fileInfo) {
                fileInfos.push(fileInfo);
            } else {
                console.error('Attempted to fetch non-existing file %s', filePath);
            }
        }
        var loadFilesResponse = { numFilesToLoad: fileInfos.length, numFilesLoaded: 0 };
        var pendingCount = fileInfos.length;
        var onPendingRequestComplete = function(fileInfo, success) {
            --pendingCount;
            if (success) {
                loadFilesResponse.numFilesLoaded++;
            }
            if (callbackStep) {
                callbackStep(fileInfo);
            }
            if (pendingCount == 0) {
                if (callback) {
                    callback(loadFilesResponse);
                }
            }
        };
        if (fileInfos.length == 0) {
            callback(loadFilesResponse);
        }
        for (var i = 0; i < fileInfos.length; i++) {
            let fileInfo = fileInfos[i];
            if (fileInfo.isLoaded) {
                onPendingRequestComplete(fileInfo, true);
                continue;
            }
            let url = this.mountPointUrl + fileInfo.path;
            if (this.logFileLoads) {
                console.log('Attempting to fetch %s', url);
            }
            try {
                fetch(url, {credentials: 'same-origin'}).then((response) => {
                    if (response.ok) {
                        try {
                            response.arrayBuffer().then((buffer) => {
                                let loadSuccess = true;
                                try {
                                    var bytes = new Uint8Array(buffer);
                                    var offset = null;
                                    switch (fileInfo.behavior) {
                                        case WCS_FILE_BEHAVIOR_ASSEMBLY:
                                        case WCS_FILE_BEHAVIOR_PDB:
                                            // mono_wasm_add_assembly handles assemblies and pdbs
                                            offset = MONO.mono_wasm_load_bytes_into_heap(bytes);
                                            // /sdk/ is currently required if compiling with mcs.exe
                                            try {
                                                FS.mkdir('/sdk/');
                                            } catch{}
                                            FS.writeFile('/sdk/' + fileInfo.name, bytes);
                                            fileInfo.offset = offset;
                                            fileInfo.size = bytes.length;
                                            let hasPdb = MONO.mono_wasm_add_assembly(fileInfo.name, offset, bytes.length);
                                            if (hasPdb) {
                                                this.tryPushLoadedFile(fileInfo, url);
                                            }
                                            break;
                                        case WCS_FILE_BEHAVIOR_ICU:
                                            offset = MONO.mono_wasm_load_bytes_into_heap(bytes);
                                            if (!MONO.mono_wasm_load_icu_data(offset)) {
                                                console.error('WebcsInterop: Error loading ICU asset %s', url);
                                            }
                                            break;
                                    }
                                    fileInfo.isLoaded = true;
                                } catch (exc) {
                                    loadSuccess = false;
                                    console.error('WebcsInterop: Unhandled exception processing fetch data\n%s', exc);
                                    throw exc;
                                } finally {
                                    onPendingRequestComplete(fileInfo, loadSuccess);
                                }
                            });
                        } catch (exc) {
                            console.error('WebcsInterop: Error handling fetch response %s\n%s', url, exc);
                            onPendingRequestComplete(fileInfo, false);
                        }
                    } else {
                        onPendingRequestComplete(fileInfo, false);
                    }
                });
            } catch (exc) {
                console.error('WebcsInterop: Error fetching %s\n%s', url, exc);
                onPendingRequestComplete(fileInfo, false);
            }
        }
    },
    // For both bind/call you can provide your own signature or leave it undefined for it to determine it from the C# function signature via mono_method_get_call_signature
    // There are notes on the signature string here https://github.com/dotnet/runtime/blob/da0e0f73e24036a88411dde8158df80e5f4bff01/src/mono/wasm/runtime/method-calls.ts#L126-L141
    bindStaticMethod(name, signature) {
        // mono_bind_static_method(fqn, signature)
        return BINDING.bind_static_method('[' + this.entryPointBinaryName + '] ' + this.entryPointClassName + ':' + name, signature);
    },
    callStaticMethod(name, args, signature) {
        // call_static_method(fqn, args, signature)
        return BINDING.call_static_method('[' + this.entryPointBinaryName + '] ' + this.entryPointClassName + ':' + name, args, signature);
    },
    initRuntime: function(isPreload) {
        if (this.isRuntimeInitialized) {
            return;
        }
        this.isRuntimeInitialized = true;
        try {
            var load_runtime = Module.cwrap('mono_wasm_load_runtime', null, ['string', 'number']);
            console.debug('MONO_WASM: Initializing mono runtime');
            MONO.mono_wasm_globalization_init(this.init_mono_globalization_mode);
            load_runtime("unused", this.init_mono_debug_level);
            MONO.mono_wasm_runtime_ready();
        } catch (err) {
            if (isPreload) {
                this.initLoadError('Init .NET runtime failed.</br></br>' + err);
            }
            throw err;
        }
        // Invoke Main on webcs.exe
        try {
            this.callStaticMethod('Main');
        } catch (err) {
            if (isPreload) {
                this.initLoadError('Invoking Main on ' + this.entryPointBinaryName + ' failed.</br></br>' + err);
            }
            throw err;
        }
        if (isPreload) {
            this.initProgressStep();// Step progress to denote exeution time 
            initUI();
        }
        this.webcsOnTabClosed = this.bindStaticMethod('OnTabClosed');
        this.webcsOnReadLine = this.bindStaticMethod('OnReadLine');
        this.webcsOnProcessExit = this.bindStaticMethod('OnProcessExit');
        this.webcsOnProcessKill = this.bindStaticMethod('OnProcessKill');
    },
    init: function() {
        this.initProgressStep();// Increment progress for the dotnet.js/dotnet.wasm load
        fetch(this.fileListUrl/*, {cache: 'no-cache'}*/).then(async (response) => {
            if (response.ok) {
                this.initProgressStep();// Increment progress for the json load
                try {
                    var fileInfoData = JSON.parse(await response.text());
                    var files = fileInfoData.files;
                    if (!files) {
                        this.initLoadError('Missing "files" from the .NET file list.');
                        return;
                    }
                    for (var i = 0; i < files.length; i++) {
                        var fileInfo = files[i];
                        var filePathSplitted = fileInfo.path.split('/');
                        var dir = this.rootDir;
                        dir.mountPointUrl = this.mountPointUrl;//LAZYFS
                        dir.pendingReads = new Set();//LAZYFS
                        for (var j = 0; j < filePathSplitted.length; j++) {
                            var itemName = filePathSplitted[j];
                            if (!itemName) {
                                this.initLoadError('Invalid .NET file list (sanitize it).');
                            }
                            if (j == filePathSplitted.length - 1) {
                                // Last path entry should be the file
                                if (!fileInfo.behavior) {
                                    // Determine behavior from file name / path
                                    var itemNameLower = itemName.toLowerCase();
                                    if (fileInfo.assemblyName) {
                                        fileInfo.behavior = WCS_FILE_BEHAVIOR_ASSEMBLY;
                                    } else if (itemNameLower.endsWith('.pdb')) {
                                        // This wont be true in the case if a native PDBs happen to be here...
                                        fileInfo.behavior = WCS_FILE_BEHAVIOR_PDB;
                                    }
                                    else if (itemNameLower.startsWith('icudt') && itemNameLower.endsWith('.dat')) {
                                        fileInfo.behavior = WCS_FILE_BEHAVIOR_ICU;
                                    }
                                }
                                fileInfo.name = itemName;
                                dir.files[itemName] = fileInfo;
                                if (!this.allFilesByName[itemName]) {
                                    this.allFilesByName[itemName] = fileInfo;
                                }
                            } else {
                                var subDir = dir.dirs[itemName];
                                if (!subDir) {
                                    dir.dirs[itemName] = subDir = { dirs: [], files: [] };
                                }
                                dir = subDir;
                            }
                        }
                    }
                    //FS.mkdir('/' + this.mountPointDir);
                    //FS.mount(LAZYFS, {dirInfo: this.rootDir, mountUrl: this.mountPointUrl}, '/' + this.mountPointDir);
                    try {
                        // mount localStorage
                        FS.mkdir(this.localStorageMountPoint);
                        FS.mount(LSFS, { key: this.localStorageMountPoint.substring(1) }, this.localStorageMountPoint);
                    } catch (err) {
                        FS.unmount(this.localStorageMountPoint);
                        FS.rmdir(this.localStorageMountPoint);
                        //this.initLoadError('Mount localStorage failed.</br></br>' + err);
                        //throw err;
                    }
                    try {
                        // mount IndexedDB and sync
                        FS.mkdir(this.indexedDbMountPoint);
                        FS.mount(IDBFS, {}, this.indexedDbMountPoint);
                        FS.syncfs(true, (err) => {
                            if (err) {
                                // This happens on firefox private browsing (it doesn't support IndexedDB writes)
                                FS.unmount(this.indexedDbMountPoint);
                                FS.rmdir(this.indexedDbMountPoint);
                                //this.initLoadError('IndexedDB sync failed.</br></br>' + err);
                                //throw err;
                            }
                            if (!this.disablePreLoad) {
                                this.loadFiles(this.mainFileList, (loadFilesResponse) => {
                                    if (loadFilesResponse.numFilesLoaded != this.mainFileList.length) {
                                        this.initLoadError('Failed to load main file list. Loaded ' + loadFilesResponse.numFilesLoaded + ' / ' + this.mainFileList.length);
                                        return;
                                    }
                                    this.initRuntime(true);
                                }, (stepFileInfo) => {
                                    // Step progress for each downloaded file
                                    this.initProgressStep();
                                });
                            } else {
                                initUI();
                            }
                        });
                    } catch (err) {
                        this.initLoadError('Mount IndexedDB failed.</br></br>' + err);
                        throw err;
                    }
                } catch (err) {
                    this.initLoadError('Invalid .NET file list format.</br></br>' + err);
                    throw err;
                }
            } else {
                this.initLoadError('Failed to load .NET file list.');
            }
        });
    },
};

// File systems: MEMFS (memory ~ default), IDBFS (IndexedDB), WORKERFS (copy-free worker scope thing), NODEFS (node.js fs)
// NOTE: localStorage might also be nice as an alternative to IndexedDB... but emscripten doesn't provide one.

////////////////////////////////////////////////////////////////////////////////////////////
// https://github.com/emscripten-core/emscripten/blob/master/src/library_idbfs.js
////////////////////////////////////////////////////////////////////////////////////////////
var IDBFS = {
    dbs: {},
    indexedDB: function() {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
    },
    DB_VERSION: 21,
    DB_STORE_NAME: 'FILE_DATA',
    mount: function(mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
    },
    syncfs: function(mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
            if (err) return callback(err);

            IDBFS.getRemoteSet(mount, function(err, remote) {
                if (err) return callback(err);

                var src = populate ? remote : local;
                var dst = populate ? local : remote;

                IDBFS.reconcile(src, dst, callback);
            });
        });
    },
    getDB: function(name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
            return callback(null, db);
        }

        var req;
        try {
            req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
            return callback(e);
        }
        if (!req) {
            return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            var transaction = e.target.transaction;

            var fileStore;

            if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
            } else {
                fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
            }

            if (!fileStore.indexNames.contains('timestamp')) {
                fileStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = function() {
            db = req.result;

            // add to the cache
            IDBFS.dbs[name] = db;
            callback(null, db);
        };
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
        };
    },
    getLocalSet: function(mount, callback) {
        var entries = {};

        function isRealDir(p) {
            return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
            return function(p) {
                return PATH.join2(root, p);
            }
        };

        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));

        while (check.length) {
            var path = check.pop();
            var stat;

            try {
                stat = FS.stat(path);
            } catch (e) {
                return callback(e);
            }

            if (FS.isDir(stat.mode)) {
                check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
            }

            entries[path] = { 'timestamp': stat.mtime };
        }

        return callback(null, { type: 'local', entries: entries });
    },
    getRemoteSet: function(mount, callback) {
        var entries = {};

        IDBFS.getDB(mount.mountpoint, function(err, db) {
            if (err) return callback(err);

            try {
                var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
                transaction.onerror = function(e) {
                    callback(this.error);
                    e.preventDefault();
                };

                var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                var index = store.index('timestamp');

                index.openKeyCursor().onsuccess = function(event) {
                    var cursor = event.target.result;

                    if (!cursor) {
                        return callback(null, { type: 'remote', db: db, entries: entries });
                    }

                    entries[cursor.primaryKey] = { 'timestamp': cursor.key };

                    cursor.continue();
                };
            } catch (e) {
                return callback(e);
            }
        });
    },
    loadLocalEntry: function(path, callback) {
        var stat, node;

        try {
            var lookup = FS.lookupPath(path);
            node = lookup.node;
            stat = FS.stat(path);
        } catch (e) {
            return callback(e);
        }

        if (FS.isDir(stat.mode)) {
            return callback(null, { 'timestamp': stat.mtime, 'mode': stat.mode });
        } else if (FS.isFile(stat.mode)) {
            // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
            // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
            node.contents = MEMFS.getFileDataAsTypedArray(node);
            return callback(null, { 'timestamp': stat.mtime, 'mode': stat.mode, 'contents': node.contents });
        } else {
            return callback(new Error('node type not supported'));
        }
    },
    storeLocalEntry: function(path, entry, callback) {
        try {
            if (FS.isDir(entry['mode'])) {
                FS.mkdir(path, entry['mode']);
            } else if (FS.isFile(entry['mode'])) {
                FS.writeFile(path, entry['contents'], { canOwn: true });
            } else {
                return callback(new Error('node type not supported'));
            }

            FS.chmod(path, entry['mode']);
            FS.utime(path, entry['timestamp'], entry['timestamp']);
        } catch (e) {
            return callback(e);
        }
        callback(null);
    },
    removeLocalEntry: function(path, callback) {
        try {
            var lookup = FS.lookupPath(path);
            var stat = FS.stat(path);

            if (FS.isDir(stat.mode)) {
                FS.rmdir(path);
            } else if (FS.isFile(stat.mode)) {
                FS.unlink(path);
            }
        } catch (e) {
            return callback(e);
        }
        callback(null);
    },
    loadRemoteEntry: function(store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
        };
    },
    storeRemoteEntry: function(store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
        };
    },
    removeRemoteEntry: function(store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
        };
    },
    reconcile: function(src, dst, callback) {
        var total = 0;

        var create = [];
        Object.keys(src.entries).forEach(function (key) {
            var e = src.entries[key];
            var e2 = dst.entries[key];
            if (!e2 || e['timestamp'].getTime() != e2['timestamp'].getTime()) {
                create.push(key);
                total++;
            }
        });

        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
            var e = dst.entries[key];
            var e2 = src.entries[key];
            if (!e2) {
                remove.push(key);
                total++;
            }
        });

        if (!total) {
            return callback(null);
        }

        var errored = false;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

        function done(err) {
            if (err && !errored) {
                errored = true;
                return callback(err);
            }
        };

        transaction.onerror = function(e) {
            done(this.error);
            e.preventDefault();
        };

        transaction.oncomplete = function(e) {
            if (!errored) {
                callback(null);
            }
        };

        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
                if (dst.type === 'local') {
                    IDBFS.loadRemoteEntry(store, path, function (err, entry) {
                    if (err) return done(err);
                    IDBFS.storeLocalEntry(path, entry, done);
                });
            } else {
                IDBFS.loadLocalEntry(path, function (err, entry) {
                    if (err) return done(err);
                    IDBFS.storeRemoteEntry(store, path, entry, done);
                });
            }
        });

        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
            if (dst.type === 'local') {
                IDBFS.removeLocalEntry(path, done);
            } else {
                IDBFS.removeRemoteEntry(store, path, done);
            }
        });
    }
};

// localStorage file system taken from https://gist.github.com/makryl/96d87b23d7a7c3cc5bc1eee1021bb6ff
var LSFS = {
    wrapCreateNode: null,
    wrap_node_ops: null,
    wrap_stream_ops: null,
    props: ['name', 'mode', 'rdev', 'link', 'usedBytes', 'timestamp'],
    initWrap: function() {
        this.wrapCreateNode = this.wrapNode(MEMFS.createNode);
        this.wrap_node_ops = {
            setattr: this.wrapSave(MEMFS.node_ops.setattr),
            mknod: this.wrapNode(MEMFS.node_ops.mknod),
            rename: this.wrapSave(MEMFS.node_ops.rename),
            unlink: this.wrapSave(MEMFS.node_ops.unlink),
            rmdir: this.wrapSave(MEMFS.node_ops.rmdir),
            symlink: this.wrapNode(MEMFS.node_ops.symlink)
        };
        this.wrap_stream_ops = {
            write: this.wrapSave(MEMFS.stream_ops.write),
            msync: this.wrapSave(MEMFS.stream_ops.msync)
        };
    },
    getData: function(mount) {
        var data;
        try {
            data = localStorage.getItem(mount.opts.key);
        } catch (err) {}
        if (data) {
            try {
                data = JSON.parse(data);
            } catch (err) {}
        }
        return data;
    },
    mount: function(mount) {
        if (this.wrapCreateNode == null) {
            this.initWrap();
        }
        if (!mount.opts || !mount.opts.key) {
            return;
        }
        
        var data = this.getData(mount);
        
        var node = MEMFS.mount(mount);
        this.setupNode(node);
        this.load(node, mount, data);
        return node;
    },
    reload: function(node) {
        var mount = node.mount;
        if (!mount.opts || !mount.opts.key) {
            return;
        }
        var data = this.getData(mount);
        this.load(node, mount, data);
    },
    wrapNode: function(fn) {
        return function() {
            var node = fn.apply(null, arguments);
            LSFS.setupNode(node);
            return node;
        }
    },
    wrapSave: function(fn) {
        return function(node) {
            var res = fn.apply(null, arguments);
            LSFS.save(node);
            return res;
        }
    },
    setupNode: function(node) {
        var node_ops = {};
        for (var op in node.node_ops) {
            node_ops[op] = this.wrap_node_ops[op] || node.node_ops[op];
        }
        node.node_ops = node_ops;
        
        var stream_ops = {};
        for (var op in node.stream_ops) {
            stream_ops[op] = this.wrap_stream_ops[op] || node.stream_ops[op];
        }
        node.stream_ops = stream_ops;
    },
    filter: function(node) {
        var result = {};
        for (var key in node) {
            if (this.props.indexOf(key) !== -1) {
                result[key] = node[key];
            }
        }
        if (node.contents) {
            if (node.contents.length) {
                result.contents = Array.apply([], node.contents);
            } else {
                result.contents = {};
                for (var name in node.contents) {
                    result.contents[name] = this.filter(node.contents[name]);
                }
            }
        }
        return result;
    },
    save: function(node) {
        if (node.node) {
            node = node.node;
        }
        var mount = node.mount;
        if (!mount || !mount.opts || !mount.opts.key) {
            return;
        }
        try {
            console.log(JSON.stringify(this.filter(mount.root)));
            localStorage.setItem(mount.opts.key, JSON.stringify(this.filter(mount.root)));
        } catch (err) {}
    },
    load: function(node, mount, data) {
        node.mount = mount;
        if (!data) {
            return;
        }
        for (var key in data) {
            if (this.props.indexOf(key) !== -1) {
                node[key] = data[key];
            }
        }
        if (data.contents) {
            if (data.contents.length) {
                node.contents = data.contents;
            } else {
                node.contents = {};
                for (var name in data.contents) {
                    var childData = data.contents[name];
                    var childNode = this.wrapCreateNode(node, name, childData.mode, childData.rdev);
                    this.load(childNode, mount, childData);
                }
            }
        }
    },
};

/*var isPageFocused = true;
// IndexedDB doesn't automatically save. Add some syncing on browser state focus changes.
function updateEmscriptenFS() {
    FS.syncfs(function (err) {
        if (err) {
            console.log('updateEmscriptenFS error: ' + err);
        } else {
            console.log('updated emscripten indexedDB');
        }
    });
}
window.onblur = function() {
    isPageFocused = false;
    updateEmscriptenFS();
};
window.onfocus = function() {
    isPageFocused = true;
    updateEmscriptenFS();
};
window.onbeforeunload = function() {
    updateEmscriptenFS();
};
setInterval(function() {
    // Save every 30 seconds as well to be safe...
    if (isPageFocused) {
        updateEmscriptenFS();
    }
}, 30000);*/

/*// We also want a lazy loader which loads from urls. FS.createLazyFile doesn't quite hit the mark, so roll our own which piggybacks off MEMFS.
// Also see https://github.com/emscripten-core/emscripten/issues/9372#issuecomment-900118108 / https://github.com/gzuidhof/starboard-python/blob/88327bb56f7e2f673cf1ea4c5ff1e0a68c50e288/src/worker/emscripten-fs.ts
// NOTE: This API is soon to be dead https://github.com/emscripten-core/emscripten/issues/15041
// NOTE: S_IFDIR/S_IFREG seem off from stat.h but these are the values in https://github.com/emscripten-core/emscripten/blob/main/tests/reference_struct_info.json
// TODO: Use more appropriate error codes
// TODO: Provide some additional support for this. Hook into async .NET file API? Currently this should work, but sync calls will throw exception on first invoke.
const FS_S_IFDIR = 16384;
const FS_S_IFREG = 32768;
const FS_PERMISSIONS_READ_ONLY = 292;// Read only access (0444)
const FS_DIR_MODE = FS_S_IFDIR | FS_PERMISSIONS_READ_ONLY
const FS_FILE_MODE = FS_S_IFREG | FS_PERMISSIONS_READ_ONLY;
const FS_ENOENT = 44;
const FS_ENOTSUP = 138;
function LAZYFS_loadFile(node, callback) {
    if (node.fileInfo) {
        if (!node.contents && !node.contentHasFetched) {
            node.contentHasFetched = true;
            node.mount.root.dirInfo.pendingReads.add(node.fileInfo.path);
            var url = node.mount.root.dirInfo.mountPointUrl + node.fileInfo.path;
            fetch(url).then(async (response) => {
                if (response.ok) {
                    node.contents = new Uint8Array(await response.arrayBuffer());
                    node.usedBytes = node.contents.length;
                } else {
                    console.error('LAZYFS failed to fetch "' + url + '"');
                }
                node.contentIsLoaded = true;
                node.mount.root.dirInfo.pendingReads.delete(node.fileInfo.path);
                if (callback) {
                    if (node.contents) {
                        callback({ok:true,data:node.contents});
                    } else {
                        callback({ok:false,data:null});
                    }
                }
            });
        } else if (callback) {
            if (node.contents) {
                callback({ok:true,data:node.contents});
            } else {
                var err = 'TODO: Add event to subscribe to when pendingReads changes (or an event on the node itself)';
                console.error(err);
                throw err;
            }
        }
    } else {
        console.log('Invalid LAZYFS file access, "' + FS.getPath(node) + '" is missing file info');
        throw new FS.ErrnoError(FS_ENOTSUP, node);
    }
};
function LAZYFS_loadFileFromPath(path, callback) {
    try {
        var lookup = FS.lookupPath(path);
        if (lookup && lookup.node) {
            LAZYFS_loadFile(lookup.node, callback);
        } else {
            callback({ok:false,data:null});
        }
    } catch {
        callback({ok:false,data:null});
    }
};
var LAZYFS = {
    mount: function(mount) {
        return LAZYFS.createNode(null, '/', FS_DIR_MODE, mount);
    },
    createNode: function(parent, name, mode, mount) {
        function invalidLazyFsNodeOp(name, node) {
            console.error('Invalid LAZYFS node_ops call "' + name + '"');
            throw new FS.ErrnoError(FS_ENOTSUP, node);
        };
        function invalidLazyFsStreamOp(name, node) {
            console.error('Invalid LAZYFS stream_ops call "' + name + '"');
            throw new FS.ErrnoError(FS_ENOTSUP, node);
        };
        
        //////////////////////
        // createNode
        //////////////////////
        var node = MEMFS.createNode(parent, name, mode, 0);
        if (mount) {
            if (!mount.opts.dirInfo) {
                console.error('LAZYFS missing root dirInfo for finding files');
                throw new FS.ErrnoError(FS_ENOTSUP, node);
            }
            node.dirInfo = mount.opts.dirInfo;
            node.dirInfo.lazyFsNode = node;
        } else {
            if (!parent || !parent.dirInfo) {
                console.error('LAZYFS missing parent dirInfo for finding files');
                throw new FS.ErrnoError(FS_ENOTSUP, node);
            }
            var dir = parent.dirInfo.dirs[name];
            if (dir) {
                node.dirInfo = dir;
                node.dirInfo.lazyFsNode = node;
            } else {
                var file = parent.dirInfo.files[name];
                if (file) {
                    node.fileInfo = file;
                    node.fileInfo.lazyFsNode = node;
                } else {
                    console.error('LAZYFS missing entry "' + name + '" in "' + FS.getPath(parent) + '"');
                    throw new FS.ErrnoError(FS_ENOTSUP, node);
                }
            }
        }
        
        //////////////////////
        // node_ops
        //////////////////////
        var orig_getattr = node.node_ops.getattr;
        var orig_setattr = node.node_ops.setattr;
        var orig_mknod = node.node_ops.mknod;
        node.node_ops.getattr = function(node) {
            var result = orig_getattr.apply(this, arguments);
            if (node.fileInfo) {
                result.size = node.fileInfo.size;
            }
            return result;
        };
        node.node_ops.setattr = function(node, attr) {
            if (attr.mode || attr.size) {
                invalidLazyFsNodeOp('setattr', node);
            } else {
                orig_setattr.apply(this, arguments);
            }
        };
        node.node_ops.lookup = function(parent, name) {
            if (parent.dirInfo) {
                var dir = parent.dirInfo.dirs[name];
                if (dir) {
                    if (!dir.lazyFsNode) {
                        LAZYFS.createNode(parent, name, FS_DIR_MODE, 0);
                        if (!dir.lazyFsNode) {
                            console.error('LAZYFS.createNode failed in lookup (dir)');
                            throw new FS.ErrnoError(FS_ENOENT, parent);
                        }
                    }
                    return dir.lazyFsNode;
                } else {
                    var file = parent.dirInfo.files[name];
                    if (file) {
                        if (!file.lazyFsNode) {
                            LAZYFS.createNode(parent, name, FS_FILE_MODE, 0);
                            if (!file.lazyFsNode) {
                                console.error('LAZYFS.createNode failed in lookup (file)');
                                throw new FS.ErrnoError(FS_ENOENT, parent);
                            }
                        }
                        return file.lazyFsNode;
                    }
                }
            }
            console.error('LAZYFS failed to find "' + FS.getPath(parent) + '/' + name + '"');
            throw new FS.ErrnoError(FS_ENOENT, parent);
        };
        node.node_ops.mknod = function(parent, name, mode, dev) {
            invalidLazyFsNodeOp('mknod', old_node);
        };
        node.node_ops.rename = function(old_node, new_dir, new_name) {
            invalidLazyFsNodeOp('rename', old_node);
        };
        node.node_ops.unlink = function(parent, name) {
            invalidLazyFsNodeOp('unlink', parent);
        };
        node.node_ops.rmdir = function(parent, name) {
            invalidLazyFsNodeOp('rmdir', parent);
        };
        node.node_ops.readdir = function(node) {
            if (!FS.isDir(node)) {
                console.error('LAZYFS invalid readdir call on non-directory node');
                throw new FS.ErrnoError(FS_ENOTSUP, parent);
            }
            var entries = ['.', '..'];
            if (node.dirInfo) {
                for (var key of Object.keys(node.dirInfo.dirs)) {
                    entries.push(key);
                }
                for (var key of Object.keys(node.dirInfo.files)) {
                    entries.push(key);
                }
            }
            return entries;
        };
        node.node_ops.symlink = function(parent, newname, oldpath) {
            invalidLazyFsNodeOp('symlink', parent);
        };
        node.node_ops.readlink = function(node) {
            invalidLazyFsNodeOp('readlink', parent);
        };
        
        //////////////////////
        // stream_ops
        //////////////////////
        var orig_read = node.stream_ops.read;
        var orig_llseek = node.stream_ops.llseek;
        node.stream_ops.read = function(stream, buffer, offset, length, position) {
            LAZYFS_loadFile(stream.node);
            if (!stream.node.contentIsLoaded) {
                throw 'LAZYFS - fetching, wait a little longer (read - "' + FS.getPath(stream.node) + '")';
            }
            return orig_read.apply(this, arguments);
        };
        node.stream_ops.write = function(stream, buffer, offset, length, position, canOwn) {
            invalidLazyFsStreamOp('write', stream.node);
        };
        node.stream_ops.llseek = function(stream, offset, whence) {
            LAZYFS_loadFile(stream.node);
            if (!stream.node.contentIsLoaded) {
                throw 'LAZYFS - fetching, wait a little longer (llseek - "' + FS.getPath(stream.node) + '")';
            }
            return orig_llseek.apply(this, arguments);
        };
        node.stream_ops.mmap = function(stream, address, length, position, prot, flags) {
            invalidLazyFsStreamOp('mmap', stream.node);
        };
        node.stream_ops.msync = function(stream, buffer, offset, length, mmapFlags) {
            invalidLazyFsStreamOp('msync', stream.node);
        };
        
        return node;
    }
};*/