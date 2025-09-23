/**
 * 问卷回调测试服务器
 * 用于测试问卷提交后的回调功能和重试机制
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3333;

// 配置中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 日志文件路径
const logFilePath = path.join(__dirname, 'callback-logs.json');
const attemptFilePath = path.join(__dirname, 'callback-attempts.json');

// 初始化日志文件
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, JSON.stringify([], null, 2));
}

// 初始化尝试记录文件
if (!fs.existsSync(attemptFilePath)) {
  fs.writeFileSync(attemptFilePath, JSON.stringify({}, null, 2));
}

// 获取请求的唯一标识
function getRequestId(body) {
  // 尝试从不同字段获取唯一标识
  return body.eventId || 
         body.questionnaireId || 
         body.surveyPath || 
         body.surveyResponseId || 
         JSON.stringify(body).substring(0, 50);
}

// 获取尝试次数
function getAttemptCount(requestId) {
  const attempts = JSON.parse(fs.readFileSync(attemptFilePath, 'utf8'));
  if (!attempts[requestId]) {
    attempts[requestId] = { count: 0, firstTime: new Date().toISOString() };
  }
  attempts[requestId].count++;
  attempts[requestId].lastTime = new Date().toISOString();
  fs.writeFileSync(attemptFilePath, JSON.stringify(attempts, null, 2));
  return attempts[requestId].count;
}

// 清理旧的尝试记录（超过1小时的）
function cleanOldAttempts() {
  const attempts = JSON.parse(fs.readFileSync(attemptFilePath, 'utf8'));
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const key in attempts) {
    if (new Date(attempts[key].lastTime).getTime() < oneHourAgo) {
      delete attempts[key];
    }
  }
  
  fs.writeFileSync(attemptFilePath, JSON.stringify(attempts, null, 2));
}

// 记录请求日志
function logRequest(method, url, headers, body, query, attemptCount, responseStatus, responseBody) {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  const logEntry = {
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    method,
    url,
    headers,
    query,
    body,
    attemptCount,
    responseStatus,
    responseBody
  };
  
  logs.push(logEntry);
  
  // 只保留最近30条记录
  if (logs.length > 30) {
    logs.shift();
  }
  
  fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
  
  return logEntry;
}

// 生成响应
function generateResponse(attemptCount) {
  let responseStatus = 200;
  let responseBody = {};
  
  console.log(`📊 尝试次数: ${attemptCount}`);
  
  if (attemptCount === 1) {
    // 第一次：总是失败
    const failType = Math.random() > 0.5 ? 'server_error' : 'bad_response';
    
    if (failType === 'server_error') {
      // 服务器错误（会触发重试）
      responseStatus = 500;
      responseBody = {
        code: 500,
        success: false,
        error: 'Internal Server Error',
        message: '服务器内部错误（模拟第一次失败）'
      };
      console.log('❌ 第一次尝试：返回500错误（将触发重试）');
    } else {
      // 返回200但格式不对（也会触发重试）
      responseStatus = 200;
      responseBody = {
        code: 400,
        success: false,
        message: '响应格式不符合预期（模拟第一次失败）'
      };
      console.log('❌ 第一次尝试：返回200但格式错误（将触发重试）');
    }
  } else if (attemptCount === 2) {
    // 第二次：随机成功或失败
    const isSuccess = Math.random() > 0.5;
    
    if (isSuccess) {
      // 成功
      responseStatus = 200;
      responseBody = {
        code: 200,
        success: true,
        message: '回调接收成功（第二次尝试成功）',
        receivedAt: new Date().toISOString()
      };
      console.log('✅ 第二次尝试：成功');
    } else {
      // 失败
      const failType = Math.random() > 0.5 ? 'timeout' : 'bad_gateway';
      
      if (failType === 'timeout') {
        responseStatus = 504;
        responseBody = {
          code: 504,
          success: false,
          error: 'Gateway Timeout',
          message: '网关超时（模拟第二次失败）'
        };
        console.log('❌ 第二次尝试：返回504超时（将触发重试）');
      } else {
        responseStatus = 502;
        responseBody = {
          code: 502,
          success: false,
          error: 'Bad Gateway',
          message: '网关错误（模拟第二次失败）'
        };
        console.log('❌ 第二次尝试：返回502错误（将触发重试）');
      }
    }
  } else {
    // 第三次及以后：总是成功
    responseStatus = 200;
    responseBody = {
      code: 200,
      success: true,
      message: `回调接收成功（第${attemptCount}次尝试）`,
      receivedAt: new Date().toISOString(),
      attemptCount: attemptCount
    };
    console.log(`✅ 第${attemptCount}次尝试：成功`);
  }
  
  return { responseStatus, responseBody };
}

// POST 回调接口
app.post('/callback', (req, res) => {
  console.log('\n========== 接收到POST回调请求 ==========');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  
  // 清理旧记录
  cleanOldAttempts();
  
  // 获取请求标识和尝试次数
  const requestId = getRequestId(req.body);
  const attemptCount = getAttemptCount(requestId);
  
  console.log('请求标识:', requestId.substring(0, 50) + '...');
  console.log('Headers:', JSON.stringify(req.headers, null, 2).substring(0, 200) + '...');
  console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 500) + '...');
  
  // 生成响应
  const { responseStatus, responseBody } = generateResponse(attemptCount);
  
  // 记录日志
  const logEntry = logRequest('POST', req.url, req.headers, req.body, req.query, attemptCount, responseStatus, responseBody);
  
  // 返回响应
  res.status(responseStatus).json(responseBody);
  
  console.log('响应状态:', responseStatus);
  console.log('响应内容:', JSON.stringify(responseBody, null, 2));
  console.log('日志ID:', logEntry.id);
  console.log('=====================================\n');
});

// GET 回调接口
app.get('/callback', (req, res) => {
  console.log('\n========== 接收到GET回调请求 ==========');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  
  // 清理旧记录
  cleanOldAttempts();
  
  // 获取请求标识和尝试次数
  const requestId = getRequestId(req.query);
  const attemptCount = getAttemptCount(requestId);
  
  console.log('请求标识:', requestId.substring(0, 50) + '...');
  console.log('Headers:', JSON.stringify(req.headers, null, 2).substring(0, 200) + '...');
  console.log('Query:', JSON.stringify(req.query, null, 2).substring(0, 500) + '...');
  
  // 生成响应
  const { responseStatus, responseBody } = generateResponse(attemptCount);
  
  // 记录日志
  const logEntry = logRequest('GET', req.url, req.headers, null, req.query, attemptCount, responseStatus, responseBody);
  
  // 返回响应
  res.status(responseStatus).json(responseBody);
  
  console.log('响应状态:', responseStatus);
  console.log('响应内容:', JSON.stringify(responseBody, null, 2));
  console.log('日志ID:', logEntry.id);
  console.log('=====================================\n');
});

// 查看所有日志
app.get('/logs', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  const attempts = JSON.parse(fs.readFileSync(attemptFilePath, 'utf8'));
  
  res.json({
    total: logs.length,
    logs: logs.reverse(),
    attempts: attempts
  });
});

// 清空日志
app.delete('/logs', (req, res) => {
  fs.writeFileSync(logFilePath, JSON.stringify([], null, 2));
  fs.writeFileSync(attemptFilePath, JSON.stringify({}, null, 2));
  res.json({
    success: true,
    message: '日志和尝试记录已清空'
  });
});

// 查看重试统计
app.get('/stats', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  const attempts = JSON.parse(fs.readFileSync(attemptFilePath, 'utf8'));
  
  // 统计信息
  const stats = {
    totalRequests: logs.length,
    uniqueRequests: Object.keys(attempts).length,
    successCount: logs.filter(l => l.responseStatus === 200 && l.responseBody.success === true).length,
    failCount: logs.filter(l => l.responseStatus !== 200 || l.responseBody.success !== true).length,
    retryDistribution: {},
    recentRequests: logs.slice(-10).reverse()
  };
  
  // 统计重试分布
  for (const log of logs) {
    const attempt = log.attemptCount || 1;
    stats.retryDistribution[`第${attempt}次`] = (stats.retryDistribution[`第${attempt}次`] || 0) + 1;
  }
  
  res.json(stats);
});

// 测试服务器是否运行
app.get('/', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  const attempts = JSON.parse(fs.readFileSync(attemptFilePath, 'utf8'));
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>问卷回调测试服务器</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .success { color: green; }
        .fail { color: red; }
        ul { line-height: 1.8; }
        code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
        .stats { margin: 20px 0; }
        .stats table { border-collapse: collapse; width: 100%; }
        .stats th, .stats td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .stats th { background: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>🚀 问卷回调测试服务器</h1>
      <div class="info">
        <p><strong>服务器运行中...</strong></p>
        <p>当前时间: ${new Date().toLocaleString('zh-CN')}</p>
      </div>
      
      <h2>📊 重试机制模拟规则</h2>
      <ul>
        <li><strong>第1次尝试:</strong> <span class="fail">总是失败</span> - 返回500错误或格式错误的200响应</li>
        <li><strong>第2次尝试:</strong> <span style="color: orange;">随机结果</span> - 50%成功，50%失败</li>
        <li><strong>第3次尝试:</strong> <span class="success">保证成功</span> - 返回正确的成功响应</li>
      </ul>
      
      <h2>🔗 接口地址</h2>
      <ul>
        <li>POST回调: <code>http://localhost:${PORT}/callback</code></li>
        <li>GET回调: <code>http://localhost:${PORT}/callback</code></li>
        <li>查看日志: <code>http://localhost:${PORT}/logs</code></li>
        <li>查看统计: <code>http://localhost:${PORT}/stats</code></li>
        <li>清空日志: <code>DELETE http://localhost:${PORT}/logs</code></li>
      </ul>
      
      <h2>📈 当前统计</h2>
      <div class="stats">
        <table>
          <tr>
            <th>总请求数</th>
            <th>独立请求数</th>
            <th>活跃请求数</th>
          </tr>
          <tr>
            <td>${logs.length}</td>
            <td>${Object.keys(attempts).length}</td>
            <td>${Object.keys(attempts).filter(k => new Date(attempts[k].lastTime) > new Date(Date.now() - 300000)).length}</td>
          </tr>
        </table>
      </div>
      
      <h2>✅ 成功响应格式示例</h2>
      <pre>{
  "code": 200,
  "success": true,
  "message": "回调接收成功",
  "receivedAt": "2024-01-01T12:00:00.000Z"
}</pre>
      
      <h2>❌ 失败响应格式示例</h2>
      <pre>{
  "code": 500,
  "success": false,
  "error": "Internal Server Error",
  "message": "服务器内部错误"
}</pre>
    </body>
    </html>
  `);
});

// 启动服务器
app.listen(PORT, () => {
  console.log('====================================');
  console.log('🚀 问卷回调测试服务器已启动');
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🔗 回调地址: http://localhost:${PORT}/callback`);
  console.log(`📊 查看日志: http://localhost:${PORT}/logs`);
  console.log(`📈 查看统计: http://localhost:${PORT}/stats`);
  console.log('====================================');
  console.log('\n📋 重试机制模拟规则:');
  console.log('  第1次: ❌ 总是失败（返回500或格式错误）');
  console.log('  第2次: ❓ 随机成功或失败（50%概率）');
  console.log('  第3次: ✅ 保证成功');
  console.log('====================================\n');
  console.log('等待接收回调请求...\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});