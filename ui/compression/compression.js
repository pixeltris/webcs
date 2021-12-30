// This is for the optional compression algorithms which are loaded dynamically (JSZip is not included here it's a dependency)

// TODO: Maybe refactor this compression code with a base class "CompressionLib" which all these inherit from
const CompressionType_None = 0;
const CompressionType_Brotli = 1;
const CompressionType_GZip = 2;
const CompressionLibLoadingState_Loading = 1;
const CompressionLibLoadingState_Loaded = 2;
const CompressionLibLoadingState_Failed = 3;
const CompressionUrlBase = 'ui/compression/';
var libsForCompress = new Map();
var libsForDecompress = new Map();

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
            break;
    }
    return true;
}

function getLibForDecompress(compressionType, callback) {
    return getLibForCompression(compressionType, true, callback);
}

function getLibForCompress(compressionType, callback) {
    return getLibForCompression(compressionType, false, callback);
}