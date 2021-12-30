// https://github.com/trybash/bash-emulator (MIT)
// https://github.com/plasma-umass/browsix/tree/master/src/bin (MIT)

// FIXME: There are issues with root / mounted paths on calls to FS.lookupPath. These need to be fixed (FS.isMountpoint() / FS.isRoot() checks depending on usage (mostly mount point folder name issues))

function bytesToSize(bytes, decimals = 2) {
    // https://stackoverflow.com/a/18650828
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    if (bytes === 0) return '0' + sizes[0];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}

class TerminalCommand {
    constructor() {
        this.disabled = false;
        this.hidden = false;
        this.process = null;
    }
    getArgKeyValue(arg) {
        while (arg.startsWith('-')) {
            arg = arg.substring(1);
        }
        var argKey = arg;
        var argValue = null;
        var colonIndex = arg.indexOf(':');
        if (colonIndex > 0) {
            argKey = arg.substring(0, colonIndex);
            argValue = arg.substring(colonIndex + 1);
        }
        argKey = argKey.toLowerCase();
        return [argKey, argValue];
    }
}

class TerminalCommand_cd extends TerminalCommand {
    constructor() {
        super();
        this.name = 'cd';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var success = false;
            var path = null;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                } else {
                    path = arg;
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Change working directory [PATH]');
            } else {
                try {
                    var pathInfo = FS.lookupPath(this.process.controller.getFullPath(path));
                    if (pathInfo.node.isFolder) {
                        success = true;
                        var path = pathInfo.path;
                        if (!path.endsWith('/')) {
                            path += '/';
                        }
                        this.process.controller.workingDirectory = path;
                    }
                } catch {}
                if (!success && path) {
                    this.process.controller.term.writeln('cd: ' + path + ': No such file or directory');
                }
            }
        }
        this.process.exit();
    }
}

// TODO: Add support for listing multiple target paths in one command
class TerminalCommand_ls extends TerminalCommand {
    constructor() {
        super();
        this.name = 'ls';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var showHidden = false;
            var showLongFormat = false;
            var targetDir = null;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'a':
                            showHidden = true;
                            break;
                        case 'l':
                            break;
                        case 'al':
                        case 'all':
                        case 'la':
                        case 'lla':
                            showHidden = true;
                            showLongFormat = true;
                            break;
                    }
                } else if (targetDir == null) {
                    targetDir = arg;
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('List directory contents [PATH]');
                this.process.controller.term.writeln('-l    Long format');
                this.process.controller.term.writeln('-a    Show hidden entries (.)');
            } else {
                if (targetDir == null) {
                    targetDir = this.process.controller.workingDirectory;
                } else {
                    targetDir = this.process.controller.getFullPath(targetDir);
                }
                var foundTargetDir = true;
                var dirItems = [];
                var fileItems = [];
                try {
                    var pathInfo = FS.lookupPath(targetDir);
                    if (pathInfo.node.isFolder) {
                        var itemNames = pathInfo.node.node_ops.readdir(pathInfo.node);
                        for (var i = 0; i < itemNames.length; i++) {
                            var name = itemNames[i];
                            if (!showHidden && name.startsWith('.')) {
                                continue;
                            }
                            try {
                                // NOTE: "." / ".." are being culled as FS.lookupNode fails on them
                                var itemNode = FS.lookupNode(pathInfo.node, name);
                                var date = itemNode.node_ops.getattr(itemNode).mtime;
                                var timestamp = date.toDateString().slice(4, 10) + ' ' + date.toTimeString().slice(0, 5);
                                var itemTypeStr = itemNode.isFolder ? 'dir ' : 'file';
                                var infoStr = (itemNode.isFolder ? '\x1B[34m' + name + '\x1B[0m' : name);
                                if (showLongFormat) {
                                    infoStr = itemTypeStr + '  ' + timestamp + '  ' + infoStr;
                                }
                                if (itemNode.isFolder) {
                                    dirItems.push(infoStr);
                                } else {
                                    fileItems.push(infoStr);
                                }
                            } catch{}
                        }
                    } else {
                        this.process.controller.term.writeln('ls: ' + targetDir + ': Is a file');
                    }
                } catch {
                    foundTargetDir = false;
                }
                if (!foundTargetDir) {
                    this.process.controller.term.writeln('ls: ' + targetDir + ': No such file or directory');
                } else {
                    var allItems = dirItems.concat(fileItems);
                    if (allItems.length > 0) {
                        if (showLongFormat) {
                            for (var i = 0; i < allItems.length; i++) {
                                this.process.controller.term.writeln(allItems[i]);
                            }
                        } else {
                            this.process.controller.term.writeln(allItems.join('  '));
                            //this.process.controller.printWide(allItems);
                        }
                    }
                }
            }
        }
        this.process.exit();
    }
}

function fs_doesParentExist(path) {
    if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
    }
    var indx = path.lastIndexOf('/');
    if (path.length == 0 || indx == 0) {
        // Root is valid for what we care for in our use cases
        return true;
    } else if (indx > 0) {
        path = path.substring(0, indx);
        try {
            return FS.lookupPath(path).node.isFolder;
        } catch {}
    }
    return false;
}

class TerminalCommand_cp extends TerminalCommand {
    constructor() {
        super();
        this.name = 'cp';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var recursiveCopy = false;
            var paths = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'r':
                            recursiveCopy = true;
                            break;
                    }
                } else {
                    paths.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Copy [SOURCE(s)] to [DEST]');
                this.process.controller.term.writeln('-r    Recursive copy');
            } else if (paths.length < 2) {
                this.process.controller.term.writeln('cp: Expected at least two paths got ' + paths.length);
            } else {
                var srcPaths = [];
                var srcPathsFull = [];
                var dstPath = paths[paths.length - 1];
                var dstPathFull = this.process.controller.getFullPath(dstPath);
                for (var i = 0; i < paths.length - 1; i++) {
                    srcPaths.push(paths[i]);
                    srcPathsFull.push(this.process.controller.getFullPath(paths[i]));
                }
                var dstDirNode = null;
                var isDstValid = false;
                var isDstFolder = false;
                if (srcPathsFull.length > 1) {
                    isDstFolder = true;
                } else {
                    try {
                        isDstFolder = FS.lookupPath(srcPathsFull[0]).node.isFolder;
                    } catch {}
                    if (!isDstFolder) {
                        try {
                            isDstFolder = FS.lookupPath(dstPathFull).node.isFolder;
                        } catch {}
                    }
                }
                try {
                    isDstValid = FS.lookupPath(dstPathFull).node.isFolder;
                } catch {}
                if (!isDstValid) {
                    isDstValid = fs_doesParentExist(dstPathFull);
                }
                if (!isDstValid) {
                    this.process.controller.term.writeln('cp: Invalid dest ' + dstPath);
                }
                if (isDstValid && isDstFolder) {
                    if (!dstPathFull.endsWith('/')) {
                        dstPathFull += '/';
                    }
                    try {
                        FS.mkdirTree(dstPathFull);
                        var dstNode = FS.lookupPath(dstPathFull).node;
                        for (var i = 0; i < srcPathsFull.length; i++) {
                            try {
                                var node = FS.lookupPath(srcPathsFull[i]).node;
                                if (node.isFolder) {
                                    if (recursiveCopy) {
                                        var tempNode = dstNode;
                                        while (tempNode != null) {
                                            if (node == tempNode) {
                                                this.process.controller.term.writeln('cp: recursion detected, omitting directory ' + srcPaths[i]);
                                                break;
                                            }
                                            if (tempNode == tempNode.parent) {
                                                tempNode = null;
                                                break;
                                            }
                                            tempNode = tempNode.parent;
                                        }
                                        if (tempNode == null) {
                                            this.cptree(node, dstPathFull);
                                        }
                                    } else {
                                        this.process.controller.term.writeln('cp: omitting directory ' + srcPaths[i]);
                                    }
                                } else {
                                    // TODO: Some sort of logging if something fails here
                                    FS.writeFile(dstPathFull + node.name, FS.readFile(FS.getPath(node)));
                                }
                            } catch {}
                        }
                    } catch (err) {
                        console.error(err);
                        this.process.controller.term.writeln('cp: Failed to make destination folder ' + dstPath);
                    }
                } else {
                    for (var i = 0; i < srcPathsFull.length; i++) {
                        try {
                            var node = FS.lookupPath(srcPathsFull[i]).node
                            if (node.isFolder) {
                                this.process.controller.term.writeln('cp: target ' + dstPath + ' is not a directory');
                            } else {
                                // TODO: Some sort of logging if something here fails
                                FS.writeFile(dstPathFull, FS.readFile(FS.getPath(node)));
                            }
                        } catch {}
                    }
                }
            }
        }
        this.process.exit();
    }
    cptree(node, dstPathFull) {
        if (!dstPathFull.endsWith('/')) {
            dstPathFull += '/';
        }
        if (node.isFolder) {
            for (var key of Object.keys(node.contents)) {
                var childNode = node.contents[key];
                if (childNode.isFolder) {
                    var subPath = dstPathFull + key;
                    try {
                        FS.mkdirTree(subPath);
                    } catch (err) {
                        console.error(err);
                        // TODO: Log to terminal?
                        continue;
                    }
                    this.cptree(childNode, subPath);
                } else {
                    try {
                        // TODO: Some sort of logging if something here fails
                        FS.writeFile(dstPathFull + key, FS.readFile(FS.getPath(childNode)));
                    } catch {}
                }
            }
        }
    }
}

// NOTE: This mv implementation is non-standed. You can "mv srcdir1 srcdir2 srcdir3 dstdir4"
class TerminalCommand_mv extends TerminalCommand {
    constructor() {
        super();
        this.name = 'mv';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var overwriteFiles = false;// TODO: Actually do the overwrite files check...
            var paths = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'n':
                            overwriteFiles = true;
                            break;
                    }
                } else {
                    paths.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Move [SOURCE(s)] to [DEST]');
            } else if (paths.length < 2) {
                this.process.controller.term.writeln('mv: Expected at least two paths got ' + paths.length);
            } else {
                var srcPaths = [];
                var srcPathsFull = [];
                var dstPath = paths[paths.length - 1];
                var dstPathFull = this.process.controller.getFullPath(dstPath);
                var isDstDir = paths.length > 2;
                for (var i = 0; i < paths.length - 1; i++) {
                    var path = paths[i];
                    var fullPath = this.process.controller.getFullPath(path);
                    var ignore = false;
                    if (path.endsWith('/*')) {
                        try {
                            FS.lookupPath(fullPath);
                        } catch {
                            // This is not a file / folder called '*', expand the path
                            path = path.substring(0, path.length - 1);
                            ignore = true;
                            isDstDir = true;
                            try {
                                var node = FS.lookupPath(fullPath.substring(0, fullPath.lastIndexOf('/'))).node;
                                if (node.isFolder) {
                                    for (var key of Object.keys(node.contents)) {
                                        try {
                                            var childPath = path + key;
                                            var childPathFull = FS.getPath(node.contents[key]);
                                            srcPaths.push(childPath);
                                            srcPathsFull.push(childPathFull);
                                        } catch {}
                                    }
                                }
                            } catch {}
                        }
                    }
                    if (!ignore) {
                        srcPaths.push(paths[i]);
                        srcPathsFull.push(fullPath);
                        if (!isDstDir) {
                            try {
                                if (FS.lookupPath(fullPath).node.isFolder) {
                                    isDstDir = true;
                                }
                            } catch {}
                        }
                    }
                }
                if (!isDstDir) {
                    try {
                        if (FS.lookupPath(dstPathFull).node.isFolder) {
                            isDstDir = true;
                        }
                    } catch {}
                }
                if (isDstDir && !dstPathFull.endsWith('/')) {
                    dstPathFull += '/';
                }
                var isValidDir = false;
                var isNewDir = false;
                if (!fs_doesParentExist(dstPathFull)) {
                    this.process.controller.term.writeln('mv: Invalid dest ' + dstPath);
                } else if (isDstDir) {
                    isNewDir = true;
                    try {
                        var node = FS.lookupPath(dstPathFull).node;
                        if (node != null) {
                            isNewDir = false;
                            isValidDir = node.isFolder;
                            if (!isValidDir) {
                                this.process.controller.term.writeln('mv: dest not a directory');
                            }
                        }
                    } catch {}
                    if (isNewDir) {
                        try {
                            FS.mkdirTree(dstPathFull);
                            isValidDir = true;
                        } catch (err) {
                            this.process.controller.term.writeln('mv: mkdir dest failed ' + dstPath);
                        }
                    }
                } else {
                    isValidDir = true;
                }
                if (isValidDir) {
                    for (var i = 0; i < srcPathsFull.length; i++) {
                        var node = null;
                        try {
                            node = FS.lookupPath(srcPathsFull[i]).node;
                        } catch {
                            this.process.controller.term.writeln('mv: ' + srcPaths[i] + ': No such file or directory');
                            continue;
                        }
                        try {
                            if (node.isFolder && !isDstDir) {
                                this.process.controller.term.writeln('mv: ' + srcPaths[i] + ': Not a directory');
                            } else if (!isDstDir || (isNewDir && srcPaths.length == 1)) {
                                FS.rename(srcPathsFull[i], dstPathFull);
                            } else {
                                FS.rename(srcPathsFull[i], dstPathFull + node.name);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    }
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_touch extends TerminalCommand {
    constructor() {
        super();
        this.name = 'touch';
    }
    warnCannotTouchDirectory(path) {
        this.process.controller.term.writeln('touch: ' + path + ': Touch directory not supported');
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var dontCreateFile = false;
            var files = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'c':
                            dontCreateFile = true;
                            break;
                    }
                } else {
                    files.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Update modify date [PATH(s)]');
                this.process.controller.term.writeln('-c    Do not create files');
            } else {
                for (var i = 0; i < files.length; i++) {
                    var fileName = files[i];
                    var lastSlashIndex = fileName.lastIndexOf('/');
                    var targetDir = this.process.controller.workingDirectory;
                    if (lastSlashIndex >= 0) {
                        var dir = fileName.substring(0, lastSlashIndex + 1);
                        dir = this.process.controller.getFullPath(dir);
                        try {
                            var pathInfo = FS.lookupPath(dir);
                            if (!pathInfo.node.isFolder) {
                                this.process.controller.term.writeln('touch: ' + fileName + ': Not a directory');
                                continue;
                            }
                            targetDir = dir;
                            fileName = fileName.substring(lastSlashIndex + 1);
                            if (fileName.length == 0) {
                                this.warnCannotTouchDirectory(fileName);
                                continue;
                            }
                        } catch {
                            this.process.controller.term.writeln('touch: ' + fileName + ': No such file or directory');
                            continue;
                        }
                    }
                    var path = targetDir + fileName;
                    if (dontCreateFile) {
                        try {
                            var pathInfo = FS.lookupPath(path);
                            if (pathInfo.node.isFolder) {
                                this.warnCannotTouchDirectory(fileName);
                            } else {
                                pathInfo.node.timestamp = Date.now();
                            }
                        } catch {}
                    } else {
                        try {
                            var pathInfo = FS.lookupPath(path);
                            if (pathInfo.node.isFolder) {
                                this.warnCannotTouchDirectory(fileName);
                                continue;
                            }
                        } catch {}
                        try {
                            FS.writeFile(path, '');
                        } catch (err) {
                            this.process.controller.term.writeln('touch: ' + fileName + ': failed (see console)');
                            console.error(err);
                        }
                    }
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_mkdir extends TerminalCommand {
    constructor() {
        super();
        this.name = 'mkdir';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var makeParentDirs = false;
            var dirs = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'p':
                            makeParentDirs = true;
                            break;
                    }
                } else {
                    dirs.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Create directory [PATH(s)]');
                this.process.controller.term.writeln('-p    Make parent directories as needed');
            } else {
                var rootNode = null;
                try {
                    rootNode = FS.lookupPath('/').node;
                } catch {
                    this.process.controller.term.writeln('mkdir: failed finding root path /');
                }
                if (rootNode != null) {
                    for (var i = 0; i < dirs.length; i++) {
                        var dir = dirs[i];
                        var fullPath = this.process.controller.getFullPath(dir);
                        if (fullPath.includes('../')) {
                            this.process.controller.term.writeln('mkdir: ' + dir + ': relative paths (../) not currently supported');
                        } else {
                            try {
                                if (makeParentDirs) {
                                    FS.mkdirTree(fullPath);
                                } else {
                                    var node = rootNode;
                                    var splitted = fullPath.split('/').filter(x => x);
                                    for (var j = 0; j < splitted.length; j++) {
                                        var el = splitted[j];
                                        var tempNode = node;
                                        try {
                                            node = FS.lookupNode(node, el);
                                            if (node && FS.isMountpoint(node)) {
                                                node = node.mounted.root;
                                            }
                                        } catch {
                                            node = null;
                                        }
                                        if (node != null && !node.isFolder) {
                                            this.process.controller.term.writeln('mkdir: ' + dir + ': Not a directory');
                                            break;
                                        }
                                        if (j == splitted.length - 1) {
                                            if (node == null) {
                                                FS.mkdir(FS.getPath(tempNode) + '/' + el);
                                            } else {
                                                this.process.controller.term.writeln('mkdir: ' + dir + ': already exists');
                                            }
                                        } else if (node == null) {
                                            this.process.controller.term.writeln('mkdir: ' + dir + ': No such file or directory');
                                            break;
                                        }
                                    }
                                }
                            } catch(err) {
                                console.error(err);
                                this.process.controller.term.writeln('mkdir: ' + dir + ': failed. See browser console log');
                            }
                        }
                    }
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_rmdir extends TerminalCommand {
    constructor() {
        super();
        this.name = 'rmdir';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var dirs = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                } else {
                    dirs.push(arg);
                }
            }
            if (showHelp || dirs.length == 0) {
                this.process.controller.term.writeln('Remove empty directory [PATH(s)]');
            } else {
                for (var i = 0; i < dirs.length; i++) {
                    var dir = dirs[i];
                    var fullPath = this.process.controller.getFullPath(dir);
                    try {
                        var node = FS.lookupPath(fullPath).node;
                        if (node.isFolder) {
                            // TODO: Check for mount points / special folders
                            if (Object.keys(node.contents).length == 0) {
                                try {
                                    FS.rmdir(fullPath);
                                } catch (err) {
                                    console.error(err);
                                    this.process.controller.term.writeln('rmdir: ' + dir + ': failed. See browser console log');
                                }
                            } else {
                                this.process.controller.term.writeln('rmdir: ' + dir + ': Directory not empty');
                            }
                        } else {
                            this.process.controller.term.writeln('rmdir: ' + dir + ': Not a directory');
                        }
                    } catch {
                        this.process.controller.term.writeln('rmdir: ' + dir + ': No such file or directory');
                    }
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_rm extends TerminalCommand {
    constructor() {
        super();
        this.name = 'rm';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var recursiveDelete = false;
            var paths = [];
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'r':
                        case 'rf':
                            recursiveDelete = true;
                            break;
                    }
                } else {
                    var fullPath = this.process.controller.getFullPath(arg);
                    if (fullPath.endsWith('/*')) {
                        try {
                            FS.lookupPath(fullPath);
                        } catch {
                            // This is not a file / folder called '*', expand the path
                            try {
                                var node = FS.lookupPath(fullPath.substring(0, fullPath.length - 1)).node;
                                if (node.isFolder) {
                                    for (var key of Object.keys(node.contents)) {
                                        try {
                                            var childPath = arg.substring(0, arg.length - 1) + key;
                                            paths.push(childPath);
                                        } catch {}
                                    }
                                }
                            } catch {}
                            continue;
                        }
                    }
                    paths.push(arg);
                }
            }
            if (showHelp || paths.length == 0) {
                this.process.controller.term.writeln('Remove / delete [PATH(s)]');
                this.process.controller.term.writeln('-r    Recursive delete');
            } else {
                for (var i = 0; i < paths.length; i++) {
                    var path = paths[i];
                    var fullPath = this.process.controller.getFullPath(path);
                    var node = null;
                    try {
                        node = FS.lookupPath(fullPath).node;
                    } catch {
                        this.process.controller.term.writeln('rm: ' + path + ': No such file or directory');
                    }
                    if (node != null) {
                        this.rmtree(path, node, recursiveDelete);
                    }
                }
            }
        }
        this.process.exit();
    }
    rmtree(path, node, recursiveDelete) {
        if (node.isFolder) {
            if (recursiveDelete) {
                for (var key of Object.keys(node.contents)) {
                    this.rmtree(path, node.contents[key], recursiveDelete);
                }
                if (Object.keys(node.contents).length == 0) {
                    try {
                        FS.rmdir(FS.getPath(node));
                    } catch (err) {
                        console.error(err);
                        this.process.controller.term.writeln('rm: ' + path + ': failed. See browser console log');
                    }
                } else {
                    this.process.controller.term.writeln('rm: ' + path + ': failed to clean folder ' + FS.getPath(node));
                }
            } else {
                this.process.controller.term.writeln('rm: ' + path + ': Is a directory');
            }
        } else {
            try {
                FS.unlink(FS.getPath(node));
            } catch (err) {
                if (!recursiveDelete) {
                    console.error(err);
                    this.process.controller.term.writeln('rm: ' + path + ': failed. See browser console log');
                }
            }
        }
    }
}

class TerminalCommand_pwd extends TerminalCommand {
    constructor() {
        super();
        this.name = 'pwd';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Print working directory');
            } else {
                this.process.controller.term.writeln(this.process.controller.workingDirectory);
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_exit extends TerminalCommand {
    constructor() {
        super();
        this.name = 'exit';
    }
    run(args) {
        if (this.process.controller != null && this.process.controller.widget != null) {
            var showHelp = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Close the terminal');
            } else {
                this.process.controller.widget.close();
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_clear extends TerminalCommand {
    constructor() {
        super();
        this.name = 'clear';
        this.nameAliases = ['cls'];
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Clear the screen (visible buffer)');
            } else {
                this.process.controller.scClearScreen();
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_reset extends TerminalCommand {
    constructor() {
        super();
        this.name = 'reset';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Reset the screen (clear entire buffer / reset state)');
            } else {
                this.process.controller.scReset();
                try {
                    if (WebcsInterop.isRuntimeInitialized) {
                        WebcsInterop.callStaticMethod('RestoreConsole');
                    }
                } catch {}
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_fsync extends TerminalCommand {
    constructor() {
        super();
        this.name = 'fsync';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var doLoad = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'l':
                        case 'load':
                            doLoad = true;
                            break;
                    }
                } else {
                    switch (arg) {
                        case 'l':
                        case 'load':
                            doLoad = true;
                            break;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Sync persistance storage (IndexedDB / localStorage)');
                this.process.controller.term.writeln('load    Load instead of save');
                this.process.exit();
            } else {
                if (doLoad) {
                    try {
                        var node = FS.lookupPath(WebcsInterop.localStorageMountPoint).node;
                        LSFS.reload(node);
                    } catch {
                        this.process.controller.term.writeln('fsync localStorage load failed');
                    }
                }
                FS.syncfs(doLoad, (err) => {
                    if (err) {
                        console.error(err);
                        this.process.controller.term.writeln('fsync failed. See browser console log');
                    } else {
                        this.process.controller.term.writeln('fsync complete (' + (doLoad ? 'loaded' : 'saved') + ')');
                    }
                    this.process.exit();
                });
            }
        } else {
            this.process.exit();
        }
    }
}

class TerminalCommand_termname extends TerminalCommand {
    constructor() {
        super();
        this.name = 'termname';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var name = '';
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                } else {
                    if (name) {
                        name += ' ' + arg;
                    } else {
                        name = arg;
                    }
                }
            }
            if (showHelp || !name) {
                this.process.controller.term.writeln('Set the terminal tab name [NAME]');
            }
            else {
                var widget = this.process.controller.term.uiWidget;
                if (widget != null) {
                    widget.title.text = name;
                } else {
                    this.process.controller.term.writeln('termname: Find widget failed');
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_termnew extends TerminalCommand {
    constructor() {
        super();
        this.name = 'termnew';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var name = '';
            var disableFocus = false;
            var useCurrentPath = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'f':
                            disableFocus = true;
                            break;
                        case 'p':
                            useCurrentPath = true;
                            break;
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                } else {
                    if (name) {
                        name += ' ' + arg;
                    } else {
                        name = arg;
                    }
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Create a new terminal [NAME]');
                this.process.controller.term.writeln('-f    Don\'t focus the terminal');
                this.process.controller.term.writeln('-p    Use current working directory');
            } else {
                if (!name) {
                    name = getDefaultTerminalName();
                }
                var widget = this.process.controller.term.uiWidget;
                if (widget != null) {
                    var newWidget = createContent(name, TabType_Terminal, {
                        path: useCurrentPath ? this.process.controller.workingDirectory : '/'
                    });
                    if (newWidget != null) {
                        dockInstance.insertTabAfter(newWidget, widget);
                        if (!disableFocus) {
                            focusWidget(newWidget);
                        }
                    } else {
                        this.process.controller.term.writeln('termnew: Create widget failed');
                    }
                } else {
                    this.process.controller.term.writeln('termnew: Find widget failed');
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_edit extends TerminalCommand {
    constructor() {
        super();
        this.name = 'edit';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var paths = [];
            var disableFocus = false;
            var createFileIfNotExists = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'f':
                            disableFocus = true;
                            break;
                        case 't':
                        case 'touch':
                            createFileIfNotExists = true;
                            break;
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                    }
                } else {
                    paths.push(arg);
                }
            }
            if (paths.length == 0) {
                showHelp = true;
            }
            if (showHelp) {
                this.process.controller.term.writeln('Open a text editor [PATH(s)]');
                this.process.controller.term.writeln('-f    Don\'t focus the new text editor');
                this.process.controller.term.writeln('-t    Create the file (if it doesn\'t exit)');
            } else {
                var lastWidget = null;
                for (var i = 0; i < paths.length; i++) {
                    var path = paths[i];
                    var fullPath = this.process.controller.getFullPath(path);
                    if (createFileIfNotExists) {
                        try {
                            FS.lookupPath(fullPath);
                        } catch {
                            try {
                                FS.writeFile(fullPath, '');
                            } catch {}
                        }
                    }
                    try {
                        var node = FS.lookupPath(fullPath).node;
                        if (node.isFolder) {
                            this.process.controller.term.writeln('edit: ' + path + ' Is a directory');
                        } else  {
                            var widget = this.process.controller.term.uiWidget;
                            if (widget != null) {
                                var realFullPath = FS.getPath(node);// Get accurate path
                                var newWidget = createContent(node.name, TabType_TextEditor, {
                                    description: realFullPath,
                                    filePath: realFullPath
                                });
                                if (newWidget != null) {
                                    lastWidget = newWidget;
                                    dockInstance.insertTabAfter(newWidget, widget);
                                } else {
                                    this.process.controller.term.writeln('edit: Create widget failed');
                                }
                            } else {
                                this.process.controller.term.writeln('edit: Find widget failed');
                            }
                        }
                    } catch {
                        this.process.controller.term.writeln('edit: ' + path + ': No such file or directory');
                    }
                }
                if (!disableFocus && lastWidget != null) {
                    focusWidget(lastWidget);
                }
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_theme extends TerminalCommand {
    constructor() {
        super();
        this.name = 'theme';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var listNames = false;
            var name = '';
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'l':
                            listNames = true;
                            break;
                    }
                } else {
                    if (name) {
                        name += ' ';
                    }
                    name += arg;
                }
            }
            if (!name && !listNames) {
                showHelp = true;
            }
            if (showHelp) {
                this.process.controller.term.writeln('Set the UI theme [NAME]');
                this.process.controller.term.writeln('-l    List theme names');
            } else if (listNames) {
                // TODO: Print multiple per line if we get too many themes
                for (var key of Object.keys(themeThemes)) {
                    this.process.controller.term.writeln(key);
                }
            } else if (themeThemes[name]) {
                setTheme(name);
            } else {
                this.process.controller.term.writeln('theme: ' + name + ' unknown theme name');
            }
        }
        this.process.exit();
    }
}

class TerminalCommand_dotnet extends TerminalCommand {
    constructor() {
        super();
        this.name = 'dotnet';
    }
    processArgsForBuild(cmd, args, i) {
        cmd.buildPath = null;
        for (; i < args.length; i++) {
            var arg = args[i];
            if (arg.startsWith('-')) {
            } else if (!cmd.buildPath) {
                cmd.buildPath = arg;
            }
        }
        if (!cmd.buildPath) {
            // Try to determine csproj file name based on current folder name...
            var path = this.process.controller.workingDirectory;
            while (path.endsWith('/')) {
                path = path.substring(0, path.length - 1);
            }
            var lastSlashIndex = path.lastIndexOf('/');
            if (lastSlashIndex >= 0) {
                path = path.substring(lastSlashIndex + 1).trim();
                if (path.length) {
                    cmd.buildPath = path + '.csproj';
                }
            }
        }
        if (cmd.buildPath) {
            cmd.buildPath = this.process.controller.getFullPath(cmd.buildPath);
        }
    }
    processArgsForCsc(cmd, args, i) {
        cmd.args = [];
        for (; i < args.length; i++) {
            cmd.args.push(args[i]);
        }
    }
    processArgsForNew(cmd, args, i) {
        cmd.newProjectName = null;
        for (; i < args.length; i++) {
            var arg = args[i];
            if (arg.startsWith('-')) {
            } else if (!cmd.newProjectName) {
                cmd.newProjectName = arg;
            }
        }
    }
    processArgsForSetComp(cmd, args, i) {
        cmd.compilerName = null;
        for (; i < args.length; i++) {
            var arg = args[i];
            if (arg.startsWith('-')) {
            } else if (!cmd.compilerName) {
                cmd.compilerName = arg;
            }
        }
    }
    processArgsForLoad(cmd, args, i) {
        for (; i < args.length; i++) {
            var arg = args[i];
            if (arg.startsWith('-')) {
                while (arg.startsWith('-')) {
                    arg = arg.substring(1);
                }
                arg = arg.toLowerCase();
                switch (arg) {
                    case 'i':
                    case 'idb':
                        cmd.loadToIndexedDb = true;
                        break;
                    case 'q':
                    case 'quiet':
                        cmd.loadQuiet = true;
                        break;
                }
            }
        }
    }
    isDotNetLoaded() {
        var result = true;
        for (var key of Object.keys(WebcsInterop.allFilesByName)) {
            var fileInfo = WebcsInterop.allFilesByName[key];
            if (fileInfo.behavior == WCS_FILE_BEHAVIOR_ASSEMBLY && !fileInfo.isLoaded) {
                result = false;
                break;
            }
        }
        return result;
    }
    printDotNetNotLoaded() {
        this.process.controller.term.writeln('Run `dotnet load`');
    }
    loadDotNet(fileInfosToLoad, loadQuiet) {
        if (fileInfosToLoad.length > 0 && !loadQuiet) {
            this.process.controller.term.writeln('Fetching...');
        }
        WebcsInterop.loadFiles(fileInfosToLoad, (response) => {
            if (WebcsInterop.fullLoaderUseSimpleProgressBar) {
                this.process.controller.term.writeln('');
            }
            // TODO: Ensure everything is loaded in response
            if (!loadQuiet) {
                this.process.controller.term.writeln('============');
                this.process.controller.term.writeln('Loading .NET runtime...');
            }
            try {
                WebcsInterop.initRuntime();
                if (!loadQuiet) {
                    this.process.controller.term.writeln('Done');
                    this.process.controller.term.writeln('============');
                }
            } catch (err) {
                this.process.controller.term.writeln('Failed. See browser console');
                console.error(err);
            }
            this.process.exit();
        }, (stepFileInfo) => {
            if (!loadQuiet) {
                if (WebcsInterop.fullLoaderUseSimpleProgressBar) {
                    this.process.controller.term.write('.');
                } else {
                    this.process.controller.term.writeln(stepFileInfo.path);
                }
            }
        });
    }
    run(args) {
        if (this.process.controller != null) {
            var cmd = {};
            cmd.showHelp = args.length == 0;
            cmd.printVersion = false;
            cmd.doLoad = false;
            var isCommandArg = true;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'h':
                        case 'help':
                            cmd.showHelp = true;
                            break;
                        case 'version':
                            cmd.printVersion = true;
                            break;
                    }
                } else if (isCommandArg) {
                    isCommandArg = false;
                    var splitted = arg.split('.').filter(x => x);
                    if (splitted.length > 1) {
                        switch (splitted[splitted.length - 1].toLowerCase()) {
                            case 'dll':
                            case 'exe':
                                cmd.runBinary = true;
                                cmd.binaryPath = this.process.controller.getFullPath(arg);
                                cmd.args = [];
                                for (i++; i < args.length; i++) {
                                    cmd.args.push(args[i]);
                                }
                                break;
                        }
                        if(cmd.runBinary) {
                            break;
                        }
                    }
                    if (!cmd.runBinary) {
                        var handled = true;
                        switch (arg.toLowerCase()) {
                            case 'build':
                                cmd.runBuild = true;
                                this.processArgsForBuild(cmd, args, i + 1);
                                break;
                            case 'csc':
                                cmd.runCsc = true;
                                this.processArgsForCsc(cmd, args, i + 1);
                                break;
                            case 'new':
                                cmd.runNew = true;
                                this.processArgsForNew(cmd, args, i + 1);
                                break;
                            case 'l':
                            case 'load':
                                cmd.runLoad = true;
                                this.processArgsForLoad(cmd, args, i + 1);
                                break;
                            case 'lq':
                            case 'loadq':
                                cmd.runLoad = true;
                                cmd.loadQuiet = true;
                                this.processArgsForLoad(cmd, args, i + 1);
                                break;
                            case 'setcomp':
                                cmd.runSetComp = true;
                                this.processArgsForSetComp(cmd, args, i + 1);
                                break;
                            case 'getcomp':
                                cmd.runGetComp = true;
                                break;
                            case 'samples':
                                cmd.runGetSamples = true;
                                break;
                            case 'help':
                                cmd.showHelp = true;
                                break;
                            case 'version':
                                cmd.printVersion = true;
                                break;
                            default:
                                handled = false;
                                break;
                        }
                        if (handled) {
                            break;
                        }
                    }
                }
            }
            if (cmd.showHelp) {
                var commandsStr = '';
                var commandsSet = new Set();
                for (var key of Object.keys(this.process.controller._registeredCommandsJs)) {
                    var command = this.process.controller._registeredCommandsJs[key];
                    var instance = new command;
                    if (!instance.hidden && !commandsSet.has(instance.name)) {
                        commandsSet.add(instance.name);
                        commandsStr += instance.name + ' ';
                    }
                }
                commandsStr = commandsStr.trim();
                this.process.controller.term.writeln('.NET command line tools');
                this.process.controller.term.writeln('[BINARY]    Runs the given binary');
                this.process.controller.term.writeln('load        Load the .NET runtime');
                this.process.controller.term.writeln('build       Builds a csproj');
                this.process.controller.term.writeln('csc         Builds source files');
                this.process.controller.term.writeln('new         Creates a csproj of [NAME]');
                this.process.controller.term.writeln('getcomp     Get available compilers');
                this.process.controller.term.writeln('setcomp     Set the active compiler');
                this.process.controller.term.writeln('samples     Fetch sample code');
                this.process.controller.term.writeln('version     Version info of .NET / webcs');
                this.process.controller.term.writeln('');
                this.process.controller.term.writeln('See github for more info');
                this.process.controller.term.writeln('');
                this.process.controller.term.writeln('============');
                this.process.controller.term.writeln('Commands (-h for help)');
                this.process.controller.term.writeln('============');
                this.process.controller.term.writeln(commandsStr);
                this.process.controller.term.writeln('');
                this.process.controller.term.writeln('============');
                this.process.controller.term.writeln('Getting started');
                this.process.controller.term.writeln('============');
                this.process.controller.term.writeln('dotnet load');
                this.process.controller.term.writeln('dotnet new hello');
                this.process.controller.term.writeln('dotnet build');
                this.process.controller.term.writeln('hello.exe');
                this.process.controller.term.writeln('edit Program.cs');
                this.process.controller.term.writeln('');
            } else if (cmd.printVersion) {
                this.process.controller.term.writeln('.NET ' + webProjectRuntimeVersion);
                this.process.controller.term.writeln(webProjectName + ' ' + webProjectVersion);
            } else if (cmd.runLoad) {
                if (this.isDotNetLoaded()) {
                    this.process.controller.term.writeln('Already loaded');
                } else {
                    var fileInfosToLoad = [];
                    var totalSize = 0;
                    for (var key of Object.keys(WebcsInterop.allFilesByName)) {
                        var fileInfo = WebcsInterop.allFilesByName[key];
                        if (fileInfo.behavior == WCS_FILE_BEHAVIOR_ASSEMBLY && !fileInfo.isLoaded) {
                            fileInfosToLoad.push(fileInfo.name);
                            totalSize += fileInfo.size;
                        }
                    }
                    if (fileInfosToLoad.length > 0) {
                        // TODO: Support cmd.loadToIndexedDb (save to /idb/ and load back from /idb/)
                        if (WebcsInterop.fullLoaderUsePrompt) {
                            var promptText = 'Fetch ' + bytesToSize(totalSize, 1) + '? (y/n) ';
                            this.process.controller.read(promptText).then(str => {
                                if (str.toLowerCase().startsWith('y')) {
                                    // NOTE: Even if you terminate the process the following wont cancel...
                                    this.loadDotNet(fileInfosToLoad, cmd.loadQuiet);
                                } else {
                                    this.process.exit();
                                }
                            });
                        } else {
                            this.loadDotNet(fileInfosToLoad, cmd.loadQuiet);
                        }
                        return;
                    }
                }
            } else {
                if (!this.isDotNetLoaded()) {
                    this.printDotNetNotLoaded();
                } else if (cmd.runGetSamples) {
                    var path = this.process.controller.workingDirectory;
                    if (!path.endsWith('/')) {
                        path += '/';
                    }
                    path += 'samples/';
                    try {
                        FS.mkdir(path);
                    } catch {}
                    this.process.controller.workingDirectory = path;
                    // Hijack the process...
                    var githubCmd = new TerminalCommand_github();
                    githubCmd.process = this.process;
                    this.process.commandJs = githubCmd;
                    githubCmd.run(['-d', getWebProjectRepoUrlForFile('mono/managed/samples')]);
                    return;
                } else if (cmd.runGetComp) {
                    this.process.controller.term.writeln('Compilers: ' + WebcsInterop.callStaticMethod('GetCompilers'));
                    this.process.controller.term.writeln('Active: ' + WebcsInterop.callStaticMethod('GetActiveCompiler'));
                    this.process.controller.term.writeln('Langs: ' + WebcsInterop.callStaticMethod('GetActiveCompilerLanguageVersions'));
                } else if(cmd.runSetComp) {
                    if (!WebcsInterop.callStaticMethod('SetCompiler', [cmd.compilerName])) {
                        this.process.controller.term.writeln('Unknown compiler');
                    }
                } else if (cmd.runBinary) {
                    var fileExists = false;
                    try {
                        FS.lookupPath(cmd.binaryPath);
                        fileExists = true;
                    } catch {
                        this.process.controller.term.writeln('Binary not found');
                    }
                    if (fileExists) {
                        // Just hijack the current process and start the C# code (it's then up to the C# code to close the process)
                        if (WebcsInterop.callStaticMethod('RunMain', [this.process.controller.term.uiWidget.tabId, this.process.id, cmd.binaryPath, cmd.args.join('\r')])) {
                            return;
                        }
                    }
                } else if (cmd.runBuild) {
                    WebcsInterop.callStaticMethod('Compile', [this.process.controller.term.uiWidget.tabId, cmd.buildPath]);
                } else if (cmd.runCsc) {
                    WebcsInterop.callStaticMethod('CompileCsc', [this.process.controller.term.uiWidget.tabId, cmd.args.join('\r')]);
                } else if (cmd.runNew) {
                    if (cmd.newProjectName && !cmd.newProjectName.includes('.') && !cmd.newProjectName.includes('/')) {
                        var path = this.process.controller.workingDirectory;
                        if (!path.endsWith('/')) {
                            path += '/';
                        }
                        path += cmd.newProjectName + '/';
                        var pathExists = false;
                        try {
                            FS.lookupPath(fullPath);
                            pathExists = true;
                        } catch {}
                        if (pathExists) {
                            this.process.controller.term.writeln('Already exists');
                        } else {
                            try {
                                FS.mkdir(path);
                            } catch (err) {
                                console.error(err);
                                this.process.controller.term.writeln('mkdir failed');
                            }
                            try {
                                var projTemplate = '';
                                projTemplate += '<Project Sdk="Microsoft.NET.Sdk">\n';
                                projTemplate += '  <PropertyGroup>\n';
                                projTemplate += '    <OutputType>Exe</OutputType>\n';
                                projTemplate += '    <TargetFramework>net6.0</TargetFramework>\n';
                                projTemplate += '    <RootNamespace>' + cmd.newProjectName + '</RootNamespace>\n';
                                projTemplate += '    <AssemblyName>' + cmd.newProjectName + '</AssemblyName>\n';
                                projTemplate += '  </PropertyGroup>\n';
                                projTemplate += '  <ItemGroup>\n';
                                projTemplate += '    <Reference Include="webcs.exe" />\n';
                                projTemplate += '  </ItemGroup>\n';
                                projTemplate += '</Project>\n';
                                var codeTemplate = '';
                                codeTemplate += 'using System;\n';
                                codeTemplate += '\n';
                                codeTemplate += 'namespace ' + cmd.newProjectName + '\n';
                                codeTemplate += '{\n';
                                codeTemplate += '    class Program\n';
                                codeTemplate += '    {\n';
                                codeTemplate += '        static void WebcsMain(WebcsProcess p)\n';
                                codeTemplate += '        {\n';
                                codeTemplate += '            p.WriteLine("Hello world");\n';
                                codeTemplate += '            p.ReadLine("Enter your name: ", (str) => {\n';
                                codeTemplate += '                p.WriteLine("Hi there \'" + str + "\'");\n';
                                codeTemplate += '                p.Exit();// We are done, close the process\n';
                                codeTemplate += '            });\n';
                                codeTemplate += '            p.OnExit += () => {\n';
                                codeTemplate += '                p.WriteLine("Process exiting");\n';
                                codeTemplate += '            };\n';
                                codeTemplate += '            p.OnKill += () => {\n';
                                codeTemplate += '                p.WriteLine("Process killed (^C)");\n';
                                codeTemplate += '            };\n';
                                codeTemplate += '        }\n';
                                codeTemplate += '\n';
                                codeTemplate += '        // Main is used to find WebcsMain\n';
                                codeTemplate += '        static void Main(){}\n';
                                codeTemplate += '    }\n';
                                codeTemplate += '}\n';
                                FS.writeFile(path + 'Program.cs', codeTemplate);
                                FS.writeFile(path + cmd.newProjectName + '.csproj', projTemplate);
                            } catch (err) {
                                console.error(err);
                            }
                            this.process.controller.workingDirectory = path;
                        }
                    } else {
                        this.process.controller.term.writeln('Invalid name');
                    }
                } else {
                    this.process.controller.term.writeln('Unknown dotnet command');
                }
            }
        }
        this.process.exit();
    }
}

// NOTE: There seems to be a server side bug where you can double up your limits by providing a blank Authorization header
class TerminalCommand_github extends TerminalCommand {
    constructor() {
        super();
        this.name = 'github';
        this.fetchAbort = new AbortController();
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var checkRateLimits = false;
            var onlyCheckingRate = false;
            var fetchSingleFile = false;
            var fetchSubDir = false;
            var subDir = null;
            var fileUrl = null;
            var targetUrl = null;
            var opt = {// For the API requests
                signal: this.fetchAbort.signal,
                headers: {},
                cache: 'no-store'
            };
            var opt2 = {// For the file data
                signal: this.fetchAbort.signal,
            };
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    while (arg.startsWith('-')) {
                        arg = arg.substring(1);
                    }
                    arg = arg.toLowerCase();
                    switch (arg) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'r':
                        case 'rate':
                        case 'rates':
                            checkRateLimits = true;
                            break;
                        case 'a':
                        case 'auth':
                            opt.headers.Authorization = '';
                            break;
                        case 'f':
                        case 'file':
                            fetchSingleFile = true;
                            break;
                        case 'd':
                        case 'dir':
                            fetchSubDir = true;
                            break;
                        default:
                            if (arg.startsWith('a:')) {
                                opt.headers.Authorization = arg.substring(2);
                            } else if (arg.startsWith('auth:')) {
                                opt.headers.Authorization = arg.substring(5);
                            }
                            break;
                    }
                } else {
                    var splitted = arg.split('/').filter(x => x);
                    for (var j = 0; j < splitted.length; j++) {
                        var isRawUrl = splitted[j].includes('raw.githubusercontent.com');
                        if (splitted[j].includes('github.com') || isRawUrl) {
                            if (splitted.length > j + 2) {
                                var userName = splitted[j + 1];
                                var repoName = splitted[j + 2];
                                var treeName = null;
                                if (splitted.length > j + 4) {
                                    if (isRawUrl) {
                                        treeName = splitted[j + 3];
                                        fileUrl = 'https://raw.githubusercontent.com/' + userName + '/' + repoName + '/' + splitted.slice(j + 3).join('/');
                                    } else {
                                        switch (splitted[j + 3]) {
                                            case 'blob':
                                            case 'raw':
                                                treeName = splitted[j + 4];
                                                if (splitted.length > j + 5) {
                                                    fileUrl = 'https://raw.githubusercontent.com/' + userName + '/' + repoName + '/' + splitted.slice(j + 4).join('/');
                                                }
                                                break;
                                            case 'tree':
                                                treeName = splitted[j + 4];
                                                if (splitted.length > j + 5) {
                                                    subDir = splitted.slice(j + 5).join('/');
                                                }
                                                break;
                                        }
                                    }
                                }
                                if (treeName == null) {
                                    this.process.controller.term.writeln('Branch info required. Either:');
                                    this.process.controller.term.writeln('1) Go to a file / folder and copy the url');
                                    this.process.controller.term.writeln('2) Click the branch button and select the (default) branch');
                                    this.process.exit();
                                    return;
                                }
                                targetUrl = 'https://api.github.com/repos/' + userName + '/' + repoName + '/git/trees/' + treeName + '?recursive=1';
                            }
                            break;
                        }
                    }
                }
            }
            if (checkRateLimits && !targetUrl) {
                targetUrl = 'https://api.github.com/rate_limit';
                onlyCheckingRate = true;
            }
            if (showHelp || (!fileUrl && !targetUrl)) {
                this.process.controller.term.writeln('Fetch files from a github repo [URL]');
                //this.process.controller.term.writeln('-a:   Authorization');// Removed from help to reduce confusion (as it's optional and kinda pointless in some ways)
                this.process.controller.term.writeln('-r    Check rate limits');
                this.process.controller.term.writeln('-f    Fetch single file (based on url)');
                this.process.controller.term.writeln('-d    Fetch sub directory (based on url)');
            } else if (fetchSingleFile) {
                if (fileUrl) {
                    var fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
                    var outputPath = this.process.controller.getFullPath(fileName);
                    fetch(fileUrl, opt2).then(response => {
                        if (response.ok) {
                            response.arrayBuffer().then((buffer) => {
                                FS.writeFile(outputPath, new Uint8Array(buffer));
                            }).finally(() => {
                                this.process.exit();
                            });
                        } else {
                            this.process.controller.term.writeln('Fetch failed');
                            this.process.exit();
                        }
                    }).catch(err => {
                        this.process.exit();
                    });
                } else {
                    this.process.controller.term.writeln('File url not provided');
                }
            } else if (targetUrl) {
                fetch(targetUrl, opt).then(response => {
                    if (checkRateLimits && response.headers && response.headers.has('x-ratelimit-limit')) {
                        this.process.controller.term.writeln('limit: ' + response.headers.get('x-ratelimit-limit'));
                        this.process.controller.term.writeln('remaining: ' + response.headers.get('x-ratelimit-remaining'));
                        this.process.controller.term.writeln('reset: ' + new Date(response.headers.get('x-ratelimit-reset') * 1000).toLocaleString());
                    }
                    if (onlyCheckingRate) {
                        this.process.exit();
                    } else if (response.ok) {
                        response.json().then(repoInfo => {
                            if (repoInfo.tree && repoInfo.url && repoInfo.sha) {
                                var baseRawUrl = null;
                                var urlSplitted = repoInfo.url.split('/');
                                for (var i = 0; i < urlSplitted.length; i++) {
                                    if (urlSplitted[i] == 'api.github.com' && urlSplitted.length > i + 3) {
                                        baseRawUrl = 'https://raw.githubusercontent.com/' + urlSplitted[i + 2] + '/' + urlSplitted[i + 3] + '/' + repoInfo.sha + '/';
                                        break;
                                    }
                                }
                                if (baseRawUrl != null) {
                                    // TODO: Support creation of empty directories
                                    // NOTE: This batching code isn't the best (requests will slow down as it reaches the batch size, then speed back up on the next batch)
                                    // NOTE: Batching should probably take into account file size (i.e. it will likely fail batching large files)
                                    var requestsComplete = 0;
                                    var currentBatchRequestsComplete = 0;
                                    var currentBatchSize = 0;
                                    const maxBatchSize = 50;// Batch requests into groups to avoid hitting net::ERR_INSUFFICIENT_RESOURCES
                                    var totalSize = 0;
                                    var targetPathInfos = [];
                                    for (var i = 0; i < repoInfo.tree.length; i++) {
                                        var pathInfo = repoInfo.tree[i];
                                        if (pathInfo.path && pathInfo.mode != 40000) {
                                            if (!fetchSubDir || (subDir && pathInfo.path.startsWith(subDir))) {
                                                pathInfo.requestComplete = false;
                                                pathInfo.rawUrl = baseRawUrl + pathInfo.path;
                                                var relativePath = pathInfo.path;
                                                if (fetchSubDir && subDir) {
                                                    relativePath = relativePath.substring(subDir.length);
                                                    while (relativePath.startsWith('/')) {
                                                        relativePath = relativePath.substring(1);
                                                    }
                                                }
                                                pathInfo.targetPath = this.process.controller.getFullPath(relativePath);
                                                targetPathInfos.push(pathInfo);
                                                if (pathInfo.size) {
                                                    totalSize += pathInfo.size;
                                                }
                                            }
                                        }
                                    }
                                    if (targetPathInfos.length == 0) {
                                        this.process.controller.term.writeln('Done (nothing to fetch)');
                                        this.process.exit();
                                        return;
                                    }
                                    this.process.controller.term.writeln('Fetching ' + bytesToSize(totalSize, 1) + ' of data (' + targetPathInfos.length + ' files)');
                                    var runNextBatch = null;
                                    var onRequestComplete = (pathInfo, success) => {
                                        if (pathInfo.requestComplete || !this.process.isActiveProcess()) {
                                            return;
                                        }
                                        pathInfo.requestComplete = true;
                                        this.process.controller.term.write(success ? '.' : '!');
                                        if (++requestsComplete == targetPathInfos.length) {
                                            this.process.controller.term.writeln('');
                                            this.process.controller.term.writeln('Done');
                                            this.process.exit();
                                        } else if (++currentBatchRequestsComplete == currentBatchSize) {
                                            runNextBatch();
                                        }
                                    };
                                    runNextBatch = () => {
                                        currentBatchRequestsComplete = 0;
                                        currentBatchSize = Math.min(maxBatchSize, targetPathInfos.length - requestsComplete);
                                        //console.log('Get batch ' + currentBatchSize);
                                        for (var i = 0, j = 0; j < currentBatchSize; i++) {
                                            if (i >= targetPathInfos.length) {
                                                this.process.controller.term.writeln('Batching requests failed (went outside of array bounds / possible logic error)');
                                                this.process.exit();
                                                return;
                                            }
                                            let pathInfo = targetPathInfos[i];
                                            if (pathInfo.requestComplete) {
                                                continue;
                                            }
                                            j++;
                                            fetch(pathInfo.rawUrl, opt2).then(rawDataResponse => {
                                                if (rawDataResponse.ok) {
                                                    rawDataResponse.arrayBuffer().then(buffer => {
                                                        try {
                                                            var dirPath = pathInfo.targetPath.substring(0, pathInfo.targetPath.lastIndexOf('/'));
                                                            FS.mkdirTree(dirPath);
                                                        } catch {}
                                                        FS.writeFile(pathInfo.targetPath, new Uint8Array(buffer));
                                                        onRequestComplete(pathInfo, true);
                                                    }).catch(err => {
                                                        console.error(err);
                                                        onRequestComplete(pathInfo, false);
                                                    });
                                                } else {
                                                    //console.error('Failed to fetch "' + pathInfo.rawUrl + '"');
                                                    onRequestComplete(pathInfo, false);
                                                }
                                            }).catch(err => {
                                                //console.error(err);
                                                //console.error('Failed to fetch "' + pathInfo.rawUrl + '"');
                                                onRequestComplete(pathInfo, false);
                                            });
                                        }
                                    };
                                    runNextBatch();
                                } else {
                                    this.process.controller.term.writeln('Failed to resolve base url');
                                    this.process.exit();
                                }
                            } else {
                                this.process.controller.term.writeln('Tree not found');
                                this.process.exit();
                            }
                        });
                    } else {
                        this.process.controller.term.writeln('Fetch failed. Check your rate limits.');
                        this.process.exit();
                    }
                }).catch(err => {
                    this.process.exit();
                });
                return;
            }
        }
        this.process.exit();
    }
    kill() {
        this.fetchAbort.abort();
        this.process.controller.term.writeln('Aborted');
    }
}

// TODO: Many improvements to be made to this... maybe just pull in an existing nuget api lib?
class TerminalCommand_nuget extends TerminalCommand {
    constructor() {
        super();
        this.name = 'nuget';
        this.fetchAbort = new AbortController();
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var packageVersion = null;
            var packageName = null;
            var extractAll = false;
            var extractLib = true;
            var extractNothing = false;
            var saveAsFile = false;
            var opt = {
                signal: this.fetchAbort.signal
            };
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'v':
                        case 'ver':
                        case 'version':
                            if (argValue) {
                                packageVersion = argValue;
                            }
                            break;
                        case 'a':
                        case 'all':
                            extractAll = true;
                            break;
                        case 'n':
                        case 'none':
                            extractNothing = true;
                            break;
                        case 's':
                        case 'save':
                            saveAsFile = true;
                            break;
                        case 'sn':
                        case 'ns':
                            saveAsFile = true;
                            extractNothing = true;
                            break;
                    }
                } else {
                    packageName = null;
                    var splitted = arg.split('/').filter(x => x);
                    for (var j = 0; j < splitted.length - 1; j++) {
                        if (splitted[j].endsWith('nuget.org') && splitted[j + 1] == 'packages') {
                            packageName = splitted[j + 2];
                            if (splitted.length > j + 3) {
                                packageVersion = splitted[j + 3].split('#')[0].trim();
                            }
                            break;
                        }
                    }
                    if (!packageName && !arg.includes('://')) {
                        packageName = arg;
                    }
                }
            }
            if (showHelp || !packageName) {
                this.process.controller.term.writeln('Fetch a nuget package and extract "lib" [URL] / [NAME]');
                this.process.controller.term.writeln('-v:   Version to fetch');
                this.process.controller.term.writeln('-sn   Save as file and do not extract');
                this.process.controller.term.writeln('-s    Save as a file');
                this.process.controller.term.writeln('-n    Do not extract');
                this.process.controller.term.writeln('-e    Extract all');
            } else if (packageName) {
                var getPackage = () => {
                    let fileName = packageName + '.' + packageVersion + '.nupkg';
                    this.process.controller.term.writeln('Fetching...');
                    fetch('https://api.nuget.org/v3-flatcontainer/' + packageName + '/' + packageVersion + '/' + fileName, opt).then(response => {
                        if (response.ok) {
                            response.arrayBuffer().then(buffer => {
                                this.process.controller.term.writeln('Processing...');
                                if (saveAsFile) {
                                    try {
                                        FS.writeFile(this.process.controller.getFullPath(fileName), new Uint8Array(buffer));
                                    } catch (err) {
                                        console.error(err);
                                        this.process.controller.term.writeln('-s failed');
                                    }
                                }
                                if ((extractAll || extractLib) && !extractNothing) {
                                    (new JSZip()).loadAsync(buffer).then(zip => {
                                        var dir = this.process.controller.getFullPath(packageName);
                                        if (!dir.endsWith('/')) {
                                            dir += '/';
                                        }
                                        try {
                                            FS.mkdirTree(dir);
                                        } catch {}
                                        var filesToExtract = [];
                                        for (var key of Object.keys(zip.files)) {
                                            let file = zip.files[key];
                                            if (!extractAll) {
                                                if (!file.name.startsWith('lib/')) {
                                                    continue;
                                                }
                                                var nameToLower = file.name.toLowerCase();
                                                if (nameToLower.endsWith('.resources.dll') || nameToLower.endsWith('.resources.exe')) {
                                                    continue;
                                                }
                                                if (!nameToLower.endsWith('.dll') && !nameToLower.endsWith('.exe')) {
                                                    continue;
                                                }
                                            }
                                            filesToExtract.push(file);
                                        }
                                        var numFilesToExtract = filesToExtract.length;
                                        var numFilesExtracted = 0;
                                        var numFilesExtractedFailed = 0;
                                        if (numFilesToExtract == 0) {
                                            this.process.controller.term.writeln('Done (nothing to extract)');
                                            this.process.exit();
                                            return;
                                        }
                                        var onFileData = (file, fileData, success) => {
                                            if (file.dir) {
                                                // Ignore...
                                            } else if (success) {
                                                var filePath = file.name;
                                                if (!extractAll && extractLib && filePath.startsWith('lib/')) {
                                                    // Remove /lib/ as it's a little pointless when not extracting all files
                                                    filePath = filePath.substring(4);
                                                }
                                                var fileDir = filePath;
                                                var lastSlashIndex = fileDir.lastIndexOf('/');
                                                if (lastSlashIndex > 0) {
                                                    fileDir = fileDir.substring(0, lastSlashIndex);
                                                    try {
                                                        FS.mkdirTree(dir + fileDir);
                                                    } catch {}
                                                }
                                                try {
                                                    FS.writeFile(dir + filePath, fileData);
                                                } catch {
                                                    numFilesExtractedFailed++;
                                                }
                                            } else {
                                                numFilesExtractedFailed++;
                                            }
                                            if (++numFilesExtracted == numFilesToExtract) {
                                                this.process.controller.term.writeln('Done' + (numFilesExtractedFailed > 0 ? ' (' + numFilesExtractedFailed + ' failed)' : ''));
                                                this.process.exit();
                                            }
                                        };
                                        for (var i = 0; i < filesToExtract.length; i++) {
                                            let file = filesToExtract[i];
                                            file.async('uint8array').then(fileData => {
                                                onFileData(file, fileData, true);
                                            }).catch(err => {
                                                onFileData(file, null, false);
                                            });
                                        }
                                    }).catch(err => {
                                        console.error(err);
                                        this.process.exit();
                                    });
                                } else {
                                    this.process.controller.term.writeln('Done');
                                    this.process.exit();
                                }
                            }).catch(err => {
                                console.error(err);
                                this.process.exit();
                            });
                        } else {
                            this.process.controller.term.writeln('Failed to fetch package "' + packageName + '" (' + packageVersion + ')');
                            this.process.exit();
                        }
                    }).catch(err => {
                        console.error(err);
                        this.process.exit();
                    });
                };
                if (packageVersion) {
                    getPackage();
                } else {
                    fetch('https://api.nuget.org/v3-flatcontainer/' + packageName + '/index.json', opt).then(response => {
                        if (response.ok) {
                            response.json().then(packageInfo => {
                                if (packageInfo.versions && packageInfo.versions.length) {
                                    packageVersion = packageInfo.versions[packageInfo.versions.length - 1];
                                    this.process.controller.term.writeln('Version ' + packageVersion);
                                    getPackage();
                                } if (!packageInfo.versions) {
                                    this.process.controller.term.writeln('Couldn\'t find version info for package "' + packageName + '"');
                                    this.process.exit();
                                    return;
                                }
                            }).catch(err => {
                                console.error(err);
                                this.process.exit();
                            });
                        } else {
                            this.process.controller.term.writeln('Failed to find package "' + packageName + '"');
                            this.process.exit();
                        }
                    }).catch(err => {
                        console.error(err);
                        this.process.exit();
                    });
                }
                return;
            }
        }
        this.process.exit();
    }
    kill() {
        this.fetchAbort.abort();
        this.process.controller.term.writeln('Aborted');
    }
}

// NOTE: No real way to handle cancel events for "fs in" so just use Ctrl+C / ^C
class TerminalCommand_fs extends TerminalCommand {
    constructor() {
        super();
        this.name = 'fs';
        this.fileReaders = [];
        this.isAborted = false;
    }
    saveFile(buffer, name) {
        var blob = new Blob([buffer]);
        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = name;
        link.click();
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var paths = [];
            var cmd = null;
            var archiveName = 'archive.zip';
            var hasSetArchiveName = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'n':
                        case 'name':
                            if (argValue) {
                                hasSetArchiveName = true;
                                archiveName = argValue;
                            }
                            break;
                    }
                } else if (cmd == null) {
                    cmd = arg;
                } else {
                    paths.push(arg);
                }
            }
            if (cmd != 'in' && cmd != 'out') {
                showHelp = true;
            }
            if (showHelp) {
                this.process.controller.term.writeln('Transfer files in / out of the virtual filesystem');
                this.process.controller.term.writeln('in    Transfer files in (^C to cancel)');
                this.process.controller.term.writeln('out   Transfer [PATH(s)] out');
            } else if (cmd == 'in') {
                var targetDir = this.process.controller.workingDirectory;
                if (paths.length > 0) {
                    try {
                        var newTargetDir = this.process.controller.getFullPath(paths[0]);
                        var node = FS.lookupPath(newTargetDir).node;
                        if (!node.isFolder) {
                            this.process.controller.term.writeln('fs: ' + paths[0] + ': Is not a directory');
                            this.process.exit();
                            return;
                        } else {
                            targetDir = newTargetDir;
                        }
                    } catch {
                        this.process.controller.term.writeln('fs: ' + paths[0] + ': No such file or directory');
                        this.process.exit();
                        return;
                    }
                }
                if (!targetDir.endsWith('/')) {
                    targetDir += '/';
                }
                var input = document.createElement('input');
                input.type = 'file';
                input.multiple = 'true';
                input.onchange = (evnt) => {
                    if (this.isAborted) {
                        return;
                    }
                    var numFilesLoaded = 0;
                    var numFilesFailed = 0;
                    var numFilesToLoad = evnt.target.files.length;
                    var onLoadComplete = (success) => {
                        if (!success) {
                            numFilesFailed++;
                        }
                        if (++numFilesLoaded == numFilesToLoad) {
                            if (numFilesFailed > 0) {
                                this.process.controller.term.writeln('Done (' + numFilesFailed + ' failed)');
                            }
                            this.process.exit();
                        }
                    };
                    for (var i = 0; i < evnt.target.files.length; i++) {
                        let file = evnt.target.files[i];
                        let reader = new FileReader();
                        this.fileReaders.push(reader);
                        reader.onload = (readResult) => {
                            if (this.isAborted) {
                                return;
                            }
                            var success = true;
                            try {
                                var data = new Uint8Array(readResult.target.result);
                                FS.writeFile(targetDir + file.name, data);
                            } catch (err) {
                                console.error(err);
                                success = false;
                            }
                            onLoadComplete(success);
                        };
                        reader.onerror = (readResult) => {
                            if (this.isAborted) {
                                return;
                            }
                            onLoadComplete(false);
                        };
                        reader.readAsArrayBuffer(file);
                    }
                };
                input.click();
                return;
            } else if (cmd == 'out') {
                if (paths.length == 0) {
                    this.process.controller.term.writeln('fs: Expected at least 1 path got 0');
                }
                var zip = new JSZip();
                var zipRecurse = (baseDir, targetDir, dirNode) => {
                    for (var key of Object.keys(dirNode.contents)) {
                        var childNode = dirNode.contents[key];
                        var fullPath = FS.getPath(childNode);
                        var path = fullPath;
                        if (!path.startsWith(baseDir)) {
                            console.error('File path missmatch? baseDir:"' + baseDir + '" path:"' + path + '"');
                            return;
                        }
                        path = targetDir + path.substring(baseDir.length);
                        if (childNode.isFolder) {
                            zip.folder(path);
                            zipRecurse(baseDir, targetDir, childNode);
                        } else {
                            try {
                                zip.file(path, FS.readFile(fullPath))
                            } catch {
                                // Just consume the error for now...
                            }
                        }
                    }
                };
                for (var i = 0; i < paths.length; i++) {
                    var path = this.process.controller.getFullPath(paths[i]);
                    try {
                        var node = FS.lookupPath(path).node;
                        var nodeName = FS.isRoot(node) ? node.mount.mountpoint.replace('/', '') : node.name;
                        if (node.isFolder) {
                            try {
                                if (paths.length == 1 && !hasSetArchiveName) {
                                    // TODO: Maybe also put the contents of the folder in the zip? (rather than the folder itself)
                                    archiveName = nodeName + '.zip';
                                }
                                var baseDir = FS.getPath(node);
                                if (!baseDir.endsWith('/')) {
                                    baseDir += '/';
                                }
                                var targetDir = nodeName;
                                if (baseDir == '/') {
                                    targetDir = 'root';
                                }
                                targetDir += '/';
                                zipRecurse(baseDir, targetDir, node);
                            } catch (err) {
                                console.error(err);
                                this.process.controller.term.writeln('fs: ' + paths[i] + ': Read failed. See browser console log');
                            }
                        } else if (paths.length == 1) {
                            try {
                                this.saveFile(FS.readFile(path), nodeName);
                            } catch (err) {
                                console.error(err);
                                this.process.controller.term.writeln('fs: ' + paths[i] + ': Write failed. See browser console log');
                            }
                        } else {
                            try {
                                zip.file(nodeName, FS.readFile(path));
                            } catch (err) {
                                console.error(err);
                                this.process.controller.term.writeln('fs: ' + paths[i] + ': Read failed. See browser console log');
                            }
                        }
                    } catch {
                        this.process.controller.term.writeln('fs: ' + paths[i] + ': No such file or directory');
                    }
                }
                if (Object.keys(zip.files).length > 0) {
                    zip.generateAsync({type : 'uint8array'}).then(buffer => {
                        if (this.isAborted) {
                            return;
                        }
                        this.saveFile(buffer, archiveName);
                        this.process.exit();
                    }).catch(err => {
                        console.error(err);
                        this.process.controller.term.writeln('fs: failed. See browser console log');
                        this.process.exit();
                    });
                    return;
                }
            }
        }
        this.process.exit();
    }
    kill() {
        this.isAborted = true;
        for (var i = 0; i < this.fileReaders.length; i++) {
            this.fileReaders[i].abort();
        }
        this.process.controller.term.writeln('Aborted');
    }
}

class TerminalCommand_zip extends TerminalCommand {
    constructor() {
        super();
        this.name = 'zip';
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var paths = [];
            var archiveName = null;
            var hasSetArchiveName = true;
            var unpackDirsIntoRoot = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'r':
                            unpackDirsIntoRoot = true;
                            break;
                    }
                } else if (!archiveName) {
                    archiveName = arg;
                } else {
                    paths.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Create a zip of [NAME] with content of [PATH(s)]');
                this.process.controller.term.writeln('-r     Top level directory contents go into the root of the zip');
            } else if (!archiveName || paths.length == 0) {
                this.process.controller.term.writeln('zip: Expected a zip name and at least 1 path');
            } else {
                // NOTE: This code was literally copy/pasted from TerminalCommand_fs... probably should merge the duplicated code...
                var zip = new JSZip();
                var zipSingleFile = (targetPath, fsPath) => {
                    try {
                        zip.file(targetPath, FS.readFile(fsPath))
                    } catch {
                        // Just consume the error for now...
                    }
                }
                var zipRecurse = (baseDir, targetDir, dirNode) => {
                    for (var key of Object.keys(dirNode.contents)) {
                        var childNode = dirNode.contents[key];
                        var fullPath = FS.getPath(childNode);
                        var path = fullPath;
                        if (!path.startsWith(baseDir)) {
                            console.error('File path missmatch? baseDir:"' + baseDir + '" path:"' + path + '"');
                            return;
                        }
                        path = targetDir + path.substring(baseDir.length);
                        if (childNode.isFolder) {
                            zip.folder(path);
                            zipRecurse(baseDir, targetDir, childNode);
                        } else {
                            zipSingleFile(path, fullPath);
                        }
                    }
                };
                for (var i = 0; i < paths.length; i++) {
                    var path = this.process.controller.getFullPath(paths[i]);
                    try {
                        var node = FS.lookupPath(path).node;
                        var nodeName = FS.isRoot(node) ? node.mount.mountpoint.replace('/', '') : node.name;
                        if (node.isFolder) {
                            try {
                                var baseDir = FS.getPath(node);
                                if (!baseDir.endsWith('/')) {
                                    baseDir += '/';
                                }
                                var targetDir = nodeName;
                                if (baseDir == '/') {
                                    targetDir = 'root';
                                }
                                targetDir += '/';
                                zipRecurse(baseDir, unpackDirsIntoRoot ? '' : targetDir, node);
                            } catch (err) {
                                console.error(err);
                                this.process.controller.term.writeln('zip: ' + paths[i] + ': Read failed. See browser console log');
                            }
                        } else {
                            zipSingleFile(nodeName, path);
                        }
                    } catch {
                        this.process.controller.term.writeln('zip: ' + paths[i] + ': No such file or directory');
                    }
                }
                if (Object.keys(zip.files).length > 0) {
                    zip.generateAsync({type : 'uint8array'}).then(buffer => {
                        if (this.isAborted) {
                            return;
                        }
                        var archivePath = this.process.controller.getFullPath(archiveName);
                        FS.writeFile(archivePath, buffer);
                        this.process.exit();
                    }).catch(err => {
                        console.error(err);
                        this.process.controller.term.writeln('zip: failed. See browser console log');
                        this.process.exit();
                    });
                    return;
                }
            }
        }
        this.process.exit();
    }
    kill() {
        this.isAborted = true;
        this.process.controller.term.writeln('Aborted');
    }
}

class TerminalCommand_unzip extends TerminalCommand {
    constructor() {
        super();
        this.name = 'unzip';
        this.fileReaders = [];
        this.isAborted = false;
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var paths = [];
            var targetDir = null;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'd':
                            if (argValue) {
                                targetDir = argValue;
                            }
                            break;
                    }
                } else {
                    paths.push(arg);
                }
            }
            if (showHelp) {
                this.process.controller.term.writeln('Unzip [PATH(s)]');
                this.process.controller.term.writeln('-d:     Output directory (it must already exist)');
            } else if (paths.length == 0) {
                this.process.controller.term.writeln('unzip: Expected at least 1 zip path');
            } else {
                var fullTargetDir = targetDir ? this.process.controller.getFullPath(targetDir) : this.process.controller.workingDirectory;
                try {
                    var node = FS.lookupPath(fullTargetDir).node;
                    if (!node.isFolder) {
                        this.process.controller.term.writeln('unzip: ' + targetDir + ': is not a directory');
                        this.process.exit();
                        return;
                    }
                } catch {
                    this.process.controller.term.writeln('unzip: ' + targetDir + ': No such file or directory');
                    this.process.exit();
                    return;
                }
                if (!fullTargetDir.endsWith('/')) {
                    fullTargetDir += '/';
                }
                var isProcessingZips = false;
                var zipsToProcess = [];
                var numZipsProcessed = 0;
                var zipProcessed = () => {
                    if (this.isAborted) {
                        return;
                    }
                    if (++numZipsProcessed == zipsToProcess.length) {
                        //this.process.controller.term.writeln('unzip: Done');
                        this.process.exit();
                    }
                };
                for (var i = 0; i < paths.length; i++) {
                    var path = this.process.controller.getFullPath(paths[i]);
                    try {
                        var node = FS.lookupPath(path).node;
                        if (node.isFolder) {
                            this.process.controller.term.writeln('unzip: ' + paths[i] + ': Is a directory');
                        } else {
                            zipsToProcess.push(paths[i]);
                        }
                    } catch {
                        this.process.controller.term.writeln('unzip: ' + paths[i] + ': No such file or directory');
                    }
                }
                for (var i = 0; i < zipsToProcess.length; i++) {
                    try {
                        let inputPath = zipsToProcess[i];
                        let path = this.process.controller.getFullPath(inputPath);
                        let buffer = FS.readFile(path);
                        let hasThisProcessed = false;
                        let thisZipProcessed = () => {
                            if (!hasThisProcessed) {
                                hasThisProcessed = true;
                                zipProcessed();
                            }
                        };
                        let zipName = '';
                        let zipLastSlashIndex = path.lastIndexOf('/');
                        if (zipLastSlashIndex >= 0) {
                            zipName = zipName.substring(zipLastSlashIndex + 1);
                            let zipLastDotIndex = zipName.lastIndexOf('.');
                            if (zipLastDotIndex > 0) {
                                zipName = zipName.substring(0, zipLastDotIndex);
                            }
                        } else {
                            thisZipProcessed();
                            continue;
                        }
                        (new JSZip()).loadAsync(buffer).then(zip => {
                            let numFilesToExtract = Object.keys(zip.files).length;
                            let numFilesExtracted = 0;
                            let numFilesExtractedFailed = 0;
                            var onFileData = (file, fileData, success) => {
                                if (this.isAborted) {
                                    return;
                                }
                                if (file.dir) {
                                    // Ignore...
                                } else if (success) {
                                    var filePath = file.name;
                                    var fileDir = filePath;
                                    var lastSlashIndex = fileDir.lastIndexOf('/');
                                    if (lastSlashIndex > 0) {
                                        fileDir = fileDir.substring(0, lastSlashIndex);
                                        try {
                                            FS.mkdirTree(fullTargetDir + fileDir);
                                        } catch {}
                                    }
                                    try {
                                        FS.writeFile(fullTargetDir + filePath, fileData);
                                    } catch {
                                        numFilesExtractedFailed++;
                                    }
                                } else {
                                    numFilesExtractedFailed++;
                                }
                                if (++numFilesExtracted == numFilesToExtract) {
                                    if (numFilesExtractedFailed > 0) {
                                        this.process.controller.term.writeln('unzip: failed to extract ' + numFilesExtractedFailed + ' files');
                                    }
                                    thisZipProcessed();
                                }
                            };
                            for (var key of Object.keys(zip.files)) {
                                let file = zip.files[key];
                                file.async('uint8array').then(fileData => {
                                    onFileData(file, fileData, true);
                                }).catch(err => {
                                    onFileData(file, null, false);
                                });
                            }
                        }).catch(err => {
                            console.log(err);
                            this.process.controller.term.writeln('unzip: ' + inputPath + ': unzip failed. See browser console log');
                            thisZipProcessed();
                        });
                    } catch (err) {
                        console.log(err);
                        this.process.controller.term.writeln('unzip: ' + inputPath + ': read failed. See browser console log');
                        thisZipProcessed();
                    }
                }
                if (zipsToProcess.length > 0) {
                    return;
                }
            }
        }
        this.process.exit();
    }
    kill() {
        this.isAborted = true;
        this.process.controller.term.writeln('Aborted');
    }
}

class TerminalCommand_compress extends TerminalCommand {
    constructor() {
        super();
        this.name = 'compress';
        this.hidden = true;// This command isn't supported / may be removed. It's just used to create compressed files for GitHub Pages
        this.isAborted = false;
    }
    run(args) {
        if (this.process.controller != null) {
            var showHelp = false;
            var paths = [];
            var isCompress = true;
            var compressionType = CompressionType_None;
            var compressionLevel = -1;
            var memoryLevel = -1;
            var outputDirectory = null;
            var copyNonCompressedFiles = false;
            var isRecursive = false;
            var fileExtensions = new Set();
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (arg.startsWith('-')) {
                    const [argKey, argValue] = this.getArgKeyValue(arg);
                    switch (argKey) {
                        case 'h':
                        case 'help':
                            showHelp = true;
                            break;
                        case 'd':
                            isCompress = false;
                            break;
                        case 'l':
                            compressionLevel = argValue | 0;
                            break;
                        case 'm':
                            memoryLevel = argValue | 0;
                            break;
                        case 'gzip':
                            compressionType = CompressionType_GZip;
                            break;
                        case 'brotli':
                            compressionType = CompressionType_Brotli;
                            break;
                        case 'o':
                            if (argValue) {
                                outputDirectory = argValue;
                            }
                            break;
                        case 'c':
                            copyNonCompressedFiles = true;
                            break;
                        case 'r':
                            isRecursive = true;
                            break;
                        case 'e':
                            if (argValue) {
                                var splitted = argValue.split(',').filter(x => x);
                                for (var j = 0; j < splitted.length; j++) {
                                    fileExtensions.add(splitted[j]);
                                }
                            }
                            break;
                    }
                } else {
                    paths.push(arg);
                }
            }
            if (showHelp || args.length == 0) {
                this.process.controller.term.writeln('Compress / decompress [PATH(s)]');
                this.process.controller.term.writeln('-gzip    Use gzip');
                this.process.controller.term.writeln('-brotli  Use brotli');
                this.process.controller.term.writeln('-d       Decompress');
                this.process.controller.term.writeln('-l:      Compression level (brotli 0-11) (gzip 0-9)');
                this.process.controller.term.writeln('-m:      Memory level (gzip 0-12)');
                this.process.controller.term.writeln('-o:      Output directory');
                this.process.controller.term.writeln('-e:      File extensions to target');
                this.process.controller.term.writeln('-c       On decompress copy non-compressed files to output dir');
                this.process.controller.term.writeln('-r       Recursive');
            } else {
                var isFilesOnly = true;
                for (var i = paths.length - 1; i >= 0; i--) {
                    var path = paths[i];
                    var fullPath = this.process.controller.getFullPath(path);
                    try {
                        var node = FS.lookupPath(fullPath).node;
                        if (node.isFolder) {
                            isFilesOnly = false;
                            if (!isRecursive) {
                                this.process.controller.term.writeln('compress: ' + path + ': Is a directory');
                                try {
                                    paths.splice(i, 1);
                                } catch {}
                            }
                        }
                    } catch {
                        this.process.controller.term.writeln('compress: ' + path + ': No such file or directory');
                        paths.splice(i, 1);
                    }
                }
                var gzipOpt = {};
                if (compressionLevel >= 0) {
                    gzipOpt.level = compressionLevel;
                }
                if (memoryLevel >= 0) {
                    gzipOpt.mem = memoryLevel;
                }
                var compressionInstance = null;
                var compressionInstances = [];
                var work = 0;
                var runCompressionForPaths = (targetPaths, dstPathFull) => {
                    var targetPathsIndex = 0;
                    work++;
                    var runCompressionForNextPath = () => {
                        if (targetPaths.length > 0) {
                            runCompressionForPath(targetPaths[targetPathsIndex++], dstPathFull);
                        }
                        if (targetPathsIndex >= targetPaths.length) {
                            if (--work <= 0) {
                                this.isAborted = true;
                                this.process.exit();
                            }
                        } else {
                            setTimeout(runCompressionForNextPath, 1);
                        }
                    };
                    runCompressionForNextPath();
                };
                var runCompressionForPath = (path, dstPathFull) => {
                    if (this.isAborted) {
                        return;
                    }
                    if (!dstPathFull.endsWith('/')) {
                        dstPathFull += '/';
                    }
                    try {
                        FS.mkdirTree(dstPathFull);
                    } catch {}
                    var fullPath = this.process.controller.getFullPath(path);
                    try {
                        var node = FS.lookupPath(fullPath).node;
                        if (node.isFolder) {
                            var dstPath = dstPathFull + node.name;
                            try {
                                FS.mkdirTree(dstPath);
                            } catch {}
                            if (isRecursive) {
                                var childPaths = [];
                                for (var key of Object.keys(node.contents)) {
                                    childPaths.push(FS.getPath(node.contents[key]));
                                }
                                runCompressionForPaths(childPaths, dstPath);
                            }
                        } else {
                            var logMsg = path;
                            console.log(logMsg);
                            this.process.controller.term.writeln(logMsg);
                            var data = null;
                            try {
                                data = FS.readFile(fullPath);
                            } catch {}
                            if (data != null) {
                                try {
                                    if (isCompress) {
                                        var compressedData = null;
                                        switch (compressionInstance.libType) {
                                            case CompressionType_Brotli:
                                                compressedData = new Uint8Array(compressionInstance.compressArray(data, compressionLevel >= 0 ? compressionLevel : 1));
                                                break;
                                            case CompressionType_GZip:
                                                compressedData = compressionInstance.gzipSync(data, gzipOpt);
                                                break;
                                        }
                                        if (compressedData) {
                                            var extension = getCompressionFileExtension(compressionInstance.libType);
                                            FS.writeFile(dstPathFull + node.name + extension, compressedData);
                                        }
                                    } else {
                                        var libInfo = getCompressionLibInfoFromPath(fullPath);
                                        var libInstance = compressionInstances[libInfo.type];
                                        if (!libInstance) {
                                            FS.writeFile(dstPathFull + node.name, data);
                                        } else {
                                            var decompressedData = null;
                                            switch (libInstance.libType) {
                                                case CompressionType_Brotli:
                                                    //decompressedData = new Uint8Array(libInstance.decompressArray(data));//brotli.js
                                                    decompressedData = libInstance.decode(data);//brotli-decode.min.js
                                                    debugger;
                                                    break;
                                                case CompressionType_GZip:
                                                    decompressedData = libInstance.decompressSync(data);
                                                    break;
                                            }
                                            if (decompressedData) {
                                                FS.writeFile(dstPathFull + libInfo.nameWithoutExtension, decompressedData);
                                            }
                                        }
                                    }
                                } catch(err) {
                                    console.error('Failed to compress ' + path);
                                    console.error(err);
                                }
                            }
                        }
                    } catch {}
                };
                var runCompression = () => {
                    if (this.isAborted) {
                        return;
                    }
                    if (paths.length > 0) {
                        var logMsg = (isCompress ? 'Compressing' : 'Decompressing') + '...';
                        console.log(logMsg);
                        this.process.controller.term.writeln(logMsg);
                    }
                    var outDir = this.process.controller.workingDirectory;
                    if (!isFilesOnly || outputDirectory) {
                        outDir = this.process.controller.getFullPath(outputDirectory ? outputDirectory : 'out')
                    }
                    runCompressionForPaths(paths, outDir);
                };
                if (isCompress) {
                    var libLoadedCallback = (instance) => {
                        compressionInstance = instance;
                        runCompression();
                    };
                    if (!getLibForCompress(compressionType, libLoadedCallback)) {
                        this.process.controller.term.writeln('Failed to get compression lib (check console log)');
                        this.process.exit();
                    }
                } else {
                    var targetLibTypes = [CompressionType_Brotli, CompressionType_GZip];
                    var loadedLibs = 0;
                    var libLoadedCallback = (instance) => {
                        compressionInstances[instance.libType] = instance;
                        if (++loadedLibs == targetLibTypes.length) {
                            runCompression();
                        }
                    };
                    for (var i = 0; i < targetLibTypes.length; i++) {
                        if (!getLibForDecompress(targetLibTypes[i], libLoadedCallback)) {
                            this.process.controller.term.writeln('Failed to get compression lib (check console log)');
                            this.process.exit();
                            break;
                        }
                    }
                }
                return;
            }
        }
        this.process.exit();
    }
    kill() {
        this.isAborted = true;
    }
}

class TerminalCommand_help extends TerminalCommand {
    constructor() {
        super();
        this.name = 'help';
        this.nameAliases = ['?', '??', '???'];
    }
    run() {
        if (this.process.controller != null) {
            showTerminalHelp(this.process.controller.term);
        }
        this.process.exit();
    }
}

class TerminalCommand_looptest extends TerminalCommand {
    constructor() {
        super();
        this.name = 'looptest';
        this.disabled = true;
        this.killed = false;
    }
    loopFunc() {
        if (this.killed) {
            return;
        }
        if (this.process.controller == null) {
            this.process.kill();
            return;
        }
        this.process.controller.term.writeln('loopfunc ' + Date.now());
        console.log(Date.now());
        setTimeout(() => this.loopFunc(), 2000);
    }
    run() {
        this.loopFunc();
    }
    kill() {
        console.log('looptest process killed');
        this.killed = true;
    }
}

allTerminalCommandsJs = {
    TerminalCommand_cd,
    TerminalCommand_ls,
    TerminalCommand_cp,
    TerminalCommand_mv,
    TerminalCommand_touch,
    TerminalCommand_mkdir,
    TerminalCommand_rmdir,
    TerminalCommand_rm,
    TerminalCommand_pwd,
    TerminalCommand_exit,
    TerminalCommand_clear,
    TerminalCommand_reset,
    TerminalCommand_fsync,
    TerminalCommand_termname,
    TerminalCommand_termnew,
    TerminalCommand_edit,
    TerminalCommand_theme,
    TerminalCommand_dotnet,
    TerminalCommand_github,
    TerminalCommand_nuget,
    TerminalCommand_fs,
    TerminalCommand_zip,
    TerminalCommand_unzip,
    TerminalCommand_compress,
    TerminalCommand_help,
    TerminalCommand_looptest,
};