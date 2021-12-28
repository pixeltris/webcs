/*
- dockpanel was taken from https://phosphorjs.github.io/examples/dockpanel/bundle.js on 3rd December 2020
- menus was taken from http://phosphorjs.github.io/examples/menus/bundle.js on 3rd December 2020
- Tweaks to dockpanel:
  - Removed CodeMirrorWidget
  - useAltTextOnTabs (adds an alt tooltip when hovering tabs)
  - contextMenuCloserToMouse (moves context menu closer to mouse y coord if overlapping window height (rather than moving upwards entire height of context menu))
  - useTooltipOnTabs (adds a tooltip when hovering tabs)
  - window.dockInstance (to get the docking in global scope (for better or worse))
  - added TabBar._evtContextMenu event / item onContextMenu function so that we can right click dock tabs. also "ctrl + left click" activates this
  - moved TabBar._evtMouseDown "event.preventDefault()" after close btn check so we don't consume css :after
  - added item onFocus function and p-mod-current-active to denote which tab content is focused (invoked from currentItem setter)
  - added TabBar._getDockInstance/_updateFocusedTab
  - added DockPanel.onTabBarUpdated/onContextMenu
  - added DockPanel.splittingWidget / change insertSplit->insertSplitImpl
  - changed MenuItemPrivate initFrom to use Object.assign
  - TabBar._evtMouseDown changed to allow right mouse button to focus the tab
  - TabBar._evtMouseUp hooked up to 'mouseup' event and added middle click tab close handler (as _evtClick doesn't seem to include middle mouse)
  - Enable right click on context menu items (Menu._evtMouseUp) - functionality to be the same as left click
*/
var useAltTextOnTabs = false;
var contextMenuCloserToMouse = true;
var useTooltipOnTabs = true;
var gTooltip = null;
var dockInstance = null;
var activeThemeName = null;
var baseDocumentTitle = document.title;
var nextTerminalId = 1;
var nextTabId = 1;
var widgetsByTabId = new Map();

const TabType_Terminal = 1;
const TabType_TextEditor = 2;

function uiTerminalWriteLine(tabId, str) {
    var widget = widgetsByTabId.get(tabId);
    if (widget && widget.tabType == TabType_Terminal) {
        var controller = getTerminalController(widget);
        if (controller != null) {
            controller.println(str);
        }
    }
}

function uiCloseTab(tabId) {
    var widget = widgetsByTabId.get(tabId);
    if (widget) {
        widget.close();
    }
}

function uiSetTabTitle(tabId, title) {
    var widget = widgetsByTabId.get(tabId);
    if (widget) {
        widget.title.text = title;
    }
}

function uiGetTabTitle(tabId) {
    var widget = widgetsByTabId.get(tabId);
    if (widget) {
        return widget.title.text;
    }
    return '';
}

function uiGetActiveTabId() {
    var widgets = getWidgetsByVisitTime(dockInstance.layout);
    if (widgets.length > 0) {
        return widgets[0].tabId;
    }
    return 0;
}

function uiGetTabWorkingDirectory(tabId) {
    var widget = widgetsByTabId.get(tabId);
    if (widget && widget.tabType == TabType_Terminal) {
        var controller = getTerminalController(widget);
        if (controller != null) {
            return controller.workingDirectory;
        }
    }
    return '';
}

function uiGetAssemblyOffsetSize(name) {
    var fi = WebcsInterop.allFilesByName[name];
    if (fi) {
        return fi.offset + ',' + fi.size;
    }
    return 0;
}

function uiGetProcessById(processId) {
    var widgets = getWidgets(dockInstance.layout);
    for (var i = 0; i < widgets.length; i++) {
        var widget = widgets[i];
        if (widget.tabType == TabType_Terminal) {
            var controller = getTerminalController(widget);
            if (controller != null) {
                if (controller._activeProcess != null && controller._activeProcess.id == processId) {
                    return controller._activeProcess;
                }
            }
        }
    }
    return null;
}

function uiProcessExit(processId, exitCode) {
    var process = uiGetProcessById(processId);
    if (process != null) {
        process.exit(exitCode);
    }
}

function uiProcessKill(processId) {
    var process = uiGetProcessById(processId);
    if (process != null) {
        process.kill();
    }
}

function uiProcessReadLine(processId, promptText) {
    if (!WebcsInterop.webcsOnReadLine) {
        return;
    }
    var process = uiGetProcessById(processId);
    if (process != null) {
        if (!promptText) {
            promptText = '';//promptText = 'TODO: fetch prompt from current output';
        }
        process.controller.read(promptText).then(str => {
            WebcsInterop.webcsOnReadLine(process.controller.widget.tabId, processId, str);
        });
    }
}

function getUniqueTerminalName() {
    return 'Term' + (nextTerminalId++);
}

function getDefaultTerminalName() {
    return 'Term';//getUniqueTerminalName();
}

function getTerminalController(widget) {
    var addons = widget.terminal._addonManager._addons;
    for (var i = 0; i < addons.length; i++) {
        if (!addons[i].isDisposed && addons[i].instance.constructor.name == 'TerminalController') {
            return addons[i].instance;
        }
    }
    return null;
}

function clientViewportRect() {
	var elem = document.documentElement;
	var x = window.pageXOffset;
	var y = window.pageYOffset;
	var width = elem.clientWidth;
	var height = elem.clientHeight;
	return { x: x, y: y, width: width, height: height };
}

function getTabBarFromWidget(widget) {
    var item = widget;
    while (item != null) {
        if (item.tabBar != null) {
            return item.tabBar;
        }
        item = item.parent;
    }
    return null;
}

function getTabFromWidget(widget) {
    var tabBar = getTabBarFromWidget(widget);
    if (tabBar != null) {
        var index = tabBar.itemIndex(widget);
        if (index >= 0) {
            return tabBar.tabAt(index);
        }
    }
    return null;
}

function focusWidget(widget) {
    var tabBar = getTabBarFromWidget(widget);
    if (tabBar != null) {
        tabBar.currentItem = widget;
        onFocusWidget(dockInstance.layout, widget);
    }
}

function focusMostRecentWidget() {
    var widgets = getWidgetsByVisitTime(dockInstance.layout);
    if (widgets.length > 0) {
        focusWidget(widgets[0]);
    }
}

function onFocusWidget(layout, targetWidget) {
	var widgetsToVisit = [];
	var allWidgets = [];
	var tabBars = [];
	widgetsToVisit.push(layout);
	allWidgets.push(layout);
    var focusedWidget = null;
	while (widgetsToVisit.length > 0) {
		var widget = widgetsToVisit[0];
		switch (widget.constructor.name) {
			case 'StackedLayout':
			case 'DockSplitPanel':
				var children = widget._children ? widget._children : widget.layout ? widget.layout._children : null;
				if (children) {
					for (var i = 0; i < children.length; i++) {
						var child = children[i];
						if (!allWidgets.includes(child)) {
							widgetsToVisit.push(child);
							allWidgets.push(child);
						}
					}
				}
				break;
			case 'DockTabPanel':
				var tabBar = widget._tabBar;
				if (!tabBars.includes(tabBar)) {
					tabBars.push(tabBar);
                    for (var i = 0; i < tabBar._items.length; i++) {
                        if (tabBar._items[i] == targetWidget) {
                            focusedWidget = targetWidget;
                            tabBar._tabs[i].classList.add(CURRENT_CLASS_FOCUSED);
                            if (tabBar._items[i].customContent != null) {
                                tabBar._items[i].customContent.onFocus(tabBar._items[i]);
                            }
                        } else {
                            if (tabBar._items[i].customContent != null && tabBar._tabs[i].classList.contains(CURRENT_CLASS_FOCUSED)) {
                                tabBar._items[i].customContent.onFocusLost(tabBar._items[i]);
                            }
                            tabBar._tabs[i].classList.remove(CURRENT_CLASS_FOCUSED);
                        }
                    }
				}
				break;
		}
		widgetsToVisit.shift();
	}
    if (focusedWidget != null) {
        focusedWidget.lastFocusTime = Date.now();
    }
    if (layout.parent != null && layout.parent instanceof libUI.DockPanel) {
        layout.parent.focusedWidget = focusedWidget;
    }
    // NOTE: Some tabs aren't that useful. Maybe leave it up to the user to change the title? TODO: Some API or something?
    //document.title = baseDocumentTitle + ' - ' + focusedWidget.title.text;
}

function getWidgetsByVisitTime(layout) {
    var widgets = getWidgets(layout);
    widgets.sort(function(a, b) {
        return b.lastFocusTime - a.lastFocusTime;
    });
    return widgets;
}

function getWidgets(layout, tabType/*optional*/, name/*optional*/, tabTag/*optional*/) {
	var widgetsToVisit = [];
	var allWidgets = [];
	var tabBars = [];
	var widgets = [];
	widgetsToVisit.push(layout);
	allWidgets.push(layout);
	while (widgetsToVisit.length > 0) {
		var widget = widgetsToVisit[0];
		switch (widget.constructor.name) {
			case 'StackedLayout':
			case 'DockSplitPanel':
				var children = widget._children ? widget._children : widget.layout ? widget.layout._children : null;
				if (children) {
					for (var i = 0; i < children.length; i++) {
						var child = children[i];
						if (!allWidgets.includes(child)) {
							widgetsToVisit.push(child);
							allWidgets.push(child);
						}
					}
				}
				break;
			case 'DockTabPanel':
				var tabBar = widget._tabBar;
				if (!tabBars.includes(tabBar)) {
					tabBars.push(tabBar);
					for (var i = 0; i < tabBar._items.length; i++) {
                        var match = true;
                        if (name && tabBar._items[i].title.text != name) {
                            match = false;
                        }
						if (tabType && tabBar._items[i].tabType != tabType) {
							match = false;
						}
                        if (tabTag && tabBar._items[i].tabTag != tabTag) {
                            match = false;
                        }
                        if (match) {
                            widgets.push(tabBar._items[i]);
                        }
					}
				}
				break;
		}
		widgetsToVisit.shift();
	}
	return widgets;
}

function createTextEditor(widget, options) {
    var lang = '';
    var textStr = '';
    if (options != null && options.filePath != null) {
        try {
            textStr = FS.readFile(options.filePath, { encoding: 'utf8' });
        } catch {}
        var dotIndex = options.filePath.lastIndexOf('.');
        if (dotIndex > 0) {
            lang = options.filePath.substring(dotIndex + 1).trim().toLowerCase();
            switch (lang) {
                case 'cs': lang = 'csharp'; break;
                case 'csproj': lang = 'xml'; break;
                case 'md': lang = 'markdown'; break;
            }
        }
    }
    require(['vs/editor/editor.main'], function () {
        let editor = monaco.editor.create(widget.node, {
            value: textStr,
            language: lang,
            theme: 'vs',
            automaticLayout: true
        });
        editor.updateOptions({ autoClosingBrackets: false });// TODO: Make this configurable
        // This most certainly isn't the correct way to do this, but nothing else seems to work!
        editor._focusTracker.onChange((e) => {
            if (editor._focusTracker._hasFocus) {
                onFocusWidget(dockInstance.layout, widget);
            }
        });
        widget.onFocus = function() {
            if (editor._focusTracker._hasFocus) {
                // When moving tabs around there's a bug which stops the tab gaining focus, enforce focus.
                // This might fire twice (due to the editor.focus call), but that's ok.
                onFocusWidget(dockInstance.layout, widget);
            }
            editor.focus();
        };
        editor.getModel().onDidChangeContent((event) => {
            if (!widget.isFileModified) {
                widget.title.text += '*';
                widget.isFileModified = true;
                //focusWidget(widget);
            }
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, function() {
            miWidgetSaveFile(widget);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Q, function() {
            widget.close();
        });
        widget.monaco = editor;
        widget.isFileModified = false;
        if (options != null) {
            widget.filePath = options.filePath;
            editor.focus();
        }
        setThemeMonaco(widget);
    });
}

function showTerminalHelp(term) {
    term.writeln(webProjectName + ' ' + webProjectVersion);
    term.writeln(webProjectRepoUrl);
    term.writeln('');
    term.writeln('See the link above or `dotnet help`');
    term.writeln('');
}

function createXTerm(widget, options) {
    var fitAddon = new FitAddon.FitAddon();
    var term = new Terminal({
        fontSize:13,
        fontFamily:'Consolas, courier-new, courier, monospace',
        //rendererType: 'dom',
    });
    widget.terminal = term;
    term.uiWidget = widget;
    setThemeXTerm(widget);
    term.loadAddon(fitAddon);
    term.open(widget.node);
    widget.onResize = function(msg) {
        fitAddon.fit();
    };
    widget.onFocus = function() {
        term.focus();
    };
    term._core.onFocus(function(event) {
        // This isn't really documented anywhere? Is this the correct way to listen for focus?
        onFocusWidget(dockInstance.layout, widget);
    });
    if (options != null && options.showTerminalHelp) {
        showTerminalHelp(term);
    }

    var controller = new TerminalController();
    controller.workingDirectory = options != null && options.path ? options.path : '/';
    controller.widget = widget;
    widget.onCloseRequestConfirm = widget.onCloseRequest;
    widget.onCloseRequest = function(msg) {
        controller.onClose();
        widget.onCloseRequestConfirm(msg);
    };
    term.loadAddon(controller);
    controller.runReadLoop();
    
    // Doing this as a timeout as there's some bug calling fit directly (even after making sure widget is added to dock instance)
    // NOTE: Also some bug in firefox where terminal doesn't render on low timeouts? wtf?
    setTimeout(function() { fitAddon.fit(); }, 100);
}

function setWidgetFocusHandler(widget) {
    widget.node.onmousedown = function(event) {
        onFocusWidget(dockInstance.layout, widget);
    };
    widget.onFocus = function(tab) {
        if (document.activeElement) {
            document.activeElement.blur();
        }
        onFocusWidget(dockInstance.layout, widget);
    };
}

function createContent(title, tabType, options) {
    if (!tabType) {
        tabType = TabType_Terminal;
    }
    var widget = new libUI.Widget();
    widget.addClass('content');
    widget.lastFocusTime = Date.now();
    widget.title.text = title;
	widget.title.description = options && options.description ? options.description : '';
    widget.title.closable = true;
	widget.tabType = tabType;
    widget.tabTag = null;
    widget.tabId = nextTabId++;
	//widget.node.style.overflow = 'auto';
    widget.onContextMenu = function(event) {
        openMainContextMenu(event, widget);
    };
	switch (tabType) {
		case TabType_Terminal:
			createXTerm(widget, options);
			break;
		case TabType_TextEditor:
            createTextEditor(widget, options);
			break;
	}
    widgetsByTabId.set(widget.tabId, widget);
    widget.onCloseRequestOriginalForRemoveTabId = widget.onCloseRequest;
    widget.onCloseRequest = function(msg) {
        widgetsByTabId.delete(widget.tabId);
        widget.onCloseRequestOriginalForRemoveTabId(msg);
        if (WebcsInterop.webcsOnTabClosed) {
            WebcsInterop.webcsOnTabClosed(widget.tabId);
        }
    };
    return widget;
}

///////////////////////////////////////////////////////
// BEGIN MenuItem handlers
///////////////////////////////////////////////////////

function miOpenNewTerminal(item) {
    var widget = createContent(getDefaultTerminalName(), TabType_Terminal, { showTerminalHelp: getWidgets(dockInstance.layout).length == 0 });
    if (dockInstance.focusedWidget != null) {
        dockInstance.insertTabAfter(widget, dockInstance.focusedWidget);
    } else {
        dockInstance.insertTabAfter(widget);
    }
    focusWidget(widget);
}

function miTabFocus(item) {
    focusWidget(item.widget);
}

function miTabCloseAll(item) {
    var widgets = getWidgets(dockInstance.layout);
    for (var i = 0; i < widgets.length; i++) {
        widgets[i].close();
    }
}

function miTabClose(item) {
    if (item.widget != null) {
        item.widget.close();
    }
}

function miTabCloseTabGroup(item) {
    if (item.widget != null) {
        var tabBar = getTabBarFromWidget(item.widget);
        var items = tabBar._items.slice();
        for (var i = 0; i < items.length; i++) {
            var widget = items[i];
            widget.close();
        }
    }
}

function miTabCloseAllButThisInTabGroup(item) {
    if (item.widget != null) {
        var tabBar = getTabBarFromWidget(item.widget);
        var items = tabBar._items.slice();
        for (var i = 0; i < items.length; i++) {
            var widget = items[i];
            if (widget != item.widget) {
                widget.close();
            }
        }
    }
}

function miTabCloseAllButThisEverywhere(item) {
    var widgets = getWidgets(dockInstance.layout);
    for (var i = 0; i < widgets.length; i++) {
        if (widgets[i] != item.widget) {
            widgets[i].close();
        }
    }
}

function miTabCloseAllButThisEverywhereKeepGroup(item) {
    if (item.widget != null) {
        var tabGroup = getTabBarFromWidget(item.widget);
        var widgets = getWidgets(dockInstance.layout);
        for (var i = 0; i < widgets.length; i++) {
            if (getTabBarFromWidget(widgets[i]) != tabGroup) {
                widgets[i].close();
            }
        }
    }
}

function miTabCopyFullPath(item) {
    if (navigator.clipboard != null && item.widget != null) {
        if (item.widget.tabType == TabType_TextEditor && item.widget.filePath != null) {
            navigator.clipboard.writeText(item.widget.filePath);
        } else if (item.widget.tabType == TabType_Terminal) {
            var controller = getTerminalController(item.widget);
            if (controller != null) {
                navigator.clipboard.writeText(controller.workingDirectory);
            }
        }
    }
}

function miTerminalCopyBuffer(item, copyFullBuffer) {
    if (navigator.clipboard != null && item.widget != null && item.widget.terminal != null) {
        var buffer = item.widget.terminal.buffer.active;
        var str = '';
        var begin = 0;
        var end = buffer.length;
        if (copyFullBuffer) {
            begin = buffer._buffer.ydisp;
            end = begin + buffer._buffer._rows;
        }
        for (var i = begin; i < end; i++) {
            var line = buffer._buffer.lines._array[i];
            var lineText = buffer._buffer.translateBufferLineToString(i, true);
            if (str && !line.isWrapped) {
                str += '\n';
            }
            str += lineText;
        }
        while (str.endsWith('\n')) {
            str = str.substring(0, str.length - 1);
        }
        navigator.clipboard.writeText(str);
    }
}

function miTerminalCopyBufferVisibleOnly(item) {
    miTerminalCopyBuffer(item, true);
}

function miClearScreenOrReset(item, clearScreen, reset) {
    if (item.widget != null && item.widget.terminal != null) {
        var controller = getTerminalController(item.widget);
        if (controller != null) {
            if (clearScreen) {
                controller.scClearScreen();
            } else {
                controller.scReset();
            }
        }
    }
}

function miTerminalClear(item) {
    miClearScreenOrReset(item, true, false);
}

function miTerminalReset(item) {
    miClearScreenOrReset(item, false, true);
}

function miWidgetSaveFile(widget) {
    if (widget.monaco != null && widget.filePath != null) {
        if (widget.isFileModified) {
            try {
                FS.writeFile(widget.filePath, widget.monaco.getValue());
            } catch {}
            widget.isFileModified = false;
            widget.title.text = widget.title.text.substring(0, widget.title.text.length - 1);
        }
    }
}

function miTabSaveFile(item) {
    if (item.widget != null) {
        miWidgetSaveFile(widget);
    }
}

function miTabSaveFileAllInTabGroup(item) {
    if (item.widget != null) {
        var tabBar = getTabBarFromWidget(item.widget);
        for (var i = 0; i < tabBar._items.length; i++) {
            var widget = tabBar._items[i];
            if (widget.tabType == TabType_TextEditor) {
                miWidgetSaveFile(widget);
            }
        }
    }
}

function miTabSaveFileAll(item) {
    var widgets = getWidgets(dockInstance.layout);
    for (var i = 0; i < widgets.length; i++) {
        var widget = widgets[i];
        if (widget.tabType == TabType_TextEditor) {
            miWidgetSaveFile(widget);
        }
    }
}

function miTabReloadFile(item) {
    if (item.widget != null && item.widget.monaco != null && item.widget.filePath != null) {
        try {
            var str = FS.readFile(item.widget.filePath, { encoding: 'utf8' });
            item.widget.monaco.setValue(str);
            if (item.widget.isFileModified) {
                item.widget.isFileModified = false;
                item.widget.title.text = item.widget.title.text.substring(0, item.widget.title.text.length - 1);
            }
        } catch {}
    }
}

function openMainContextMenu(event, tabRef) {
    event.preventDefault();
    var widgets = getWidgetsByVisitTime(dockInstance.layout);
    var menuItems = [
        new libMenus.MenuItem({
            text: 'New terminal',
            //shortcut: 'Ctrl+N',
            handler: miOpenNewTerminal
        })
    ];
    if (widgets.length > 0) {
        // Only add the tabs/close tabs if there are any tabs to view/close...
        var tabsMenuItems = [];
        for (var i = 0; i < widgets.length; i++) {
            tabsMenuItems.push(new libMenus.MenuItem({
                text: widgets[i].title.text,
                icon: dockInstance.focusedWidget == widgets[i] ? 'fas fa-minus' : '',
                handler: miTabFocus,
                widget: widgets[i]
            }));
        }
        menuItems.push(new libMenus.MenuItem({
            text: 'Tabs',
            submenu: new libMenus.Menu(tabsMenuItems)
        }));
        var closeTabsMenuItems = [];
        if (tabRef != null) {
            closeTabsMenuItems.push(new libMenus.MenuItem({
                text: 'This tab',
                handler: miTabClose,
                widget: tabRef
            }));
            closeTabsMenuItems.push(new libMenus.MenuItem({
                text: 'This tab group',
                handler: miTabCloseTabGroup,
                widget: tabRef
            }));
            closeTabsMenuItems.push(new libMenus.MenuItem({
                text: 'All but this tab',
                handler: miTabCloseAllButThisEverywhere,
                widget: tabRef
            }));
            closeTabsMenuItems.push(new libMenus.MenuItem({
                text: 'All but this tab group',
                handler: miTabCloseAllButThisEverywhereKeepGroup,
                widget: tabRef
            }));
            closeTabsMenuItems.push(new libMenus.MenuItem({
                text: 'All but this tab (in tab group)',
                handler: miTabCloseAllButThisInTabGroup,
                widget: tabRef
            }));
        }
        closeTabsMenuItems.push(new libMenus.MenuItem({
            text: 'All',
            handler: miTabCloseAll,
            widget: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close',
            submenu: new libMenus.Menu(closeTabsMenuItems)
        }));
    }
    if (tabRef) {
        menuItems.push(new libMenus.MenuItem({
            type: libMenus.MenuItem.Separator
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Copy full path',
            handler: miTabCopyFullPath,
            widget: tabRef
        }));
        if (tabRef.tabType == TabType_Terminal) {
            menuItems.push(new libMenus.MenuItem({
                type: libMenus.MenuItem.Separator
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Copy buffer',
                handler: miTerminalCopyBuffer,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Copy visible buffer',
                handler: miTerminalCopyBufferVisibleOnly,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Clear',
                handler: miTerminalClear,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Reset',
                handler: miTerminalReset,
                widget: tabRef
            }));
        }
        if (tabRef.tabType == TabType_TextEditor) {
            menuItems.push(new libMenus.MenuItem({
                type: libMenus.MenuItem.Separator
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save',
                shortcut: 'Ctrl+S',
                handler: miTabSaveFile,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save All (in tab group)',
                handler: miTabSaveFileAllInTabGroup,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save All (everywhere)',
                handler: miTabSaveFileAll,
                widget: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Reload',
                //shortcut: 'Ctrl+Alt+R',
                handler: miTabReloadFile,
                widget: tabRef
            }));
        }
    }
    var contextMenu = new libMenus.Menu(menuItems);
    contextMenu.popup(event.clientX, event.clientY);
}

///////////////////////////////////////////////////////
// END MenuItem handlers
///////////////////////////////////////////////////////

function setThemeShared(widget) {
    if (widget) {
        widget.node.style.backgroundColor = sharedThemes[themeThemes[activeThemeName].shared].widgetBackground;
    } else {
        // Put any common theme changes here
    }
}

function setThemeMonaco(widget) {
    widget.monaco._themeService.setTheme(themeThemes[activeThemeName].monaco);
}

function setThemeXTerm(widget) {
    setThemeShared(widget);
    var widgetBg = xtermThemes[themeThemes[activeThemeName].xterm].widgetBackground;
    if (widgetBg) {
        widget.node.style.backgroundColor = widgetBg;
    }
    if (widget.terminal != null) {
        widget.terminal.setOption('theme', xtermThemes[themeThemes[activeThemeName].xterm]);
    }
}

function setThemeCss(elementName, urls, themeName) {
    var element = document.getElementById(elementName);
    if (element != null && urls.has(themeName)) {
        element.setAttribute('href', urls.get(themeName));
    }
}

function setTheme(themeName) {
    var theme = themeThemes[themeName];
    if (!theme) {
        console.log('Invalid theme "' + themeName + '"');
        return;
    }
    if (theme) {
        activeThemeName = themeName;
        setThemeCss('phosphor-dockpanel-theme', phosphorDockpanelThemeUrls, theme.phosphorDockpanel);
        setThemeCss('phosphor-menu-theme', phosphorMenuThemeUrls, theme.phosphorMenu);
        setThemeShared();
        if (dockInstance == null) {
            return;
        }
        var widgets = getWidgets(dockInstance.layout);
        for (var i = 0; i < widgets.length; i++) {
            var widget = widgets[i];
            switch (widget.tabType) {
                case TabType_Terminal:
                    setThemeXTerm(widget);
                    break;
                case TabType_TextEditor:
                    setThemeMonaco(widget);
                    break;
            }
        }
    }
}

function getWebProjectRepoUrl() {
    return webProjectRepoUrl;
}

function getWebProjectRepoUrlForFile(path, branch) {
    return getWebProjectRepoUrl() + '/' + (branch || webProjectRepoDefaultBranch) + '/' + path;
}

function initUI() {
    document.getElementById('pageLoadingDiv').remove();
    document.body.onkeydown = function(event) {
        // Prevent unintuitive key presses on body focus (such as tab)
        if (event.keyCode == 9) {
            event.preventDefault();
        }
    };
    document.body.oncontextmenu = function(event) {
        var widgets = getWidgets(dockInstance.layout);
        if (widgets.length == 0) {
            event.preventDefault();
            openMainContextMenu(event);
        }
    };
    var term1 = createContent('Term', TabType_Terminal, { showTerminalHelp: true });
    var term2 = createContent('Term', TabType_Terminal, { showTerminalHelp: true });
    dockInstance = new libUI.DockPanel();
    dockInstance.useAltTextOnTabs = true;
    dockInstance.focusedWidget = null;
    dockInstance.id = 'main';
    //dockInstance.insertTop(term1);
    //dockInstance.insertBottom(term2, term1);
    dockInstance.insertLeft(term1);
    dockInstance.insertRight(term2, term1);
    dockInstance.onContextMenu = openMainContextMenu;
    dockInstance.onTabBarUpdated = function(tabBar) {
        // If the focused widget belongs to the closed tab bar then focus the most recently visited widget
        if (getWidgets(dockInstance.layout).length == 0) {
            dockInstance.focusedWidget = null;
        }
        if (tabBar._items.length == 0 && (dockInstance.focusedWidget == null || dockInstance.focusedWidget.parent.parent.tabBar == tabBar)) {
            focusMostRecentWidget();
        }
    };
    dockInstance.attach(document.body);
    focusWidget(term1);//focusMostRecentWidget();
	
	var tooltip = document.createElement('div');
	tooltip.className = 'p-Tooltip';
	tooltip.borderPadding = 20;// Padding for the entire window (for really long tooltips)
	tooltip.xOffset = 0;
	tooltip.yOffset = 24;
	tooltip.delay = 800;
	tooltip.ellipsisTolerance = 3;// Ellipsis calculation isn't always accurate, add some tolerance
	tooltip.showOnlyOnEllipsis = false;
	tooltip.style.marginRight = tooltip.borderPadding + 'px';
	tooltip.ref = null;
	document.body.appendChild(tooltip);
	tooltip.show = function(x, y, ref, text) {
		this.ref = ref;
		this.style.display = 'block';
		this.isActive = true;
		if (this.showOnlyOnEllipsis && ref != null && ref.clientWidth < parseInt(getComputedStyle(ref).maxWidth) - this.ellipsisTolerance) {
			this.style.display = 'none';
			return;
		}
		if (text != null) {
			this.setText(text);
		}
		this.style.left = 0;
		this.style.top = 0;
		var size = this.measure(text);
		var rect = clientViewportRect();
		if (x + size.width > rect.x + rect.width) {
			this.style.left = Math.max(this.borderPadding, rect.x + rect.width - size.width - this.borderPadding);
			this.style.top = y;
		} else {
			this.style.left = x;
			this.style.top = y;
		}
	};
	tooltip.measure = function(text) {
		this.style.display = 'block';
		this.style.overflowWrap = 'normal';
		var rect = this.getBoundingClientRect();
		this.style.overflowWrap = 'anywhere';
		return { width: rect.width, height: rect.height };
	};
	tooltip.hide = function() {
		this.isActive = false;
		this.style.display = 'none';
	};
	tooltip.isVisible = function() {
		return this.style.display !== 'none';
	};
	tooltip.setText = function(text) {
		this.textContent = text;
	};
	tooltip.hide();
	window.gTooltip = tooltip;
	
    window.onresize = function () {
		dockInstance.update();
	};
}