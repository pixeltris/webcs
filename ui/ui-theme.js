// Themes are a bit of a mess in general... probably should consolidate them and use var(--xxx) css variables.

// The base phosphor css files are the "-light.css" files.
// Modifications in the other css files are flagged with "THEMED"

// NOTE: Look at index.html for urls which are achieved by .css swapping (they're there to keep urls in a central place)

// Some things that might be worth moving / look into:
// - ui.js setThemeMarkdown some style values set there
// - ui.js createTextEditor (monaco) ~ custom registering of themes
// - ui.js createXTerm font family / size / rendererType

var themeThemeDarkBg = '#1e1e1e';
var themeThemeLightBg = 'white';
// There might be times where you want to define a base background color in cases where there are holes through content.
// This would be similar to WinForms default background color where there aren't any controls.
var themeThemeWidgetBgColorDark = themeThemeDarkBg;
var themeThemeWidgetBgColorLight = themeThemeLightBg;

var themeThemes = [];
themeThemes['dark'] = {
    xterm: 'dark',
    markdown: 'dark',
    monaco: 'vs-dark',
    shared: 'dark',
    phosphorDockpanel: 'dark',
    phosphorMenu: 'dark',
    toastr: 'dark',
};
themeThemes['light'] = {
    xterm: 'light',
    markdown: 'light',
    monaco: 'vs',
    shared: 'light',
    phosphorDockpanel: 'light',
    phosphorMenu: 'light',
    toastr: 'light',
};

// NOTE: Keep 'default' up to date with https://github.com/xtermjs/xterm.js/blob/master/src/browser/ColorManager.ts
// NOTE: Modified xterm.js theme code to alow selectionOpaque custom value "this.colors.selectionOpaque=e.selectionOpaque?e.selectionOpaque:"
var XTERM_DEFAULT_FOREGROUND = '#ffffff';
var XTERM_DEFAULT_BACKGROUND = '#000000';
var XTERM_DEFAULT_CURSOR = '#ffffff';
var XTERM_DEFAULT_CURSOR_ACCENT = '#ffffff';
var XTERM_DEFAULT_SELECTION = '#ffffff4d';// The same as rgba(255, 255, 255, 0.3)
var XTERM_DEFAULT_ANSI_COLORS = [
    // dark:
    '#2e3436',//black
    '#cc0000',//red
    '#4e9a06',//green
    '#c4a000',//yellow
    '#3465a4',//blue
    '#75507b',//magenta
    '#06989a',//cyan
    '#d3d7cf',//white
    // bright:
    '#555753',//brightBlack
    '#ef2929',//brightRed
    '#8ae234',//brightGreen
    '#fce94f',//brightYellow
    '#729fcf',//brightBlue
    '#ad7fa8',//brightMagenta
    '#34e2e2',//brightCyan
    '#eeeeec',//brightWhite
];
var xtermThemes = [];
xtermThemes['default'] = {
    foreground: XTERM_DEFAULT_FOREGROUND,
    background: XTERM_DEFAULT_BACKGROUND,
    cursor: XTERM_DEFAULT_CURSOR,
    cursorAccent: XTERM_DEFAULT_CURSOR_ACCENT,
    selection: XTERM_DEFAULT_SELECTION,
    black: XTERM_DEFAULT_ANSI_COLORS[0],
    red: XTERM_DEFAULT_ANSI_COLORS[1],
    green: XTERM_DEFAULT_ANSI_COLORS[2],
    yellow: XTERM_DEFAULT_ANSI_COLORS[3],
    blue: XTERM_DEFAULT_ANSI_COLORS[4],
    magenta: XTERM_DEFAULT_ANSI_COLORS[5],
    cyan: XTERM_DEFAULT_ANSI_COLORS[6],
    white: XTERM_DEFAULT_ANSI_COLORS[7],
    brightBlack: XTERM_DEFAULT_ANSI_COLORS[8],
    brightRed: XTERM_DEFAULT_ANSI_COLORS[9],
    brightGreen: XTERM_DEFAULT_ANSI_COLORS[10],
    brightYellow: XTERM_DEFAULT_ANSI_COLORS[11],
    brightBlue: XTERM_DEFAULT_ANSI_COLORS[12],
    brightMagenta: XTERM_DEFAULT_ANSI_COLORS[13],
    brightCyan: XTERM_DEFAULT_ANSI_COLORS[14],
    brightWhite: XTERM_DEFAULT_ANSI_COLORS[15]
};
xtermThemes['default'].background = themeThemeDarkBg;
// Dark xterm theme:
xtermThemes['dark'] = {
    foreground: '#d4d4d4',//XTERM_DEFAULT_FOREGROUND,
    background: XTERM_DEFAULT_BACKGROUND,
    cursor: '#d4d4d4',//XTERM_DEFAULT_CURSOR,
    cursorAccent: '#000',//XTERM_DEFAULT_CURSOR_ACCENT,
    selection: XTERM_DEFAULT_SELECTION,
    black: XTERM_DEFAULT_ANSI_COLORS[0],
    red: XTERM_DEFAULT_ANSI_COLORS[1],
    green: XTERM_DEFAULT_ANSI_COLORS[2],
    yellow: XTERM_DEFAULT_ANSI_COLORS[3],
    blue: XTERM_DEFAULT_ANSI_COLORS[4],
    magenta: XTERM_DEFAULT_ANSI_COLORS[5],
    cyan: XTERM_DEFAULT_ANSI_COLORS[6],
    white: XTERM_DEFAULT_ANSI_COLORS[7],
    brightBlack: XTERM_DEFAULT_ANSI_COLORS[8],
    brightRed: XTERM_DEFAULT_ANSI_COLORS[9],
    brightGreen: XTERM_DEFAULT_ANSI_COLORS[10],
    brightYellow: XTERM_DEFAULT_ANSI_COLORS[11],
    brightBlue: XTERM_DEFAULT_ANSI_COLORS[12],
    brightMagenta: XTERM_DEFAULT_ANSI_COLORS[13],
    brightCyan: XTERM_DEFAULT_ANSI_COLORS[14],
    brightWhite: XTERM_DEFAULT_ANSI_COLORS[15]
};
xtermThemes['dark'].background = themeThemeDarkBg;
// Light xterm theme:
var XTERM_LIGHT_FOREGROUND = 'black';
var XTERM_LIGHT_BACKGROUND = themeThemeLightBg;
var XTERM_LIGHT_CURSOR = '#222';
var XTERM_LIGHT_CURSOR_ACCENT = 'white';
//var XTERM_LIGHT_SELECTION = '#0000004d';// The same as rgba(255, 255, 255, 0.3)
var XTERM_LIGHT_SELECTION = '#007eff50';// Light blue
xtermThemes['light'] = {
    widgetBackground: '#f0f0f0',// Light grey
    foreground: XTERM_LIGHT_FOREGROUND,
    background: XTERM_LIGHT_BACKGROUND,
    cursor: XTERM_LIGHT_CURSOR,
    cursorAccent: XTERM_LIGHT_CURSOR_ACCENT,
    selection: XTERM_LIGHT_SELECTION,
    black: XTERM_DEFAULT_ANSI_COLORS[0],
    red: XTERM_DEFAULT_ANSI_COLORS[1],
    green: XTERM_DEFAULT_ANSI_COLORS[2],
    yellow: XTERM_DEFAULT_ANSI_COLORS[3],
    blue: XTERM_DEFAULT_ANSI_COLORS[4],
    magenta: XTERM_DEFAULT_ANSI_COLORS[5],
    cyan: XTERM_DEFAULT_ANSI_COLORS[6],
    white: XTERM_DEFAULT_ANSI_COLORS[7],
    brightBlack: XTERM_DEFAULT_ANSI_COLORS[8],
    brightRed: XTERM_DEFAULT_ANSI_COLORS[9],
    brightGreen: XTERM_DEFAULT_ANSI_COLORS[10],
    brightYellow: XTERM_DEFAULT_ANSI_COLORS[11],
    brightBlue: XTERM_DEFAULT_ANSI_COLORS[12],
    brightMagenta: XTERM_DEFAULT_ANSI_COLORS[13],
    brightCyan: XTERM_DEFAULT_ANSI_COLORS[14],
    brightWhite: XTERM_DEFAULT_ANSI_COLORS[15]
};

var sharedThemes = [];
sharedThemes['dark'] = {
    widgetBackground: themeThemeWidgetBgColorDark
};
sharedThemes['light'] = {
    widgetBackground: themeThemeWidgetBgColorLight
};

var markdownThemes = [];
markdownThemes['dark'] = {
    background: themeThemeDarkBg
};
markdownThemes['light'] = {
    background: themeThemeLightBg
};