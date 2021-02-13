var useAltTextOnTabs = false;
var contextMenuCloserToMouse = true;
var useTooltipOnTabs = true;
var gTooltip = null;
var dockInstance = null;
var recentTabs = [];
var activeThemeName = null;
var baseDocumentTitle = document.title;

const TabType_CustomContent = 1;// Empty (add custom content yourself)
const TabType_Terminal = 2;
const TabType_TextEditor = 3;
const TabType_MarkdownViewer = 4;

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
			case "StackedLayout":
			case "DockSplitPanel":
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
			case "DockTabPanel":
				var tabBar = widget._tabBar;
				if (!tabBars.includes(tabBar)) {
					tabBars.push(tabBar);
                    for (var i = 0; i < tabBar._items.length; i++) {
                        if (tabBar._items[i] == targetWidget) {
                            focusedWidget = targetWidget;
                            tabBar._tabs[i].classList.add(CURRENT_CLASS_FOCUSED);
                        } else {
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
			case "StackedLayout":
			case "DockSplitPanel":
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
			case "DockTabPanel":
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

function createTextEditor(widget) {
    require(["vs/editor/editor.main"], function () {
        let editor = monaco.editor.create(widget.node, {
            value: [
                'using System;'
            ].join('\n'),
            language: 'csharp',
            theme: 'vs-dark',
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
        widget.monaco = editor;
    });
}

function createXTerm(widget) {
    var fitAddon = new FitAddon.FitAddon();
    var term = new Terminal({
        fontSize:12,
        //rendererType: 'dom'
    });
    widget.terminal = term;
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
    fitAddon.fit();
    term._initialized = true;
    term.prompt = () => {
        term.write('\r\n$ ');
    };
    term.writeln('Welcome to xterm.js');
    term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
    term.writeln('Type some keys and commands to play around.');
    term.writeln('');
    nl(term);
    term.onData(e => {
      switch (e) {
        case '\r': // Enter
        case '\u0003': // Ctrl+C
          nl(term);
          break;
        case '\u007F': // Backspace (DEL)
          // Do not delete the prompt
          if (term._core.buffer.x > 2) {
            term.write('\b \b');
          }
          break;
        default: // Print all other characters for demo
          term.write(e);
      }
    });
    function nl(term) {
        term.write('\r\n$ ');
    }
    //widget.node.style.backgroundColor = "#000";
}

function createCustomContent(widget) {
    setThemeCustomContent(widget);
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

function createMarkdownViewer(widget) {
    var md = window.markdownit();
    var result = md.render(`hello  
# markdown-it rulezz!
This is a test  
*Italic*  
**Bold**  
- __[pica](https://nodeca.github.io/pica/demo/)__ - high quality and fast image`);
    widget.node.innerHTML = result;
    widget.addClass('markdown-body');
    setThemeMarkdown(widget);
}

function createContent(title, tabType, description) {
    if (!tabType) {
        tabType = TabType_CustomContent;
    }
    var widget = new libUI.Widget();
    widget.addClass('content');
    widget.lastFocusTime = Date.now();
    widget.title.text = title;
	widget.title.description = description;
    widget.title.closable = true;
	widget.tabType = tabType;
    widget.tabTag = null;
	//widget.node.style.overflow = 'auto';
    widget.onContextMenu = function(event) {
        openMainContextMenu(event, widget);
    };
	switch (tabType) {
        case TabType_CustomContent:
            createCustomContent(widget);
            break;
		case TabType_Terminal:
			createXTerm(widget);
			break;
		case TabType_TextEditor:
            createTextEditor(widget);
			break;
        case TabType_MarkdownViewer:
            createMarkdownViewer(widget);
            break;
	}
    return widget;
}

///////////////////////////////////////////////////////
// BEGIN MenuItem handlers
///////////////////////////////////////////////////////

function miOpenBaseTerminal() {
    
}

function miOpenNewTerminal() {
    var widgets = getWidgets(dockInstance.layout);
    //var widget = createContent('/', TabType_Terminal);
    //console.log(dockInstance);
    //debugger;
    //dockInstance.insertTabAfter(r9, r2);
}

function miTabFocus(item) {
    focusWidget(item.widget);
}

function miTabCloseAll() {
}

function miTabClose(item) {
    
}

function miTabCloseTabGroup(item) {
    
}

function miTabCloseAllButThisInTabGroup(item) {
}

function miTabCloseAllButThisEverywhere(item) {
}

function miTabCopyFullPath(item) {
    
}

function miOpenNewTerminalAtThisPath(item) {
}

function miTerminalCopyBuffer(item) {
}

function miTerminalCopyBufferVisibleOnly(item) {
}

function miTerminalClear(item) {
    // "clear" terminal command
}

function miTerminalReset(item) {
    // "reset" terminal command
}

function miTabSaveFile(item) {
    
}

function miTabSaveFileAs(item) {
    
}

function miTabSaveFileAllInTabGroup(item) {
    
}

function miTabSaveFileAll(item) {
}

function miTabReloadFile(item) {
    
}

function openMainContextMenu(event, tabRef) {
    event.preventDefault();
    var tabsMenuItems = [];
    var widgets = getWidgetsByVisitTime(dockInstance.layout);
    for (var i = 0; i < widgets.length; i++) {
        tabsMenuItems.push(new libMenus.MenuItem({
            text: widgets[i].title.text,
            icon: dockInstance.focusedWidget == widgets[i] ? 'fas fa-minus' : '',
            handler: miTabFocus,
            widget: widgets[i]
        }));
    }
    var menuItems = [
        new libMenus.MenuItem({
            text: 'Base terminal',
            //shortcut: 'Ctrl+B',
            handler: miOpenBaseTerminal
        }),
        new libMenus.MenuItem({
            text: 'New terminal',
            //shortcut: 'Ctrl+N',
            handler: miOpenNewTerminal
        })
    ];
    if (widgets.length > 0) {
        // Only add the tabs/close tabs if there are any tabs to view/close...
        menuItems.push(new libMenus.MenuItem({
            text: 'Tabs',
            submenu: new libMenus.Menu(tabsMenuItems)
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close all tabs',
            handler: miTabCloseAll
        }));
    }
    if (tabRef) {
        menuItems.push(new libMenus.MenuItem({
            type: libMenus.MenuItem.Separator
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close',
            handler: miTabClose,
            tab: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close tab group',
            handler: miTabCloseTabGroup,
            tab: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close all but this (in tab group)',
            handler: miTabCloseAllButThisInTabGroup,
            tab: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Close all but this (everywhere)',
            handler: miTabCloseAllButThisEverywhere,
            tab: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            type: libMenus.MenuItem.Separator
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'Copy full path',
            handler: miTabCopyFullPath,
            tab: tabRef
        }));
        menuItems.push(new libMenus.MenuItem({
            text: 'New terminal at this path',
            handler: miOpenNewTerminalAtThisPath,
            tab: tabRef
        }));
        if (tabRef.tabType == TabType_Terminal) {
            menuItems.push(new libMenus.MenuItem({
                type: libMenus.MenuItem.Separator
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Copy buffer',
                handler: miTerminalCopyBuffer,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Copy visible buffer',
                handler: miTerminalCopyBufferVisibleOnly,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Clear',
                handler: miTerminalClear,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Reset',
                handler: miTerminalReset,
                tab: tabRef
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
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save as...',
                shortcut: 'Ctrl+Alt+S',
                handler: miTabSaveFileAs,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save All (in tab group)',
                handler: miTabSaveFileAllInTabGroup,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Save All (everywhere)',
                handler: miTabSaveFileAll,
                tab: tabRef
            }));
            menuItems.push(new libMenus.MenuItem({
                type: libMenus.MenuItem.Separator
            }));
            menuItems.push(new libMenus.MenuItem({
                text: 'Reload',
                shortcut: 'Ctrl+Alt+R',
                handler: miTabReloadFile,
                tab: tabRef
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

function setThemeCustomContent(widget) {
    setThemeShared(widget);
}

function setThemeMarkdown(widget) {
    setThemeShared(widget);
    widget.node.style.backgroundColor = markdownThemes[themeThemes[activeThemeName].markdown].background;
    widget.node.style.padding = '10px';
    widget.node.style.userSelect = 'text';
    widget.node.style.cursor = 'auto';
}

function setThemeXTerm(widget) {
    setThemeShared(widget);
    if (widget.terminal != null) {
        widget.terminal.setOption('theme', xtermThemes[themeThemes[activeThemeName].xterm]);
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
        document.getElementById('markdown-theme').setAttribute('href', markdownThemesUrls[theme.markdown]);
        setThemeShared();
        if (dockInstance == null) {
            return;
        }
        var widgets = getWidgets(dockInstance.layout);
        for (var i = 0; i < widgets.length; i++) {
            var widget = widgets[i];
            switch (widget.tabType) {
                case TabType_CustomContent:
                    setThemeCustomContent(widget);
                    break;
                case TabType_Terminal:
                    setThemeXTerm(widget);
                    break;
                case TabType_MarkdownViewer:
                    setThemeMarkdown(widget);
                    break;
            }
        }
    }
}

function main() {
    setTheme('light');
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
    var r2 = createContent('Files', TabType_TextEditor);
	var r9 = createContent('Files(2)', TabType_TextEditor);
    var r3 = createContent('Red', TabType_Terminal);
    var b1 = createContent('Blue', TabType_Terminal);
    var b2 = createContent('Blue', TabType_Terminal);
    var g1 = createContent('GreenGreen', TabType_CustomContent, 'GreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreenGreen');
    var g2 = createContent('Green', TabType_MarkdownViewer);
    var g3 = createContent('Green');
    var y1 = createContent('Hex', '');
    var y2 = createContent('Yellow');
    dockInstance = new libUI.DockPanel();
    dockInstance.useAltTextOnTabs = true;
    dockInstance.focusedWidget = null;
    dockInstance.id = 'main';
    dockInstance.insertRight(b1);
    dockInstance.insertBottom(y1, b1);
    dockInstance.insertLeft(g1, y1);
    dockInstance.insertBottom(b2);
    dockInstance.insertTabBefore(g2, b2);
    dockInstance.insertTabBefore(y2, g2);
    dockInstance.insertTabBefore(g3, y2);
    dockInstance.insertTabBefore(r2, b1);
	dockInstance.insertTabAfter(r9, r2);
    dockInstance.insertTabBefore(r3, y1);
    dockInstance.onContextMenu = openMainContextMenu;
    dockInstance.onTabBarUpdated = function(tabBar) {
        // If the focused widget belongs to the closed tab bar then focus the most recently visited widget
        if (tabBar._items.length == 0 && (dockInstance.focusedWidget == null || dockInstance.focusedWidget.parent.parent.tabBar == tabBar)) {
            focusMostRecentWidget();
        }
    };
    dockInstance.attach(document.body);
    focusMostRecentWidget();
	
	var tooltip = document.createElement('div');
	tooltip.className = "p-Tooltip";
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
window.onload = main;