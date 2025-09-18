# Makefile for Evaluation Design Project

# 变量定义
# 检测 Docker Compose 命令
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null)
ifndef DOCKER_COMPOSE
    DOCKER_COMPOSE = docker compose
endif

DOCKER = docker
PROJECT_NAME = evaluation-design
IMAGE_NAME = evaluation-design:latest

# 颜色输出
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m # No Color

.PHONY: help
help: ## 显示帮助信息
	@echo "$(GREEN)Evaluation Design Project - Docker Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

.PHONY: build
build: ## 构建 Docker 镜像
	@echo "$(YELLOW)Building Docker image...$(NC)"
	$(DOCKER) build -t $(IMAGE_NAME) .
	@echo "$(GREEN)✓ Image built successfully$(NC)"

.PHONY: up
up: ## 启动所有服务（生产环境）
	@echo "$(YELLOW)Starting production services...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@echo "Application: http://localhost:8080"

.PHONY: up-dev
up-dev: ## 启动开发环境服务（仅数据库和缓存）
	@echo "$(YELLOW)Starting development services...$(NC)"
	$(DOCKER_COMPOSE) -f docker-compose.dev.yaml up -d
	@echo "$(GREEN)✓ Development services started$(NC)"
	@echo "MongoDB: localhost:27017"
	@echo "Redis: localhost:6379"

.PHONY: down
down: ## 停止所有服务
	@echo "$(YELLOW)Stopping services...$(NC)"
	$(DOCKER_COMPOSE) down
	@echo "$(GREEN)✓ Services stopped$(NC)"

.PHONY: down-dev
down-dev: ## 停止开发环境服务
	@echo "$(YELLOW)Stopping development services...$(NC)"
	$(DOCKER_COMPOSE) -f docker-compose.dev.yaml down
	@echo "$(GREEN)✓ Development services stopped$(NC)"

.PHONY: restart
restart: down up ## 重启所有服务

.PHONY: logs
logs: ## 查看所有服务日志
	$(DOCKER_COMPOSE) logs -f

.PHONY: logs-app
logs-app: ## 查看应用日志
	$(DOCKER_COMPOSE) logs -f evaluation-app

.PHONY: logs-mongo
logs-mongo: ## 查看 MongoDB 日志
	$(DOCKER_COMPOSE) logs -f mongo

.PHONY: logs-redis
logs-redis: ## 查看 Redis 日志
	$(DOCKER_COMPOSE) logs -f redis

.PHONY: ps
ps: ## 查看服务状态
	$(DOCKER_COMPOSE) ps

.PHONY: exec-app
exec-app: ## 进入应用容器
	$(DOCKER_COMPOSE) exec evaluation-app /bin/sh

.PHONY: exec-mongo
exec-mongo: ## 进入 MongoDB 容器
	$(DOCKER_COMPOSE) exec mongo mongosh -u root -p k765g6hj

.PHONY: exec-redis
exec-redis: ## 进入 Redis 容器
	$(DOCKER_COMPOSE) exec redis redis-cli

.PHONY: clean
clean: ## 清理所有容器、卷和网络
	@echo "$(RED)Warning: This will remove all containers, volumes, and networks!$(NC)"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "$(GREEN)✓ Cleanup completed$(NC)"

.PHONY: clean-dev
clean-dev: ## 清理开发环境
	@echo "$(RED)Warning: This will remove dev containers, volumes, and networks!$(NC)"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	$(DOCKER_COMPOSE) -f docker-compose.dev.yaml down -v --remove-orphans
	@echo "$(GREEN)✓ Development cleanup completed$(NC)"

.PHONY: backup
backup: ## 备份数据库
	@echo "$(YELLOW)Backing up database...$(NC)"
	@mkdir -p ./backups
	$(DOCKER_COMPOSE) exec -T mongo mongodump -u root -p k765g6hj --archive > ./backups/mongo-backup-$$(date +%Y%m%d-%H%M%S).archive
	@echo "$(GREEN)✓ Backup completed$(NC)"

.PHONY: restore
restore: ## 恢复数据库（需要提供 BACKUP_FILE 参数）
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Error: Please provide BACKUP_FILE parameter$(NC)"; \
		echo "Usage: make restore BACKUP_FILE=./backups/mongo-backup-xxx.archive"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring database from $(BACKUP_FILE)...$(NC)"
	$(DOCKER_COMPOSE) exec -T mongo mongorestore -u root -p k765g6hj --archive < $(BACKUP_FILE)
	@echo "$(GREEN)✓ Restore completed$(NC)"

.PHONY: test
test: ## 运行测试
	@echo "$(YELLOW)Running tests...$(NC)"
	cd web && npm run test
	cd server && npm run test
	@echo "$(GREEN)✓ Tests completed$(NC)"

.PHONY: lint
lint: ## 运行代码检查
	@echo "$(YELLOW)Running lint...$(NC)"
	cd web && npm run lint
	cd server && npm run lint
	@echo "$(GREEN)✓ Lint completed$(NC)"

.PHONY: install
install: ## 安装项目依赖
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	cd web && npm install
	cd server && npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

.PHONY: dev
dev: ## 启动本地开发环境
	@echo "$(YELLOW)Starting local development...$(NC)"
	@make up-dev
	@echo "$(YELLOW)Starting frontend...$(NC)"
	cd web && npm run dev &
	@echo "$(YELLOW)Starting backend...$(NC)"
	cd server && npm run dev
	@echo "$(GREEN)✓ Development environment started$(NC)"

.PHONY: version
version: ## 显示版本信息
	@echo "$(GREEN)Evaluation Design Project$(NC)"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$($(DOCKER_COMPOSE) version 2>/dev/null || echo 'Not installed')"
	@echo "Image: $(IMAGE_NAME)"

.PHONY: check-compose
check-compose: ## 检查 Docker Compose 安装
	@echo "Checking Docker Compose..."
	@which docker-compose >/dev/null 2>&1 && echo "docker-compose found" || echo "docker-compose not found"
	@docker compose version >/dev/null 2>&1 && echo "docker compose (plugin) found" || echo "docker compose (plugin) not found"