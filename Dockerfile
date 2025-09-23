# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 安装pnpm并设置镜像源
RUN npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com

# 复制package文件和锁文件 - 优化缓存
COPY web/package*.json web/pnpm-lock.yaml* ./web/
COPY server/package*.json server/pnpm-lock.yaml* ./server/

# 安装依赖（使用淘宝镜像源）
RUN cd web && pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com && \
    cd ../server && pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

# 复制源代码
COPY web ./web
COPY server ./server

# 构建
RUN cd web && pnpm run build && \
    cd ../server && pnpm run build

# 运行阶段
FROM node:18-alpine

# 安装nginx和supervisor
RUN apk add --no-cache nginx supervisor curl && \
    mkdir -p /var/log/supervisor

WORKDIR /app

# 只复制生产环境需要的文件
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package*.json ./server/

# 复制前端构建产物
COPY --from=builder /app/web/dist ./web/dist

# 复制配置文件
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

# 创建nginx运行所需的目录
RUN mkdir -p /run/nginx && \
    chmod -R 755 /app/web/dist

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]