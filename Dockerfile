# 镜像集成
FROM node:18.20.4-slim

# 设置工作区间
WORKDIR /xiaoju-survey

# 安装nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# 设置npm镜像为淘宝镜像源，并增加超时时间
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# 首先复制package.json文件以利用Docker缓存
COPY web/package.json /xiaoju-survey/web/package.json
COPY server/package.json /xiaoju-survey/server/package.json

# 安装前端依赖
RUN cd /xiaoju-survey/web && npm install --network-timeout=300000

# 安装后端依赖
RUN cd /xiaoju-survey/server && npm install --network-timeout=300000

# 复制源代码
COPY web /xiaoju-survey/web
COPY server /xiaoju-survey/server
COPY nginx /xiaoju-survey/nginx

# 构建前端，增加内存限制和优化选项
RUN cd /xiaoju-survey/web && NODE_OPTIONS="--max-old-space-size=4096" npm run build-only

# 构建后端
RUN cd /xiaoju-survey/server && npm run build

# 覆盖nginx配置文件
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf

# 暴露端口 需要跟nginx的port一致
EXPOSE 80

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting xiaoju-survey services..."\n\
\n\
# 检查目录是否存在\n\
if [ ! -d "/xiaoju-survey/server" ]; then\n\
    echo "Error: /xiaoju-survey/server directory not found"\n\
    exit 1\n\
fi\n\
\n\
if [ ! -d "/xiaoju-survey/web" ]; then\n\
    echo "Error: /xiaoju-survey/web directory not found"\n\
    exit 1\n\
fi\n\
\n\
# 检查后端构建文件是否存在\n\
if [ ! -f "/xiaoju-survey/server/dist/main.js" ]; then\n\
    echo "Error: Backend build file not found at /xiaoju-survey/server/dist/main.js"\n\
    echo "Please ensure the backend was built correctly"\n\
    exit 1\n\
fi\n\
\n\
# 启动后端服务（后台）\n\
echo "Starting backend service..."\n\
cd /xiaoju-survey/server\n\
echo "Current directory: $(pwd)"\n\
echo "Backend files:"\n\
ls -la dist/\n\
\n\
# 设置环境变量\n\
export NODE_ENV=production\n\
export PORT=3000\n\
\n\
# 启动后端\n\
npm run start:prod &\n\
BACKEND_PID=$!\n\
\n\
# 等待后端启动\n\
echo "Waiting for backend to start..."\n\
sleep 5\n\
\n\
# 检查后端是否启动成功\n\
if ! kill -0 $BACKEND_PID 2>/dev/null; then\n\
    echo "Error: Backend failed to start"\n\
    exit 1\n\
fi\n\
\n\
echo "Backend started successfully with PID: $BACKEND_PID"\n\
\n\
# 启动nginx（前台，主进程）\n\
echo "Starting nginx..."\n\
nginx -g "daemon off;"' > /xiaoju-survey/start.sh && chmod +x /xiaoju-survey/start.sh

# docker入口文件
CMD ["/xiaoju-survey/start.sh"]
