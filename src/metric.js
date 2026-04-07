const config = require('./config');
const os = require('os');

//memory store for metrics
const requests = {};
const latencies = [];

function startMetricsCycle(period){
    setInterval(() => {
        const metrics = [];
        Object.keys(requests).forEach(endpoint => {
            metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
        });

        metrics.push(createMetric('request_latency_ms', undefined, 'ms', 'histogram', undefined, { service: 'jwt-pizza-service' }, [50, 100, 200, 500, 1000], latencies));
        metrics.push(createMetric('cpu_usage_percentage', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', { service: 'jwt-pizza-service' }));
        metrics.push(createMetric('memory_usage_percentage', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', { service: 'jwt-pizza-service' }));
        
        sendMetricToGrafana(metrics);
        latencies.length = 0;
    }, period);
}

function requestTracker(req, res, next) {
    const endpoint = `${req.method}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    next();
}

function latencyTracker(request, response, next) {
    const start = process.hrtime.bigint();
    response.on('finish', () => {
        const duration = process.hrtime.bigint() - start ;
        const ms = Number(duration) / 1e6;
        latencies.push(ms);
    });
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

function createHistogram(buckets, dataPoints) {
  const counts = new Array(buckets.length+1).fill(0);
  let sum = 0;
  dataPoints.forEach(point => {
    sum += point;
    let placed = false;
    for (let i = 0; i < buckets.length; i++) {
      if (point <= buckets[i]) {
        counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) counts[buckets.length]++; // overflow bucket
  });
  return {bucketCounts: counts, explicitBounds: buckets, sum: sum, count: dataPoints.length};
}

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes, buckets, datapoints) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        metricType === 'histogram' ? {} 
        : {
            [valueType]: metricValue,
            timeUnixNano: Date.now() * 1000000,
            attributes: [],
          },
      ],
    },
  };

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }
  
  if (metricType === 'histogram') {
    const histogram = createHistogram(buckets, datapoints);
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].dataPoints[0] = {
      bucketCounts: histogram.bucketCounts,
      explicitBounds: histogram.explicitBounds,
      sum: histogram.sum,
      count: histogram.count,
      timeUnixNano: Date.now() * 1000000,
      attributes: []
    };
  }
  
  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

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
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}, response: ${await response.text()}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { startMetricsCycle, requestTracker, latencyTracker};