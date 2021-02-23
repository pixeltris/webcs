// This is an example of using chart.js
define(function() {
    return {
        onCreated: function(widget, options) {
            var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            var config = {
                type: 'line',
                data: {
                    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
                    datasets: [{
                        label: 'My First dataset',
                        backgroundColor: window.chartColors.red,
                        borderColor: window.chartColors.red,
                        data: [
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor()
                        ],
                        fill: false,
                    }, {
                        label: 'My Second dataset',
                        fill: false,
                        backgroundColor: window.chartColors.blue,
                        borderColor: window.chartColors.blue,
                        data: [
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor(),
                            randomScalingFactor()
                        ],
                    }]
                },
                options: {
                    responsive: true,
                    title: {
                        display: true,
                        text: 'Chart.js Line Chart'
                    },
                    tooltips: {
                        mode: 'index',
                        intersect: false,
                    },
                    hover: {
                        mode: 'nearest',
                        intersect: true
                    },
                    scales: {
                        xAxes: [{
                            display: true,
                            scaleLabel: {
                                display: true,
                                labelString: 'Month'
                            },
                            gridLines: {
                              color: 'rgba(255, 255, 255, 0.2)',
                              zeroLineColor: 'rgba(255, 255, 255, 0.5)'
                            },
                        }],
                        yAxes: [{
                            display: true,
                            scaleLabel: {
                                display: true,
                                labelString: 'Value'
                            },
                            gridLines: {
                              color: 'rgba(255, 255, 255, 0.2)',
                              zeroLineColor: 'rgba(255, 255, 255, 0.5)'
                            },
                        }]
                    }
                }
            };
            var canvas = document.createElement('canvas');
            widget.node.appendChild(canvas);
            widget.node.style.overflow = 'auto';
            widget.chart = new Chart(canvas.getContext('2d'), config);
            console.log('Creating chart on widget ' + widget.title.text);
        },
        onCloseRequest: function(widget, closeWidget) {
            if (confirm('Close this chart?')) {
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