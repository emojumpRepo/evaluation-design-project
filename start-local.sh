#!/bin/bash
# 简单的本地开发启动脚本

echo "========================================="
echo "启动评估设计项目 - 本地开发模式"
echo "========================================="

# 检查是否安装了必要的工具
command -v node >/dev/null 2>&1 || { echo "错误: 需要安装 Node.js"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "错误: 需要安装 npm"; exit 1; }

# 启动MongoDB（使用Docker）
echo "1. 启动MongoDB..."
docker run -d \
  --name evaluation-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=k765g6hj \
  -e MONGO_INITDB_DATABASE=xiaojuSurvey \
  mongo:7.0 2>/dev/null || echo "MongoDB可能已在运行"

# 等待MongoDB启动
echo "等待MongoDB启动..."
sleep 5

# 安装后端依赖
echo "2. 安装后端依赖..."
cd server
npm install

# 启动后端
echo "3. 启动后端服务..."
npm run dev &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "等待后端启动..."
sleep 10

# 安装前端依赖
echo "4. 安装前端依赖..."
cd web
npm install

# 启动前端
echo "5. 启动前端服务..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================="
echo "应用已启动！"
echo "前端访问: http://localhost:8080"
echo "后端API: http://localhost:3000"
echo "MongoDB: localhost:27017"
echo "========================================="
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker stop evaluation-mongo 2>/dev/null; exit" INT

# 保持脚本运行
wait