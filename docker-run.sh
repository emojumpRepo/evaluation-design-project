#!/bin/sh

set -e

echo "========================================="
echo "Starting Evaluation Design Application"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查目录是否存在
check_directory() {
    if [ ! -d "$1" ]; then
        echo "${RED}Error: $1 directory not found${NC}"
        exit 1
    fi
}

# 检查文件是否存在
check_file() {
    if [ ! -f "$1" ]; then
        echo "${RED}Error: $1 file not found${NC}"
        exit 1
    fi
}

# 打印状态信息
print_status() {
    echo "${GREEN}✓${NC} $1"
}

# 打印警告信息
print_warning() {
    echo "${YELLOW}⚠${NC} $1"
}

# 检查必要的目录和文件
print_status "Checking application directories..."
check_directory "/app/server"
check_directory "/app/web"
check_directory "/app/server/dist"
check_directory "/app/web/dist"

print_status "Checking backend build files..."
check_file "/app/server/dist/main.js"

# 设置环境变量
print_status "Setting up environment variables..."
export NODE_ENV=${NODE_ENV:-production}
export PORT=3000

echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  MongoDB: ${XIAOJU_SURVEY_MONGO_URL:-Not configured}"

# 创建日志目录
mkdir -p /app/logs
print_status "Log directory created at /app/logs"

# 启动后端服务
print_status "Starting backend service..."
cd /app/server

# 使用 node 直接运行，避免 npm 脚本权限问题
node dist/main.js > /app/logs/backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
echo "Waiting for backend to start..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        print_status "Backend is running (PID: $BACKEND_PID)"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "${RED}Error: Backend failed to start within 60 seconds${NC}"
    echo "Backend logs:"
    tail -n 50 /app/logs/backend.log
    exit 1
fi

# 配置 nginx（处理用户权限问题）
print_status "Configuring nginx..."
if [ "$(id -u)" != "0" ]; then
    print_warning "Running as non-root user, adjusting nginx configuration..."
    # 创建用户可写的临时目录
    mkdir -p /tmp/nginx
    mkdir -p /tmp/nginx/client_body_temp
    mkdir -p /tmp/nginx/proxy_temp
    mkdir -p /tmp/nginx/fastcgi_temp
    mkdir -p /tmp/nginx/uwsgi_temp
    mkdir -p /tmp/nginx/scgi_temp
    
    # 修改 nginx 配置以使用临时目录
    sed -i 's|/var/run/nginx.pid|/tmp/nginx/nginx.pid|g' /etc/nginx/nginx.conf
    sed -i 's|/var/log/nginx|/app/logs|g' /etc/nginx/nginx.conf
fi

# 启动 nginx
print_status "Starting nginx..."
echo "========================================="
echo "${GREEN}Application started successfully!${NC}"
echo "Access the application at: http://localhost:8080"
echo "========================================="

# 使用 trap 确保子进程被正确清理
trap 'kill $BACKEND_PID 2>/dev/null || true; exit' INT TERM

# 启动 nginx 并保持前台运行
nginx -g 'daemon off;'