const { startMetricsCycle } = require('./metric.js');
const app = require('./service.js');

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

startMetricsCycle(10000);