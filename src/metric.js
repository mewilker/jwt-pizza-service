const config = require('./config');
const os = require('os');

//memory store for metrics
const requests = {};

function startMetricsCycle(period){
    setInterval(() => {
        const metrics = [];
        Object.keys(requests).forEach(endpoint => {
            metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
        });

        metrics.push(createMetric('cpu_usage_percentage', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', { service: 'jwt-pizza-service' }));
        metrics.push(createMetric('memory_usage_percentage', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', { service: 'jwt-pizza-service' }));
        
        sendMetricToGrafana(metrics);
    }, period);
}

function requestTracker(req, res, next) {
    const endpoint = `${req.method}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { startMetricsCycle, requestTracker};