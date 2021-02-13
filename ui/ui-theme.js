// NOTE: Look at index.html for urls which are achieved by .css swapping (they're there to keep urls in a central place)
// Files to consider (XXXX denotes light/dark):
// - phosphor-dockpanel-menu.css (dock panels, context menus, tooltips (p-Tooltip))
// - github-markdown-XXXX.css

var themeThemeDarkBg = '#1e1e1e';
var themeThemeLightBg = 'white';
var themeThemeWidgetBgColorDark = themeThemeDarkBg;
var themeThemeWidgetBgColorLight = '#FFFBF0';

var themeThemes = [];
themeThemes['dark'] = {
    xterm: 'dark',
    markdown: 'dark',
    monaco: 'dark',
    shared: 'dark',
};
themeThemes['light'] = {
    xterm: 'dark',
    markdown: 'light',
    monaco: 'light',
    shared: 'light',
};

// NOTE: Keep 'default' up to date with https://github.com/xtermjs/xterm.js/blob/master/src/browser/ColorManager.ts
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
    selectionTransparent: XTERM_DEFAULT_SELECTION,
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
// Dark xterm theme:
xtermThemes['dark'] = {};
Object.assign(xtermThemes['dark'], xtermThemes['default']);
xtermThemes['dark'].background = themeThemeDarkBg;
// Light xterm theme:
xtermThemes['light'] = {
    foreground: XTERM_DEFAULT_FOREGROUND,
    background: XTERM_DEFAULT_BACKGROUND,
    cursor: XTERM_DEFAULT_CURSOR,
    cursorAccent: XTERM_DEFAULT_CURSOR_ACCENT,
    selectionTransparent: XTERM_DEFAULT_SELECTION,
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