function showChart(element_id, type, title, options) {
  const chart = new ApexCharts(
    document.getElementById(element_id),
    {
      ...options,
      chart: {
        type: type,
        height: 300,
        id: element_id,
        width: '100%',
        group: 'chart',
        zoom: {
          type: 'x',
        },
        animations: {
          enabled: false
        },
      },
      colors: ['#ff5b5b'],
      stroke: {
        width: 1,
      },
      dataLabels: {
        enabled: false
      },
      legend: {
        show: false
      },
      xaxis: {
        crosshairs: {
          show: true
        },
        type: 'datetime',
        labels: {
          datetimeUTC: false,
          style: {
            colors: ["#a6b0cf"]
          }
        }
      },
      yaxis: {
        min: 0,
        title: {
          text: title,
          style: {
            color: "#f6f6f6"
          }
        },
        labels: {
          style: {
            colors: ["#a6b0cf"]
          }
        }
      }
    }
  );
  chart.render();
}

function tooltipOptions(formatter) {
  return {
    style: {
      fontSize: '16px'
    },
    marker: {
      show: false,
    },
    x: {
      show: false,
      format: 'dd/MM/yy HH:mm'
    },
    y: {
      formatter: formatter,
      title: {
        formatter: () => '',
      }
    }
  };
}

function showTIRChart(element_id, data, addon, name) {
  showChart(element_id, 'area', 'RPM', {
    tooltip: tooltipOptions(value => (value ? value + addon : undefined)),
    series: [{
      name: name,
      data: data
    }],
    annotations: window?.annotationsData || {}
  });
}

function showRTChart(element_id, data) {
  showChart(element_id, 'area', 'Time', {
    tooltip: tooltipOptions(value => (value ? value + ' ms' : undefined)),
    series: [{
      name: 'Response Time',
      data: data,
    }],
    annotations: window?.annotationsData || {}
  });
}

function showPercentageChart(element_id, data, name) {
  showChart(element_id, 'line', '%', {
    tooltip: tooltipOptions(value => (value ? value + ' %' : undefined)),
    series: [{
      name: name,
      data: data,
    }],
    annotations: window?.annotationsData || {}
  });
}

function showUsageChart(element_id, data, name) {
  let max = data.reduce((acc, [_, value]) => (value > acc ? value : acc), -Infinity);
  let pow = 0;
  while (max >= 1024 && pow < 5) {
    max /= 1024;
    pow += 1;
  }

  const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][pow];
  const bytes = Math.pow(1024, pow);

  showChart(element_id, 'line', name, {
    tooltip: tooltipOptions(value => (value ? `${value} ${units}` : undefined)),
    series: [{
      name: name,
      data: data.map(([timestamp, value]) => [timestamp, typeof value === 'number' ? (value / bytes).toFixed(2) : null]),
    }],
    annotations: window?.annotationsData || {}
  });
}

const recent = document.getElementById("recent");
const autoupdate = document.getElementById("autoupdate");

if (autoupdate) {
  // set autoupdate checked from localStorage is missing
  if (localStorage.getItem("autoupdate") === null) {
    localStorage.setItem("autoupdate", "true");
  }
  autoupdate.checked = localStorage.getItem("autoupdate") === "true";
  autoupdate.addEventListener('change', () => {
    localStorage.setItem("autoupdate", autoupdate.checked);
  });
}

if (recent) {
  const tbody = recent.querySelector("tbody");

  setInterval(() => {
    const tr = tbody.children[0];
    const from_timei = tr.getAttribute("from_timei") || '';

    if (!autoupdate.checked) {
      return;
    }

    fetch(`recent.js?from_timei=${from_timei}`, {
      headers: {
        "X-CSRF-Token": document.querySelector("[name='csrf-token']").content,
      },
    })
      .then(res => res.text())
      .then(html => {
        tbody.innerHTML = html + tbody.innerHTML;
      });
  }, 3000);
}

// Helper function to format milliseconds
function formatMs(ms) {
  if (ms === null || ms === undefined) return '-';
  return ms.toFixed(2) + ' ms';
}

// Auto-update for Dashboard page
const autoupdateDashboard = document.getElementById("autoupdate_dashboard");

if (autoupdateDashboard) {
  let lastDashboardData = null;

  if (localStorage.getItem("autoupdate_dashboard") === null) {
    localStorage.setItem("autoupdate_dashboard", "true");
  }
  autoupdateDashboard.checked = localStorage.getItem("autoupdate_dashboard") === "true";
  autoupdateDashboard.addEventListener('change', () => {
    localStorage.setItem("autoupdate_dashboard", autoupdateDashboard.checked);
  });

  setInterval(() => {
    if (!autoupdateDashboard.checked) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('format', 'js');
    const url = `${window.location.pathname}?${searchParams.toString()}`;

    fetch(url, {
      headers: {
        "Accept": "application/json"
      },
    })
      .then(res => res.json())
      .then(data => {
        // Check if data has changed by comparing last timestamp
        const lastThroughputTime = data.throughput[data.throughput.length - 1]?.[0];
        const lastResponseTime = data.response_time[data.response_time.length - 1]?.[0];

        if (lastDashboardData &&
            lastDashboardData.lastThroughputTime === lastThroughputTime &&
            lastDashboardData.lastResponseTime === lastResponseTime &&
            lastDashboardData.p50 === data.percentile.p50 &&
            lastDashboardData.p95 === data.percentile.p95 &&
            lastDashboardData.p99 === data.percentile.p99) {
          return; // No changes, skip update
        }

        // Update percentile cards
        const p50Element = document.querySelector('.columns .column:nth-child(1) .subtitle');
        const p95Element = document.querySelector('.columns .column:nth-child(2) .subtitle');
        const p99Element = document.querySelector('.columns .column:nth-child(3) .subtitle');

        if (p50Element && data.percentile.p50 !== undefined) {
          p50Element.textContent = formatMs(data.percentile.p50);
        }
        if (p95Element && data.percentile.p95 !== undefined) {
          p95Element.textContent = formatMs(data.percentile.p95);
        }
        if (p99Element && data.percentile.p99 !== undefined) {
          p99Element.textContent = formatMs(data.percentile.p99);
        }

        // Append new data points to charts
        if (lastDashboardData) {
          // Find new data points that weren't in the last fetch
          const newThroughputPoints = data.throughput
            .filter(point => point[0] > lastDashboardData.lastThroughputTime);
          const newResponseTimePoints = data.response_time
            .filter(point => point[0] > lastDashboardData.lastResponseTime);

          if (newThroughputPoints.length > 0) {
            const throughputChart = ApexCharts.getChartByID('throughput_report_chart');
            if (throughputChart) {
              const windowStart = Date.now() - (4 * 60 * 60 * 1000); // 4 hours
              const seriesData = throughputChart.w.config.series[0].data;
              // Remove old points directly from the array
              while (seriesData.length > 0 && seriesData[0][0] < windowStart) {
                seriesData.shift();
              }
            }
            ApexCharts.exec('throughput_report_chart', 'appendData', [{
              data: newThroughputPoints
            }], false);
          }
          if (newResponseTimePoints.length > 0) {
            const responseChart = ApexCharts.getChartByID('response_time_report_chart');
            if (responseChart) {
              const windowStart = Date.now() - (4 * 60 * 60 * 1000); // 4 hours
              const seriesData = responseChart.w.config.series[0].data;
              // Remove old points directly from the array
              while (seriesData.length > 0 && seriesData[0][0] < windowStart) {
                seriesData.shift();
              }
            }
            ApexCharts.exec('response_time_report_chart', 'appendData', [{
              data: newResponseTimePoints
            }], false);
          }
        } else {
          // First load, use updateSeries
          ApexCharts.exec('throughput_report_chart', 'updateSeries', [{
            data: data.throughput
          }], false);
          ApexCharts.exec('response_time_report_chart', 'updateSeries', [{
            data: data.response_time
          }], false);
        }

        // Cache the data
        lastDashboardData = {
          lastThroughputTime,
          lastResponseTime,
          p50: data.percentile.p50,
          p95: data.percentile.p95,
          p99: data.percentile.p99
        };
      });
  }, 60000);
}

// Auto-update for Resources page
const autoupdateResources = document.getElementById("autoupdate_resources");

if (autoupdateResources) {
  let lastResourcesData = {};

  if (localStorage.getItem("autoupdate_resources") === null) {
    localStorage.setItem("autoupdate_resources", "true");
  }
  autoupdateResources.checked = localStorage.getItem("autoupdate_resources") === "true";
  autoupdateResources.addEventListener('change', () => {
    localStorage.setItem("autoupdate_resources", autoupdateResources.checked);
  });

  setInterval(() => {
    if (!autoupdateResources.checked) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('format', 'js');
    const url = `${window.location.pathname}?${searchParams.toString()}`;

    fetch(url, {
      headers: {
        "Accept": "application/json"
      },
    })
      .then(res => res.json())
      .then(data => {
        data.charts.forEach(chart => {
          // Check if this chart's data has changed
          const lastTime = chart.data[chart.data.length - 1]?.[0];
          const cachedLastTime = lastResourcesData[chart.id];

          if (cachedLastTime === lastTime) {
            return; // No changes for this chart, skip update
          }

          if (cachedLastTime) {
            // Find new data points that weren't in the last fetch
            const newPoints = chart.data.filter(point => point[0] > cachedLastTime);

            if (newPoints.length > 0) {
              const resourceChart = ApexCharts.getChartByID(chart.id);
              if (resourceChart) {
                const windowStart = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
                const seriesData = resourceChart.w.config.series[0].data;
                // Remove old points directly from the array
                while (seriesData.length > 0 && seriesData[0][0] < windowStart) {
                  seriesData.shift();
                }
              }
              ApexCharts.exec(chart.id, 'appendData', [{
                data: newPoints
              }], false);
            }
          } else {
            // First load, use updateSeries
            ApexCharts.exec(chart.id, 'updateSeries', [{
              data: chart.data
            }], false);
          }

          // Cache the last timestamp for this chart
          lastResourcesData[chart.id] = lastTime;
        });
      });
  }, 60000);
}
