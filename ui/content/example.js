define(function() {
    return {
        onCreated: function(widget, options) {
            console.log('Creating example content widget ' + widget.title.text);
        },
        onCloseRequest: function(widget, closeWidget) {
            if (confirm('Close this widget?')) {
                closeWidget(widget);
            }
        },
        onFocus: function(widget) {
            console.log('focus obtained ' + widget.title.text);
        },
        onFocusLost: function(widget) {
            console.log('focus lost ' + widget.title.text);
        }
    };
});