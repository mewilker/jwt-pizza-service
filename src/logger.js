const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      try {
        const logData = {
          authorized: !!req.headers.authorization,
          path: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          ...(req.body && { reqBody: JSON.stringify(req.body) }),
          resBody: JSON.stringify(resBody),
        };
        const level = this.#statusToLogLevel(res.statusCode);
        this.log(level, 'http', logData);
      } catch (err) {
        console.log('Failed to log HTTP request:', err.message);
        console.log(err.stack);
      }
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.#nowString(), this.#sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.#sendLogToGrafana(logEvent);
  }

  dbLogAndSanitize(sql, params) {
    
    let safeParams = [];
    if (params !== undefined &&params.length > 0){
      safeParams = [...params];
      if (sql.startsWith('SELECT') || sql.startsWith('DELETE')) {
        let split = sql.split(/\s*=\s*\??\s*/);
        for (let i = 0; i < split.length - 1; i++) {
          safeParams[i] = String(safeParams[i]);
          if (split[i].toLowerCase().includes('token')) {
            safeParams[i] = safeParams[i].slice(0, 4) + '****';
          }
          if (split[i].toLowerCase().includes('email')) {
            safeParams[i] = safeParams[i].slice(0, 2) + '***@' + safeParams[i].split('@')[1];
          }
        }
        
      }
      else if (sql.startsWith('INSERT')) {
        const match = sql.match(/\(([^)]+)\)/);
        const columns = match ? match[1] : null;
        const colsArray = columns.split(/\s*,\s*/);
        for (let i = 0; i < colsArray.length; i++) {
          if (colsArray[i].toLowerCase().includes('token')) {
            safeParams[i] = safeParams[i].slice(0, 4) + '****';
          }
          if (colsArray[i].toLowerCase().includes('email')) {
            safeParams[i] = safeParams[i].slice(0, 2) + '***@' + safeParams[i].split('@')[1];
          }
          if (colsArray[i].toLowerCase().includes('password')) {
            safeParams[i] = '*****';
          }
        }
      }
    }
    
    const logData = { sql, params: JSON.stringify(safeParams) };
    this.log('info', 'database', logData);
  }

  #statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  #nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  #sanitize(logData) {
    logData = {
      ...logData,
      token: logData.token ? logData.token.slice(0, 4) + '****' : undefined,
      email: logData.email ? logData.email.slice(0, 2) + '***@' + logData.email.split('@')[1] : undefined
    }
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  #sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}
module.exports = new Logger();