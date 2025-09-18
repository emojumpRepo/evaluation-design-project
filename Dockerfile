# 多阶段构建 - 第一阶段：构建应用
FROM node:18-alpine AS builder

# 设置npm镜像加速
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /builder

# 先复制package文件，利用Docker层缓存
COPY web/package*.json /builder/web/
COPY server/package*.json /builder/server/

# 安装依赖（利用缓存）
RUN cd /builder/web && npm ci --only=production && \
    cd /builder/server && npm ci

# 复制源代码
COPY web/ /builder/web/
COPY server/ /builder/server/

# 构建应用
RUN cd /builder/web && npm run build-only && \
    cd /builder/server && npm run build

# 第二阶段：运行环境（生产镜像）
FROM node:18-alpine

# 安装必要的运行时依赖
RUN apk add --no-cache nginx curl && \
    rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 创建非root用户运行应用
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制构建产物
COPY --from=builder --chown=nodejs:nodejs /builder/web/dist/ /app/web/dist/
COPY --from=builder --chown=nodejs:nodejs /builder/server/dist/ /app/server/dist/
COPY --from=builder --chown=nodejs:nodejs /builder/server/node_modules/ /app/server/node_modules/
COPY --from=builder --chown=nodejs:nodejs /builder/server/public/ /app/server/public/
COPY --from=builder --chown=nodejs:nodejs /builder/server/package*.json /app/server/

# 复制配置文件
COPY --chown=nodejs:nodejs docker-run.sh /app/docker-run.sh
COPY --chown=nodejs:nodejs nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nodejs:nodejs server/.env* /app/server/

# 设置执行权限
RUN chmod +x /app/docker-run.sh

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# 暴露端口
EXPOSE 8080

# 使用非root用户
USER nodejs

# 启动应用
CMD ["/bin/sh", "/app/docker-run.sh"]
