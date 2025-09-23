# 小桔调研系统 - 部署版

基于滴滴开源的XIAOJUSURVEY定制的企业调研系统，提供问卷、考试、测评和表单功能。

## 快速部署

### 前置要求

- Docker 20.10+
- Docker Compose 1.29+
- 服务器内存 >= 2GB
- 开放端口：8080（应用）、6379（Redis）

### 部署步骤

#### 1. 克隆代码

```bash
git clone https://github.com/didi/xiaoju-survey.git
cd xiaoju-survey
```

#### 2. 配置环境变量

编辑 `docker-compose.yaml` 文件，修改以下配置：

```yaml
environment:
  # MongoDB配置（必须修改为你的数据库）
  XIAOJU_SURVEY_MONGO_URL: mongodb://username:password@your-mongo-host:port/?directConnection=true
  XIAOJU_SURVEY_MONGO_DB_NAME: xiaojuSurvey
  
  # Redis配置
  REDIS_HOST: redis
  REDIS_PORT: 6379
  
  # AI配置（可选）
  AImodel_API_URL: ${AImodel_API_URL}
  AImodel_API_KEY: ${AImodel_API_KEY}
  AImodel_MODEL: ${AImodel_MODEL}
```

#### 3. 构建并启动服务

```bash
# 构建镜像并启动
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

#### 4. 访问服务

- 管理端：`http://your-server-ip:8080/management`
- 渲染端：`http://your-server-ip:8080/render/:surveyPath`
- API文档：`http://your-server-ip:8080/swagger`

## 访问链路说明

### HTTPS访问链路
```
https://evaluation.emojump.com/
    ↓ (443端口，SSL终止)
外部Nginx (/etc/nginx/nginx.conf)
    ↓ (proxy_pass http://127.0.0.1:8080)
Docker容器映射 (host:8080 → container:8080)
    ↓
容器内Nginx (/xiaoju-survey/nginx/nginx.conf，监听8080端口)
    ↓ (proxy_pass http://backend，即127.0.0.1:3000)
容器内Node.js应用 (监听3000端口)
```

### HTTP访问链路
```
http://evaluation.emojump.com/
    ↓ (80端口)
外部Nginx
    ↓ (301重定向)
https://evaluation.emojump.com/ (然后走HTTPS链路)
```

### IP直接访问链路
```
http://139.199.229.215/
    ↓ (80端口)
外部Nginx
    ↓ (proxy_pass http://127.0.0.1:8080)
Docker容器映射 → 容器内Nginx → Node.js应用 (同HTTPS链路)
```

## 服务管理

```bash
# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 更新代码后重新部署
git pull
docker-compose up -d --build
```

## 数据备份

### Redis备份
```bash
# 备份
docker-compose exec redis redis-cli BGSAVE
docker cp xiaoju-survey_redis_1:/data/dump.rdb ./backup/redis-$(date +%Y%m%d).rdb

# 恢复
docker cp ./backup/redis-backup.rdb xiaoju-survey_redis_1:/data/dump.rdb
docker-compose restart redis
```

### MongoDB备份（远程数据库）
```bash
# 备份
mongodump --uri="mongodb://username:password@your-mongo-host:port/xiaojuSurvey" --out=./backup/mongo-$(date +%Y%m%d)

# 恢复
mongorestore --uri="mongodb://username:password@your-mongo-host:port/xiaojuSurvey" ./backup/mongo-20240101
```

## Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name survey.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL配置

```bash
# 安装certbot
apt-get install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d survey.yourdomain.com

# 自动续期
certbot renew --dry-run
```

## 故障排查

### 服务无法启动
```bash
# 查看错误日志
docker-compose logs app | grep ERROR

# 检查端口占用
netstat -tuln | grep 8080
```

### MongoDB连接失败
```bash
# 测试连接
docker-compose exec app sh
nc -zv your-mongo-host port
```

### Redis版本问题
如果遇到RDB格式版本不兼容：
```bash
# 清理Redis数据重新开始
docker-compose down
docker volume rm evaluation-design-project_redis-data
docker-compose up -d
```

### 健康检查
```bash
# 手动测试
curl http://localhost:8080/api/health

# 查看健康状态
docker inspect xiaoju-survey_app_1 | grep -A 10 Health
```

## 监控和日志

```bash
# 实时监控资源使用
docker stats

# 查看容器日志
docker-compose logs --tail=100 -f app

# 导出日志
docker-compose exec app cat /var/log/nodejs.stdout.log > app.log
```

## 生产环境建议

1. **使用外部数据库服务**：云服务商的MongoDB和Redis服务
2. **配置负载均衡**：部署多个应用实例
3. **监控告警**：使用Prometheus + Grafana
4. **定期备份**：设置自动备份脚本和异地存储

## License

本项目基于 Apache-2.0 协议开源