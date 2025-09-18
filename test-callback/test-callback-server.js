/**
 * 问卷回调测试服务器
 * 用于测试问卷提交后的回调功能
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

// 初始化日志文件
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, JSON.stringify([], null, 2));
}

// 记录请求日志
function logRequest(method, url, headers, body, query) {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  const logEntry = {
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    method,
    url,
    headers,
    query,
    body,
  };
  
  logs.push(logEntry);
  
  // 只保留最近20条记录
  if (logs.length > 20) {
    logs.shift();
  }
  
  fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
  
  return logEntry;
}

// POST 回调接口
app.post('/callback', (req, res) => {
  console.log('\n========== 接收到POST回调请求 ==========');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  const logEntry = logRequest('POST', req.url, req.headers, req.body, req.query);
  
  // 返回成功响应
  res.json({
    success: true,
    message: '回调接收成功',
    receivedAt: new Date().toISOString(),
    logId: logEntry.id
  });
  
  console.log('响应: 200 OK');
  console.log('=====================================\n');
});

// GET 回调接口
app.get('/callback', (req, res) => {
  console.log('\n========== 接收到GET回调请求 ==========');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  
  const logEntry = logRequest('GET', req.url, req.headers, null, req.query);
  
  // 返回成功响应
  res.json({
    success: true,
    message: '回调接收成功',
    receivedAt: new Date().toISOString(),
    logId: logEntry.id
  });
  
  console.log('响应: 200 OK');
  console.log('=====================================\n');
});

// 查看所有日志
app.get('/logs', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  res.json({
    total: logs.length,
    logs: logs.reverse()
  });
});

// 清空日志
app.delete('/logs', (req, res) => {
  fs.writeFileSync(logFilePath, JSON.stringify([], null, 2));
  res.json({
    success: true,
    message: '日志已清空'
  });
});

// 测试服务器是否运行
app.get('/', (req, res) => {
  res.send(`
    <h1>问卷回调测试服务器</h1>
    <p>服务器运行中...</p>
    <ul>
      <li>POST回调地址: http://localhost:${PORT}/callback</li>
      <li>GET回调地址: http://localhost:${PORT}/callback</li>
      <li>查看日志: http://localhost:${PORT}/logs</li>
      <li>清空日志: DELETE http://localhost:${PORT}/logs</li>
    </ul>
    <p>当前时间: ${new Date().toLocaleString('zh-CN')}</p>
  `);
});

// 启动服务器
app.listen(PORT, () => {
  console.log('====================================');
  console.log('🚀 问卷回调测试服务器已启动');
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🔗 回调地址: http://localhost:${PORT}/callback`);
  console.log(`📊 查看日志: http://localhost:${PORT}/logs`);
  console.log('====================================\n');
  console.log('等待接收回调请求...\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});