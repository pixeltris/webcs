// https://github.com/wavesoft/local-echo (Apache-2.0 License)
// https://github.com/wasmerio/wasmer-js/tree/master/packages/wasm-terminal/src (MIT)
// Changes:
// - More shortcuts (mostly from wasmer-js)
// - Correctly set cursor position in handleReadComplete
// - Handle wrap around in clearInput,setInput,setCursor (cols-1 and ' \x1B[1K')
// - In handleCursorInsert call clearInput before modifying _cursor / calling setInput
// - History fix from https://github.com/wavesoft/local-echo/issues/34
// - Clear terminal selection in handleTermResize (as otherwise selection gets buggy - xterm.js fault)
// - Added _clipboard for cut/paste shortcuts
// - Removed deprecated attach/detach functions
// - Temporarily changed clearInput to ensure line isWrapped is false when clearing lines - for actual fix see PR https://github.com/xtermjs/xterm.js/pull/3536
// - Removed candidates.sort() on tab completion as we want commands before files/folders
// - Removed whitespace insertion on tab completion (also hasTailingSpace)
// - Replaced parse() with stringToArgs()
// TODO: Pull in this fix for ansi escape sequences in the prompt https://github.com/wavesoft/local-echo/issues/24#issuecomment-774676509

// BUGS:
// - [semi-FIXED] Write text so it wraps to next line, delete text so it unwraps. Press enter twice. The second prompt text will then reflow incorrectly on terminal resize.
//   - https://github.com/xtermjs/xterm.js/issues/1882
//   - https://github.com/xtermjs/xterm.js/pull/3536
// - [semi-FIXED] Write text so it fits exactly on one line and so the cursor wraps around. Press enter. The wrapped cursor line persists.
//   - The above unmerged-PR is related to this being "semi-FIXED". It is fixed, but not in the correct way.

// NOTE: Don't use readChar, it needs improvement as it currently expects an active read

var nextTerminalProcessId = 1;

// Provides a basic terminal command history
class TerminalHistory {
    constructor(size) {
        this.size = size;
        this.entries = [];
        this.cursor = 0;
    }
    
    // Push an entry and maintain ring buffer size
    push(entry) {
        // Skip empty entries
        if (entry.trim() === '') return;
        // Skip duplicate entries
        const lastEntry = this.entries[this.entries.length - 1];
        if (entry === lastEntry) return;
        // Keep track of entries
        this.entries.push(entry);
        if (this.entries.length > this.size) {
            this.entries.shift();
        }
        this.cursor = this.entries.length;
    }
    
    // Rewind history cursor on the last entry
    rewind() {
        this.cursor = this.entries.length;
    }
    
    // Returns the previous entry
    getPrevious() {
        const idx = Math.max(0, this.cursor - 1);
        this.cursor = idx;
        return this.entries[idx];
    }
    
    // Returns the next entry
    getNext() {
        const idx = Math.min(this.entries.length, this.cursor + 1);
        this.cursor = idx;
        return this.entries[idx];
    }
}

// Defines a virtual process which executes under the context of a terminal.
class TerminalProcess {
    constructor(controller) {
        this.controller = controller;
        this.commandJs = null;
        this._calledExit = false;
        if (nextTerminalProcessId == Number.MAX_SAFE_INTEGER) {
            throw 'TerminalProcess id reached MAX_SAFE_INTEGER';
        }
        this.id = nextTerminalProcessId++;
    }
    // Called to kill the process early
    kill() {
        if (this.commandJs != null && this.commandJs.kill) {
            this.commandJs.kill();
        }
        if (this.controller != null && WebcsInterop.webcsOnProcessKill != null) {
            WebcsInterop.webcsOnProcessKill(this.controller.widget.tabId, this.id);
        }
        if (!this._calledExit) {
            this.exit();
        }
    }
    // Called by the executing command/process when it exits
    exit(exitCode) {
        this._calledExit = true;
        if (this.controller != null && WebcsInterop.webcsOnProcessExit != null) {
            WebcsInterop.webcsOnProcessExit(this.controller.widget.tabId, this.id);
        }
        if (this.isActiveProcess()) {
            this.controller.setProcess(null);
            this.controller.runReadLoop();
        }
    }
    isActiveProcess() {
        return this.controller != null && this.controller._activeProcess == this;
    }
}

// Responsible for controlling a given xterm.js instance (navigation, history, commands, processes, etc)
class TerminalController {
    constructor(term, options) {
        if (!options) options = {};
        this.term = term;
        this._handleTermData = this.handleTermData.bind(this);
        this._handleTermResize = this.handleTermResize.bind(this)
        this.history = new TerminalHistory(options.historySize || 10);
        this._historyTemp = this.history;// this exists because history is nulled while processes are active (to avoid junk in history... maybe give each process their own history?)
        this.maxAutocompleteEntries = options.maxAutocompleteEntries || 100;
        this.silentCtrlC = options.silentCtrlC || false;
        this._clipboard = null;// Ctrl+W, Ctrl+K, Ctrl+U, Ctrl+Y
        this._activeProcess = null;
        this._registeredCommandsJs = [];
        this._autocompleteHandlers = [];
        this.workingDirectory = '/';
        this._active = false;
        this._input = '';
        this._cursor = 0;
        this._activePrompt = null;
        this._activeCharPrompt = null;
        this._termSize = {
            cols: 0,
            rows: 0,
        };
        this._disposables = [];
        this.registerCommandsJs(allTerminalCommandsJs);
        if (term) {
            term.loadAddon(this);
        }
        this.addAutocompleteHandler((index, tokens, args) => {
            var result = [];
            if (tokens.length > 0 && tokens[index]) {
                var dirPath = this.workingDirectory;
                var isValidDir = true;
                var str = tokens[index];
                var prefix = '';
                var lastSlashIndex = str.lastIndexOf('/');
                if (lastSlashIndex >= 0) {
                    var path = this.getFullPath(str.substring(0, lastSlashIndex));
                    try {
                        var pathInfo = FS.lookupPath(path).node;
                        if (pathInfo.isFolder) {
                            prefix = str.substring(0, lastSlashIndex + 1);
                            dirPath = path;
                        } else {
                            isValidDir = false;
                        }
                    } catch {
                        isValidDir = false;
                    }
                }
                for (var key of Object.keys(this._registeredCommandsJs)) {
                    if (key.startsWith(tokens[index])) {
                        result.push(key);
                    }
                }
                if (isValidDir) {
                    try {
                        var node = FS.lookupPath(dirPath).node;
                        for (var key of Object.keys(node.contents)) {
                            var fullPath = prefix + key;
                            if (fullPath.startsWith(tokens[index])) {
                                if (node.contents[key].isFolder) {
                                    result.push(fullPath + '/');
                                } else {
                                    result.push(fullPath);
                                }
                            }
                        }
                    } catch {}
                }
            }
            return result;
        });
    }
    
    /////////////////////////////////////////
    // ITerminalAddon plugin API
    /////////////////////////////////////////
    
    activate(term) {
        this.term = term;
        this._disposables.push(this.term.onData(this._handleTermData));
        this._disposables.push(this.term.onResize(this._handleTermResize));
        this._termSize = {
            cols: this.term.cols,
            rows: this.term.rows,
        };
    }
    
    dispose() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
    
    /////////////////////////////////////////
    // User-Facing API
    /////////////////////////////////////////
    
    // Registers commands implemeneted in JS
    registerCommandsJs(classes) {
        // TODO: Log warning on command name conflicts
        // TODO: Maybe make this global so that this isn't done on a per-terminal basis?
        for (var className in classes) {
            var instance = new classes[className];
            if (instance.disabled || !instance.name || !instance.run) {
                continue;
            }
            var commandNames = [];
            if (instance.name) {
                commandNames.push(instance.name);
            }
            if (instance.nameAliases && instance.nameAliases.length) {
                commandNames = commandNames.concat(instance.nameAliases);
            }
            for (var i = 0; i < commandNames.length; i++) {
                this._registeredCommandsJs[commandNames[i]] = classes[className];
            }
        }
    }
    
    getFullPath(path, workingDir) {
        if (path.startsWith('/')) {
            return path;
        } else {
            return (workingDir ? workingDir : this.workingDirectory) + path;
        }
    }
    
    setProcess(proc) {
        this._activeProcess = proc;
        if (proc != null) {
            this.history = null;
        } else {
            this.history = this._historyTemp;
        }
    }
    
    stringToArgs(str) {
        // NOTE: local-echo originally used parse() from shell-quote which is a bit better (https://www.npmjs.com/package/shell-quote / https://github.com/substack/node-shell-quote)
        var args = [];
        var isQuoted = false;
        var wasQuoted = false;
        var currentArg = '';
        str += ' ';// So that we don't have to do an additional arg check after the loop
        for (var i = 0; i < str.length; i++) {
            var c = str[i];
            if (c == '\\' && i < str.length - 1 && str[i + 1] == '"') {
                i++;
                currentArg += '"';
            } else if (c == '"') {
                wasQuoted = true;
                isQuoted = !isQuoted;
            } else if (c == ' ' && !isQuoted) {
                if (currentArg.length || wasQuoted) {
                    args.push(currentArg);
                }
                wasQuoted = false;
                currentArg = '';
            } else {
                currentArg += c;
            }
        }
        return args;
    }
    
    handleCommand(commandString) {
        if (this._activeProcess != null) {
            return false;
        }
        var args = this.stringToArgs(commandString);
        var commandName = args.length > 0 ? args[0] : '';
        args.shift();
        if (WebcsInterop.isRuntimeInitialized) {
            var commandNameExe = commandName.toLowerCase().endsWith('.exe') ? commandName : commandName + '.exe';
            var possibleFullPaths = [this.getFullPath(commandNameExe)];
            if (!commandName.includes('/')) {
                possibleFullPaths.push('/loc/bin/' + commandNameExe);// localStorage
                possibleFullPaths.push('/idb/bin/' + commandNameExe);// IndexedDB
                possibleFullPaths.push('/bin/' + commandNameExe);
            }
            for (var i = 0; i < possibleFullPaths.length; i++) {
                try {
                    var possiblePath = possibleFullPaths[i];
                    var pathInfo = FS.lookupPath(possiblePath);
                    if (!pathInfo.node.isFolder) {
                        commandName = 'dotnet';
                        args.splice(0, 0, possiblePath);
                        break;
                    }
                } catch {}
            }
        }
        if (this._registeredCommandsJs[commandName]) {
            var command = new this._registeredCommandsJs[commandName];
            var process = new TerminalProcess(this);
            this.setProcess(process);
            process.commandJs = command;
            command.process = process;
            command.run(args);
            return true;
        }
        if (commandName.length > 0) {
            this.term.writeln('"' + commandName + '": not found');
        }
        return false;
    }
    
    runReadLoop() {
        this.read(this.workingDirectory + '> ').then((input) => {
            if (!this.handleCommand(input)) {
                this.runReadLoop();
            }
        });
    }
    
    onClose() {
        if (this._activeProcess != null) {
            this._activeProcess.kill();
        }
    }
    
    // Register a handler that will be called to satisfy auto-completion
    addAutocompleteHandler(fn, ...args) {
        this._autocompleteHandlers.push({fn,args});
    }
    
    // Remove a previously registered auto-complete handler
    removeAutocompleteHandler(fn) {
        const idx = this._autocompleteHandlers.findIndex(e => e.fn === fn);
        if (idx === -1) return;
        this._autocompleteHandlers.splice(idx, 1);
    }
    
    // Return a promise that will resolve when the user has completed typing a single line
    read(prompt, continuationPrompt = '> ') {
        return new Promise((resolve, reject) => {
            this.term.write(prompt);
            this._activePrompt = {
                prompt,
                continuationPrompt,
                resolve,
                reject
            };
            this._input = '';
            this._cursor = 0;
            this._active = true;
        });
    }
    
    // Return a promise that will be resolved when the user types a single character.
    // This can be active in addition to `.read()` and will be resolved in priority before it.
    readChar(prompt) {
        return new Promise((resolve, reject) => {
            this.term.write(prompt);
            this._activeCharPrompt = {
                prompt,
                resolve,
                reject
            };
        });
    }
    
    // Abort a pending read operation
    abortRead(reason = 'aborted') {
        if (this._activePrompt != null || this._activeCharPrompt != null) {
            this.term.write('\r\n');
        }
        if (this._activePrompt != null) {
            this._activePrompt.reject(reason);
            this._activePrompt = null;
        }
        if (this._activeCharPrompt != null) {
            this._activeCharPrompt.reject(reason);
            this._activeCharPrompt = null;
        }
        this._active = false;
    }
    
    // Prints a message and changes line
    println(message) {
        this.print(message + '\n');
    }
    
    // Prints a message and properly handles new-lines
    print(message) {
        const normInput = message.replace(/[\r\n]+/g, '\n');
        this.term.write(normInput.replace(/\n/g, '\r\n'));
    }
    
    // Prints a list of items using a wide-format
    printWide(items, padding = 2) {
        if (items.length == 0) return this.println('');
        // Compute item sizes and matrix row/cols
        const itemWidth = items.reduce((width, item) => Math.max(width, item.length), 0) + padding;
        const wideCols = Math.floor(this._termSize.cols / itemWidth);
        const wideRows = Math.ceil(items.length / wideCols);
        // Print matrix
        let i = 0;
        for (let row = 0; row < wideRows; ++row) {
            let rowStr = '';
            // Prepare columns
            for (let col = 0; col < wideCols; ++col) {
                if (i < items.length) {
                    let item = items[i++];
                    item += ' '.repeat(itemWidth - item.length);
                    rowStr += item;
                }
            }
            this.println(rowStr);
        }
    }
    
    /////////////////////////////////////////
    // Utils
    /////////////////////////////////////////
    
    // Detects all the word boundaries on the given input
    wordBoundaries(input, leftSide = true) {
        let match;
        const words = [];
        const rx = /\w+/g;
        while ((match = rx.exec(input))) {
            if (leftSide) {
                words.push(match.index);
            } else {
                words.push(match.index + match[0].length);
            }
        }
        return words;
    }
    
    // The closest left (or right) word boundary of the given input at the given offset.
    closestLeftBoundary(input, offset) {
        const found = this.wordBoundaries(input, true).reverse().find(x => x < offset);
        return found == null ? 0 : found;
    }
    closestRightBoundary(input, offset) {
        const found = this.wordBoundaries(input, false).find(x => x > offset);
        return found == null ? input.length : found;
    }
    
    // Convert offset at the given input to col/row location
    offsetToColRow(input, offset, maxCols) {
        let row = 0, col = 0;
        for (let i = 0; i < offset; ++i) {
            const chr = input.charAt(i);
            if (chr == '\n') {
                col = 0;
                row += 1;
            } else {
                col += 1;
                if (col > maxCols) {
                    col = 0;
                    row += 1;
                }
            }
        }
        return { row, col };
    }
    
    // Counts the lines in the given input
    countLines(input, maxCols) {
        return this.offsetToColRow(input, input.length, maxCols).row + 1;
    }
    
    // Checks the given input for the following:
    // - Input that contains unterminated single quotes
    // - Input that contains unterminated double quotes
    // - Input that ends with '\'
    // - Input that has an incomplete boolean shell expression (&& and ||)
    // - Incomplete pipe expression (|)
    isIncompleteInput(input) {
        // Empty input is not incomplete
        if (input.trim() == '') {
            return false;
        }
        // Check for dangling single-quote strings
        if ((input.match(/'/g) || []).length % 2 !== 0) {
            return true;
        }
        // Check for dangling double-quote strings
        input = input.replaceAll('\\"', '');
        if ((input.match(/"/g) || []).length % 2 !== 0) {
            return true;
        }
        // Check for dangling boolean or pipe operations
        if (input.split(/(\|\||\||&&)/g).pop().trim() == '') {
            return true;
        }
        // Check for tailing slash
        if (input.endsWith('\\') && !input.endsWith('\\\\')) {
            return true;
        }
        return false;
    }
    
    // Returns true if the expression ends on a tailing whitespace
    hasTailingWhitespace(input) {
        return input.match(/[^\\][ \t]$/m) != null;
    }
    
    // Returns the last expression in the given input
    getLastToken(input) {
        // Empty expressions
        if (input.trim() === '') return '';
        if (this.hasTailingWhitespace(input)) return '';
        // Last token
        const tokens = this.stringToArgs(input);
        return tokens.pop() || '';
    }
    
    // Returns the auto-complete candidates for the given input
    collectAutocompleteCandidates(callbacks, input) {
        const tokens = this.stringToArgs(input);
        let index = tokens.length - 1;
        let expr = tokens[index] || '';
        // Empty expressions
        if (input.trim() === '') {
            index = 0;
            expr = '';
        } else if (this.hasTailingWhitespace(input)) {
            // Expressions with danging space
            index += 1;
            expr = '';
        }
        // Collect all auto-complete candidates from the callbacks
        const all = callbacks.reduce((candidates, { fn, args }) => {
            try {
                return candidates.concat(fn(index, tokens, ...args));
            } catch (e) {
                console.error('Auto-complete error:', e);
                return candidates;
            }
        }, []);
        // Filter only the ones starting with the expression
        return all.filter(txt => txt.startsWith(expr));
    }
    
    getSharedFragment(fragment, candidates) {
        // end loop when fragment length = first candidate length
        if (fragment.length >= candidates[0].length) return fragment;
        // save old fragemnt
        const oldFragment = fragment;
        // get new fragment
        fragment += candidates[0].slice(fragment.length, fragment.length+1);
        for (let i = 0; i < candidates.length; i++) {
            if (!candidates[i].startsWith(oldFragment)) {
                // return null when there's a wrong candidate
                return null;
            }
            if (!candidates[i].startsWith(fragment)) {
                return oldFragment;
            }
        }
        return this.getSharedFragment(fragment, candidates);
    }
    
    /////////////////////////////////////////
    // Internal API
    /////////////////////////////////////////
    
    dumpLineStats() {
        let buffer = this.term.buffer.active;
        let numLines = buffer.length;
        for (let i = 0; i < numLines; i++) {
            let line = buffer.getLine(i);
            console.log(i + ' isWrapped:' + line.isWrapped + ' len:' + line.length);
        }
    }
    
    // Clear the screen and set cursor to 0,0
    clearScreen() {
        // Clear the screen
        this.term.write('\x1B[2J');
        // Set the cursor to 0,0
        this.term.write('\x1B[0;0H');
        this._cursor = 0;
        this._input = '';
    }
    
    // Apply prompts to the given input
    applyPrompts(input) {
        const prompt = (this._activePrompt || {}).prompt || '';
        const continuationPrompt = (this._activePrompt || {}).continuationPrompt || '';
        return prompt + input.replace(/\n/g, '\n' + continuationPrompt);
    }
    
    // Advances the `offset` as required in order to accompany the prompt additions to the input.
    applyPromptOffset(input, offset) {
        const newInput = this.applyPrompts(input.substr(0, offset));
        return newInput.length;
    }
    
    // NOTE: clearInput / setInput / setCursor are all quite fragile. Be careful of call order.
    // TODO: Look into hardening this code (it's kinda important this works decently for a terminal-based website)
    
    // Clears the current prompt (erases all the lines that display the current prompt and move the cursor in the beginning of the first line of the prompt)
    clearInput() {
        const currentPrompt = this.applyPrompts(this._input);
        // Get the overall number of lines to clear
        let allRows = this.countLines(currentPrompt, this._termSize.cols-1);
        // Get the line we are currently in
        const promptCursor = this.applyPromptOffset(this._input, this._cursor);
        let { col, row } = this.offsetToColRow(currentPrompt, promptCursor, this._termSize.cols-1);
        // NOTE: '\r\x1B[<row>F]\x1B[J' isn't what we want but '\x1B[K' doesn't clear isWrapped (breaks text on reflow). See https://github.com/xtermjs/xterm.js/issues/1882 / https://github.com/xtermjs/xterm.js/pull/3536
        this.term.write('\r');
        if (row > 0) this.term.write('\x1B[' + row + 'F');
        this.term.write('\x1B[J');// Clear screen from first input line to end of screen (this means input always has to be at bottom of screen)
        /*// First move on the last line
        const moveRows = allRows - row - 1;
        for (var i = 0; i < moveRows; ++i) this.term.write('\x1B[E');
        // Clear current input line(s)
        this.term.write('\r\x1B[K');
        for (var i = 1; i < allRows; ++i) this.term.write('\x1B[F\x1B[K');*/
    }
    
    // Replace input with the new input given (clears all the lines that the current input occupies and then replaces them with the new input)
    setInput(newInput, clearInput = true) {
        // Clear current input
        if (clearInput) this.clearInput();
        // Write the new input lines, including the current prompt
        const newPrompt = this.applyPrompts(newInput);
        this.print(newPrompt);
        // Trim cursor overflow
        if (this._cursor > newInput.length) {
            this._cursor = newInput.length;
        }
        // Move the cursor to the appropriate row/col
        let newCursor = this.applyPromptOffset(newInput, this._cursor);
        let newNumRows = this.countLines(newPrompt, this._termSize.cols-1);//-1 for wrap around
        if (newPrompt.length > 0 && (newPrompt.length % this._termSize.cols) == 0) {
            this.term.write(' \x1B[1K');// Handle wrap around (empty char for a new line and then wipe the empty char)
        }
        const { col, row } = this.offsetToColRow(newPrompt, newCursor, this._termSize.cols-1);
        const moveUpRows = newNumRows - row - 1;
        this.term.write('\r');
        for (var i = 0; i < moveUpRows; ++i) this.term.write('\x1B[F');// Move up to correct row/line
        for (var i = 0; i < col; ++i) this.term.write('\x1B[C');// Move cursor to correct column
        // Replace input
        this._input = newInput;
    }
    
    // Completes the current input, calls the given callback and then re-displays the prompt.
    printAndRestartPrompt(callback) {
        const cursor = this._cursor;
        // Complete input
        this.setCursor(this._input.length);
        this.term.write('\r\n');
        // Prepare a function that will resume prompt
        const resume = () => {
            this._cursor = cursor;
            this.setInput(this._input);
        };
        // Call the given callback to echo something, and if there is a promise returned, wait for the resolution before resuming prompt.
        const ret = callback();
        if (ret == null) {
            resume();
        } else {
            ret.then(resume);
        }
    }
    
    // Set the new cursor position, as an offset on the input string
    setCursor(newCursor) {
        if (newCursor < 0) newCursor = 0;
        if (newCursor > this._input.length) newCursor = this._input.length;
        // Apply prompt formatting to get the visual status of the display
        const inputWithPrompt = this.applyPrompts(this._input);
        const inputLines = this.countLines(inputWithPrompt, this._termSize.cols-1);
        // Estimate previous cursor position
        const prevPromptOffset = this.applyPromptOffset(this._input, this._cursor);
        const { col: prevCol, row: prevRow } = this.offsetToColRow(inputWithPrompt, prevPromptOffset, this._termSize.cols-1);
        // Estimate next cursor position
        const newPromptOffset = this.applyPromptOffset(this._input, newCursor);
        const { col: newCol, row: newRow } = this.offsetToColRow(inputWithPrompt, newPromptOffset, this._termSize.cols-1);
        // Adjust vertically
        if (newRow > prevRow) {
            for (let i = prevRow; i < newRow; ++i) this.term.write('\x1B[B');
        } else {
            for (let i = newRow; i < prevRow; ++i) this.term.write('\x1B[A');
        }
        // Adjust horizontally
        if (newCol > prevCol) {
            for (let i = prevCol; i < newCol; ++i) this.term.write('\x1B[C');
        } else {
            for (let i = newCol; i < prevCol; ++i) this.term.write('\x1B[D');
        }
        // Set new offset
        this._cursor = newCursor;
    }
    
    // Move cursor at given direction
    handleCursorMove(dir) {
        if (dir > 0) {
            const num = Math.min(dir, this._input.length - this._cursor);
            this.setCursor(this._cursor + num);
        } else if (dir < 0) {
            const num = Math.max(dir, -this._cursor);
            this.setCursor(this._cursor + num);
        }
    }
    
    // Erase a character at cursor location
    handleCursorErase(backspace) {
        const { _cursor, _input } = this;
        if (backspace) {
            if (_cursor <= 0) return;
            const newInput = _input.substr(0, _cursor - 1) + _input.substr(_cursor);
            this.clearInput();
            this._cursor -= 1;
            this.setInput(newInput, false);
        } else {
            const newInput = _input.substr(0, _cursor) + _input.substr(_cursor + 1);
            this.setInput(newInput);
        }
    }
    
    // Insert character at cursor location
    handleCursorInsert(data) {
        this.clearInput();
        const { _cursor, _input } = this;
        const newInput = _input.substr(0, _cursor) + data + _input.substr(_cursor);
        this._cursor += data.length;
        this.setInput(newInput, false);
    }
    
    // Handle input completion
    handleReadComplete() {
        let inputWithPrompt = this.applyPrompts(this._input);
        if (this.history) {
            this.history.push(this._input);
        }
        this.setCursor(this._input.length);
        if (inputWithPrompt.length > 0 && (inputWithPrompt.length % this._termSize.cols == 0)) {
            // The cursor is wrapped to the next line (see setInput). Fix up the wrapping.
            // TODO: This should be '\x1B[K' (not '\x1B[J'), see isWrapped / update when this PR is merged https://github.com/xtermjs/xterm.js/pull/3536
            this.term.write('\x1B[F\r\n\x1B[J');
        } else {
            this.term.write('\r\n');
        }
        var tempInput = this._input;
        this._input = '';
        this._cursor = 0;
        if (this._activePrompt) {
            this._activePrompt.resolve(tempInput);
            this._activePrompt = null;
        }
        this._active = false;
    }
    
    // Handle terminal resize
    handleTermResize(data) {
        // Clear the prompt using the previous configuration, update the cached terminal size information and then re-render the input.
        // This leads (most of the times) into a better formatted input.
        const { rows, cols } = data;
        this.clearInput();
        this._termSize = { cols, rows };
        this.setInput(this._input, false);
        this.term.clearSelection();// Selection gets buggy on resize, just clear it.
    }
    
    // Handle terminal input
    handleTermData(data) {
        if (this._activeProcess != null && data.charCodeAt(0) == 0x03) {
            var tempActiveProcess = this._activeProcess;
            if (this._active) {
                this.abortRead();
            }
            // If the process didn't kill itself after the abort read then kill it off now
            if (this._activeProcess == tempActiveProcess) {
                this._activeProcess.kill();
            }
        }
        if (!this._active) return;
        // If we have an active character prompt, satisfy it in priority
        if (this._activeCharPrompt != null) {
            this._activeCharPrompt.resolve(data);
            this._activeCharPrompt = null;
            this.term.write('\r\n');
            return;
        }
        // If this looks like a pasted input, expand it
        if (data.length > 3 && data.charCodeAt(0) !== 0x1B) {
            const normData = data.replace(/[\r\n]+/g, '\r');
            Array.from(normData).forEach(c => this.handleData(c));
        } else {
            this.handleData(data);
        }
    }
    
    // Handle a single piece of information from the terminal.
    handleData(data) {
        if (!this._active) return;
        const ord = data.charCodeAt(0);
        if (ord == 0x1B) {
            this.handleDataAnsiEscapeSequence(data);
        } else if (ord < 32 || ord === 0x7F) {
            this.handleDataSpecialChar(data);
        } else {
            this.handleCursorInsert(data);
        }
    }
    
    // Handles ANSI escape sequences
    handleDataAnsiEscapeSequence(data) {
        let ofs;
        switch (data.substr(1)) {
            case '[A':// Up arrow
                this.scHistoryPrev();
                break;
            case '[B':// Down arrow
                this.scHistoryNext();
                break;
            case '[D':// Left Arrow
                this.scMoveLeftOneChar();
                break;
            case '[C':// Right Arrow
                this.scMoveRightOneChar();
                break;
            case '[3~':// Delete
                this.scDoDelete();
                break;
            case '[F':// End
                this.scGoEnd();
                break;
            case '[H': // Home
                this.scGoHome();
                break;
            case 'd':// Alt+D
                this.scDeleteToNextWord();
                break;
            case 'e':// Alt+E (NOTE: Non-standard as we don't have Ctrl+W available)
                this.scDeleteToPrevWord();
                break;
            case 'b':// Alt+B
                this.scMoveLeftOneWord();
                break;
            case 'f':// Alt+F
                this.scMoveRightOneWord();
                break;
            case '[3;3~':// Alt+Delete
                this.scDeleteToPrevWord();
                break;
            case '[1;5C':// Ctrl+Right (NOTE: Also true for Alt...)
                this.scMoveRightOneWord();
                break;
            case '[1;5D':// Ctrl+Left  (NOTE: Also true for Alt...)
                this.scMoveLeftOneWord();
                break;
        }
    }
    
    // Handle special characters
    handleDataSpecialChar(data) {
        switch (data) {
            case '\r':// Enter
            case '\x0A':// Ctrl+J
            case '\x0D':// Ctrl+M
                this.scDoEnter();
                break;
            case '\x7F':// Backspace
            case '\x08':// Ctrl+H
            case '\x04':// Ctrl+D (This is a EOF prompt. Most terminals delete a char. If no chars are left, they then invoke an EXIT / logout)
                this.scDoBackspace();
                break;
            case '\t':// Tab
                this.scDoTab();
                break;
            case '\x01':// Ctrl+A
                this.scGoHome();
                break;
            case '\x02':// Ctrl+B
                this.scMoveLeftOneChar();
                break;
            case '\x03':// Ctrl+C (kill process via SIGINT signal)
                this.scDoKillProcess();
                break;
            case '\x05':// Ctrl+E
                this.scGoEnd();
                break;
            case '\x06':// Ctrl+F
                this.scMoveRightOneChar();
                break;
            case '\x07':// Ctrl+G
                this.scHistoryCancelSearch();
                break;
            case '\x0B':// Ctrl+K
                this.scCutLineAtCursor();
                break;
            case '\x0C':// Ctrl+L
                this.scClearScreen();
                break;
            case '\x10':// Ctrl+P
                this.scHistoryPrev();
                break;
            case '\x15':// Ctrl+U
                this.scCutLineBeforeCursor();
                break;
            case '\x19':// Ctrl+Y
                this.scPasteFromTerminalClipboard();
                break;
        }
    }
    
    /////////////////////////////////////////
    // Shortcut functions
    /////////////////////////////////////////
    
    scHistoryPrev() {
        if (this.history) {
            let value = this.history.getPrevious();
            if (value) {
                this.setInput(value);
                this.setCursor(value.length);
            }
        }
    }
    
    scHistoryNext() {
        if (this.history) {
            let value = this.history.getNext();
            if (!value) value = '';
            this.setInput(value);
            this.setCursor(value.length);
        }
    }
    
    scHistoryCancelSearch() {
        if (this.history) this.history.rewind();
        this.setInput('');
    }
    
    scMoveLeftOneChar() {
        this.handleCursorMove(-1);
    }
    
    scMoveRightOneChar() {
        this.handleCursorMove(1);
    }
    
    scMoveLeftOneWord() {
        let ofs = this.closestLeftBoundary(this._input, this._cursor);
        if (ofs != null) this.setCursor(ofs);
    }
    
    scMoveRightOneWord() {
        let ofs = this.closestRightBoundary(this._input, this._cursor);
        if (ofs != null) this.setCursor(ofs);
    }

    scDeleteToPrevWord() {
        let ofs = this.closestLeftBoundary(this._input, this._cursor);
        if (ofs != null) {
            this.setInput(this._input.substr(0, ofs) + this._input.substr(this._cursor));
            this.setCursor(ofs);
        }
    }
    
    scDeleteToNextWord() {
        let ofs = this.closestRightBoundary(this._input, this._cursor);
        if (ofs != null) {
            this.setInput(this._input.substr(0, this._cursor) + this._input.substr(ofs));
        }
    }
    
    scGoEnd() {
        this.setCursor(this._input.length);
    }
    
    scGoHome() {
        this.setCursor(0);
    }
    
    scDoKillProcess() {
        this.setCursor(this._input.length);
        if (!this.silentCtrlC) {
            // Inserting '^C' at the current cursor position is the most common implementation. Silent is also semi-popular (at least on the shell itself)
            this.handleCursorInsert('^C');
        }
        this.term.write('\r\n' + ((this._activePrompt || {}).prompt || ''));
        this._input = '';
        this._cursor = 0;
        if (this.history) this.history.rewind();
    }
    
    scCutLineBeforeCursor() {
        this._clipboard = this._input.substring(0, this._cursor);
        this.setInput(this._input.substring(this._cursor));
        this.setCursor(0);
    }
    
    scCutLineAtCursor() {
        this._clipboard = this._input.substring(this._cursor);
        this.setInput(this._input.substring(0, this._cursor));
        this.setCursor(this._input.length);
    }
    
    scPasteFromTerminalClipboard() {
        if (this._clipboard) {
            this.handleCursorInsert(this._clipboard);
        }
    }
    
    // Clears the screen (and preserves the active input / cursor position)
    scClearScreen() {
        let tempCursor = this._cursor;
        let tempInput = this._input;
        this.clearScreen();
        this.setInput(tempInput);
        this.setCursor(tempCursor);
    }
    
    scReset() {
        this.term.write('\x1Bc');
    }
    
    scDoEnter() {
        if (this.isIncompleteInput(this._input)) {
            this.handleCursorInsert('\n');
        } else {
            this.handleReadComplete();
        }
    }
    
    scDoBackspace() {
        this.handleCursorErase(true);
    }
    
    scDoDelete() {
        this.handleCursorErase(false);
    }
    
    scDoTab() {
        if (this._autocompleteHandlers.length == 0) {
            this.handleCursorInsert('    ');
        } else {
            const inputFragment = this._input.substr(0, this._cursor);
            //const hasTailingSpace = this.hasTailingWhitespace(inputFragment);
            const candidates = this.collectAutocompleteCandidates(this._autocompleteHandlers, inputFragment);
            // Sort candidates
            //candidates.sort(); - removed... don't really need this (and we want commands before files / folders)
            // Depending on the number of candidates, we are handing them in a different way.
            if (candidates.length === 0) {
                //// No candidates? Just add a space if there is none already
                //if (!hasTailingSpace) {
                //    this.handleCursorInsert(' ');
                //}
            } else if (candidates.length === 1) {
                // Just a single candidate? Complete
                const lastToken = this.getLastToken(inputFragment);
                this.handleCursorInsert(candidates[0].substr(lastToken.length));// + ' ');
            }
            else if (candidates.length <= this.maxAutocompleteEntries) {
                // search for a shared fragement
                const sameFragment = this.getSharedFragment(inputFragment, candidates);
                // if there's a shared fragement between the candidates print complete the shared fragment
                if (sameFragment) {
                    const lastToken = this.getLastToken(inputFragment);
                    this.handleCursorInsert(sameFragment.substr(lastToken.length));
                }
                // If we are less than maximum auto-complete candidates, print them to the user and re-start prompt
                this.printAndRestartPrompt(() => {
                    this.printWide(candidates);
                });
            } else {
                // If we have more than maximum auto-complete candidates, print them only if the user acknowledges a warning
                this.printAndRestartPrompt(() => {
                    this.readChar(`Display all ${candidates.length} possibilities? (y or n)`).then(yn => {
                        if (yn == 'y' || yn == 'Y') {
                            this.printWide(candidates);
                        }
                    });
                });
            }
        }
    }
}