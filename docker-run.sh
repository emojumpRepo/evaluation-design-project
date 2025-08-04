#!/bin/bash

set -e

echo "Starting xiaoju-survey services..."

# 检查目录是否存在
if [ ! -d "/xiaoju-survey/server" ]; then
    echo "Error: /xiaoju-survey/server directory not found"
    exit 1
fi

if [ ! -d "/xiaoju-survey/web" ]; then
    echo "Error: /xiaoju-survey/web directory not found"
    exit 1
fi

# 检查后端构建文件是否存在
if [ ! -f "/xiaoju-survey/server/dist/main.js" ]; then
    echo "Error: Backend build file not found at /xiaoju-survey/server/dist/main.js"
    echo "Please ensure the backend was built correctly"
    exit 1
fi

# 启动后端服务（后台）
echo "Starting backend service..."
cd /xiaoju-survey/server
echo "Current directory: $(pwd)"
echo "Backend files:"
ls -la dist/

# 设置环境变量
export NODE_ENV=production
export PORT=3000

# 启动后端
npm run start:prod &
BACKEND_PID=$!

# 等待后端启动
echo "Waiting for backend to start..."
sleep 5

# 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: Backend failed to start"
    exit 1
fi

echo "Backend started successfully with PID: $BACKEND_PID"

# 启动nginx（前台，主进程）
echo "Starting nginx..."
nginx -g 'daemon off;' 