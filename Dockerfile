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
COPY docker-run.sh /xiaoju-survey/docker-run.sh

# 构建前端，增加内存限制和优化选项
RUN cd /xiaoju-survey/web && NODE_OPTIONS="--max-old-space-size=4096" npm run build-only

# 构建后端
RUN cd /xiaoju-survey/server && npm run build

# 覆盖nginx配置文件
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf

# 暴露端口 需要跟nginx的port一致
EXPOSE 80

# docker入口文件,启动nginx和运行pm2启动,并保证监听不断
CMD ["sh","docker-run.sh"]
