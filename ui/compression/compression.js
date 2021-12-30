// This is for the optional compression algorithms which are loaded dynamically (JSZip is not included here it's a dependency)

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!
// This code needs refactoring. It's a mess, but works. It's fine for the time being.
// Really the main thread (de)compress code should be removed in favor for a (de)compress worker solution.
// Currently there is a code path for worker decompress and a code path for main thread (de)compress.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!

const CompressionType_None = 0;
const CompressionType_Brotli = 1;
const CompressionType_GZip = 2;
const CompressionLibLoadingState_Loading = 1;
const CompressionLibLoadingState_Loaded = 2;
const CompressionLibLoadingState_Failed = 3;
const CompressionUrlBase = 'ui/compression/';
var libsForCompress = new Map();
var libsForDecompress = new Map();

//////////////////////////////////
// Workers (decompress)
//////////////////////////////////

// TODO: Support multiple workers per lib and distribute work load between them?
var compressionWorkerInfos = new Map();
var compressionWorkerRequestNextId = 1;

function compressionCreateWorker(workerInfo) {
    // TODO: Maybe just point to this file (compression.js) and detect if worker scope on load (to avoid duplicate vars below)
    var code = `
        const CompressionUrlBase = '${window.location.origin}${window.location.pathname}${CompressionUrlBase}';
        const CompressionType_None = ${CompressionType_None};
        const CompressionType_Brotli = ${CompressionType_Brotli};
        const CompressionType_GZip = ${CompressionType_GZip};
        
        compressionType = ${workerInfo.type};
        compressionInstance = null;
        self.addEventListener('message', (e) => {
            if (e.data.key) {
                switch (e.data.key) {
                    case 'cwkrLoadLib':
                        switch (compressionType) {
                            case CompressionType_Brotli:
                                importScripts(CompressionUrlBase + 'brotli-decode.min.js');
                                compressionInstance = {decode:BrotliDecode};
                                break;
                            case CompressionType_GZip:
                                importScripts(CompressionUrlBase + 'fflate.min.js');
                                compressionInstance = fflate;
                                break;
                            default:
                                console.error('Unhandled compression type ' + compressionType + ' in ' + e.data.key);
                                return;
                        }
                        postMessage({key:'cwkrLoadLibResponse'});
                        break;
                    case 'cwkrDecompress':
                        if (e.data.buffer && e.data.id) {
                            var responseBuffer = null;
                            switch (compressionType) {
                                case CompressionType_Brotli:
                                    responseBuffer = compressionInstance.decode(e.data.buffer);
                                    break;
                                CompressionType_GZip:
                                    responseBuffer = compressionInstance.decompressSync(e.data.buffer);
                                    break;
                                default:
                                    postMessage({key:'cwkrDecompressResponse',id:e.data.id,err:'Unhandled compression type ' + compressionType});
                                    break;
                            }
                            if (responseBuffer) {
                                postMessage({key:'cwkrDecompressResponse',id:e.data.id,err:null,buffer:responseBuffer});
                            } else {
                                postMessage({key:'cwkrDecompressResponse',id:e.data.id,err:'Invalid response buffer'});
                            }
                        }
                        break;
                }
            }
        });
    `;
    var blob = new Blob([code], {type: 'application/javascript'});
    var worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function(e) {
        if (e.data.key) {
            switch (e.data.key) {
                case 'cwkrLoadLibResponse':
                    if (workerInfo.loadingState == CompressionLibLoadingState_Loading) {
                        workerInfo.loadingState = CompressionLibLoadingState_Loaded;
                        var callbacks = workerInfo.loadCallbacks.slice(0);
                        workerInfo.loadCallbacks.length = 0;
                        for (var i = 0; i < callbacks.length; i++) {
                            callbacks[i]();
                        }
                    }
                    break;
                case 'cwkrDecompressResponse':
                    if (e.data.id) {
                        var callback = workerInfo.requests.get(e.data.id);
                        if (callback) {
                            workerInfo.requests.delete(e.data.id);
                            callback(e.data.err, e.data.buffer);
                        }
                    }
                    break;
            }
        }
    };
    workerInfo.worker = worker;
    worker.postMessage({key:'cwkrLoadLib'});
}

function compressionWorkerDecompress(compressionType, buffer, callback) {
    var workerInfo = compressionWorkerInfos.get(compressionType);
    if (workerInfo) {
        var id = compressionWorkerRequestNextId++;
        if (compressionWorkerRequestNextId == Number.MAX_SAFE_INTEGER) {
            compressionWorkerRequestNextId = 1;
        }
        workerInfo.requests.set(id, callback);
        workerInfo.worker.postMessage({key:'cwkrDecompress',buffer:buffer,id:id});
    } else {
        callback('Failed to find worker', null);
    }
}

function compressionWorkerLoad(compressionType, callback) {
    var workerInfo = compressionWorkerInfos.get(compressionType);
    if (!workerInfo) {
        workerInfo = {
            loadingState: CompressionLibLoadingState_Loading,
            loadCallbacks: [],
            type: compressionType,
            requests: new Map()
        };
        workerInfo.loadCallbacks.push(callback);
        compressionWorkerInfos.set(compressionType, workerInfo);
        compressionCreateWorker(workerInfo);
    } else {
        switch (workerInfo.loadingState) {
            case CompressionLibLoadingState_Loading:
                workerInfo.loadCallbacks.push(callback);
                break;
            case CompressionLibLoadingState_Loaded:
                if (callback) {
                    callback();
                }
                break;
            case CompressionLibLoadingState_Failed:
                throw 'Failed to load worker compression lib for ' + compressionType;
            default:
                throw 'Bad worker compression lib state ' + compressionType;
        }
    }
}

//////////////////////////////////
// Main thread (de)compress
//////////////////////////////////

function getLibForCompressionFailed(compressionType, isDecompress, reason) {
    console.error('getLibForCompression failed. isDecompress:' + isDecompress + ' type:' + compressionType + ' reason:' + reason);
}

function getCompressionFileExtension(type) {
    switch (type) {
        case CompressionType_Brotli: return '.br';
        case CompressionType_GZip: return '.gz';
        default: '.unk';
    }
}

function getCompressionOriginalPath(path) {
    var info = getCompressionLibInfoFromPath(path);
    if (info.type != CompressionType_None) {
        return info.pathWithoutExtension;
    }
    return path;
}

function getCompressionLibInfoFromPath(path) {
    var result = {};
    result.type = CompressionType_None;
    result.pathWithoutExtension = null;
    result.nameWithoutExtension = null;
    var lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex >= 0) {
        var ext = path.substring(lastDotIndex + 1).trim();
        result.pathWithoutExtension = path.substring(0, lastDotIndex);
        var lastSlashIndex = result.pathWithoutExtension.lastIndexOf('/');
        if (lastSlashIndex >= 0) {
            result.nameWithoutExtension = result.pathWithoutExtension.substring(lastSlashIndex + 1);
        } else {
            result.nameWithoutExtension = result.pathWithoutExtension;
        }
        switch (ext.toLowerCase()) {
            case 'br':
                result.type = CompressionType_Brotli;
                break;
            case 'gz':
                result.type = CompressionType_GZip;
                break;
        }
    }
    return result;
}

function getLibForCompressionComplete(lib) {
    lib.instance.libType = lib.type;
    lib.loadingState = CompressionLibLoadingState_Loaded;
    var callbacks = lib.callbacks.slice(0);
    lib.callbacks.length = 0;
    for (var i = 0; i < callbacks.length; i++) {
        callbacks[i](lib.instance);
    }
}

function getLibForCompression(compressionType, isDecompress, callback) {
    switch (compressionType) {
        case CompressionType_Brotli:
        case CompressionType_GZip:
            break;
        default:
            getLibForCompressionFailed(compressionType, isDecompress, 'unsupported type');
            return false;
    }
    var targetLibMap = isDecompress ? libsForDecompress : libsForCompress;
    var lib = targetLibMap.get(compressionType);
    if (lib) {
        switch (lib.loadingState) {
            case CompressionLibLoadingState_Loading:
                if (callback) {
                    lib.callbacks.push(callback);
                }
                return true;
            case CompressionLibLoadingState_Loaded:
                if (callback) {
                    callback(lib.instance);
                }
                return true;
            case CompressionLibLoadingState_Failed:
                return false;
            default:
                getLibForCompressionFailed(compressionType, isDecompress, 'bad state');
                return false;
        }
    }
    lib = {
        loadingState: CompressionLibLoadingState_Loading,
        callbacks: [],
        type: compressionType
    };
    if (callback) {
        lib.callbacks.push(callback);
    }
    targetLibMap.set(compressionType, lib);
    switch (compressionType) {
        case CompressionType_Brotli:
            if (isDecompress) {
                require([CompressionUrlBase + 'brotli-decode.min.js'], (r) => {
                    lib.instance = {};
                    lib.instance.decode = BrotliDecode;
                    getLibForCompressionComplete(lib);
                });
            } else {
                require([CompressionUrlBase + 'brotli.js'], () => {
                    lib.instance = new Brotli();
                    getLibForCompressionComplete(lib);
                });
            }
            break;
        case CompressionType_GZip:
            require([CompressionUrlBase + 'fflate.min.js'], (instance) => {
                lib.instance = instance;
                getLibForCompressionComplete(lib);
            });
            break;
        default:
            throw 'Invalid code path';
    }
    return true;
}

function getLibForDecompress(compressionType, callback) {
    return getLibForCompression(compressionType, true, callback);
}

function getLibForCompress(compressionType, callback) {
    return getLibForCompression(compressionType, false, callback);
}