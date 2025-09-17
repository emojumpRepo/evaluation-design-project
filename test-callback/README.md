# 问卷回调测试指南

## 1. 启动测试回调服务器

### 安装依赖
```bash
cd test-callback
npm install
```

### 启动服务器
```bash
npm start
# 或
node test-callback-server.js
```

服务器会在 **http://localhost:3333** 启动

## 2. 配置问卷回调

1. 打开问卷编辑页面
2. 进入 **设置** 页面 (`/management/survey/xxxx/edit/setting`)
3. 找到 **回调配置** 模块
4. 进行如下配置：

### 基础配置
- ✅ **启用回调**: 开启
- **回调地址**: `http://localhost:3333/callback`
- **请求方式**: POST 或 GET
- **超时时间**: 10秒
- **重试次数**: 3次

### 自定义Headers（可选）
- ✅ **启用自定义Headers**: 开启
- **请求头配置**:
```json
{
  "Authorization": "Bearer test-token-123",
  "X-Custom-Header": "test-value",
  "X-Survey-Source": "local-test"
}
```

## 3. 测试回调

1. **发布问卷**并获取填写链接
2. **填写并提交问卷**
3. **查看回调结果**：
   - 控制台会实时显示接收到的回调
   - 访问 http://localhost:3333/logs 查看所有回调日志

## 4. 回调数据格式

### POST 请求体示例：
```json
{
  "surveyPath": "xxxxxx",
  "userId": "user123",
  "assessmentNo": "assessment123",
  "questionId": "question123",
  "formData": {
    "field1": "answer1",
    "field2": "answer2"
  },
  "responseId": "response123",
  "timestamp": 1234567890000
}
```

### 服务器功能：
- **实时显示**: 控制台实时打印收到的回调
- **日志记录**: 自动保存到 `callback-logs.json`
- **查看日志**: GET http://localhost:3333/logs
- **清空日志**: DELETE http://localhost:3333/logs

## 5. 测试不同场景

### 场景1: 测试基础回调
- 只配置回调地址，不启用自定义Headers
- 验证是否能收到回调

### 场景2: 测试自定义Headers
- 启用自定义Headers
- 配置Authorization等请求头
- 验证Headers是否正确传递

### 场景3: 测试GET方法
- 切换请求方式为GET
- 验证参数是否通过URL传递

### 场景4: 测试重试机制
- 故意关闭测试服务器
- 提交问卷
- 重启服务器，查看是否有重试请求

## 6. 排查问题

如果没有收到回调：

1. **检查网络**:
   - 确保测试服务器正在运行
   - 确保端口3333没有被占用
   - 防火墙是否阻止了请求

2. **检查配置**:
   - 回调是否已启用
   - 地址是否正确（http://localhost:3333/callback）
   - 查看浏览器控制台是否有错误

3. **检查日志**:
   - 前端控制台日志
   - 后端服务器日志
   - 测试服务器控制台输出

## 7. 高级测试

### 模拟失败场景
修改回调地址为 `http://localhost:3333/callback-fail` 测试重试机制

### 测试超时
在测试服务器中添加延迟：
```javascript
app.post('/callback', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 15000)); // 15秒延迟
  res.json({ success: true });
});
```

### 测试并发
同时提交多个问卷，查看服务器是否能正确处理并发请求