# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY web/package*.json ./web/
COPY server/package*.json ./server/

# 安装依赖
RUN cd web && npm install && \
    cd ../server && npm install

# 复制源代码
COPY web ./web
COPY server ./server

# 构建
RUN cd web && npm run build && \
    cd ../server && npm run build

# 运行阶段
FROM node:18-alpine

# 安装nginx
RUN apk add --no-cache nginx

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package*.json ./server/

# 复制nginx配置
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# 确保文件权限正确
RUN chmod -R 755 /app/web/dist

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting nginx..."' >> /app/start.sh && \
    echo 'nginx' >> /app/start.sh && \
    echo 'echo "Starting Node.js server..."' >> /app/start.sh && \
    echo 'cd /app/server && node dist/main.js' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]