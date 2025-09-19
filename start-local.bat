@echo off
REM 简单的本地开发启动脚本 - Windows版本

echo =========================================
echo 启动评估设计项目 - 本地开发模式
echo =========================================

REM 启动MongoDB（使用Docker）
echo 1. 启动MongoDB...
docker run -d --name evaluation-mongo -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=k765g6hj -e MONGO_INITDB_DATABASE=xiaojuSurvey mongo:7.0 2>nul || echo MongoDB可能已在运行

REM 等待MongoDB启动
echo 等待MongoDB启动...
timeout /t 5 /nobreak >nul

REM 启动后端
echo 2. 启动后端服务...
cd server
start cmd /k "npm install && npm run dev"
cd ..

REM 等待后端启动
echo 等待后端启动...
timeout /t 10 /nobreak >nul

REM 启动前端
echo 3. 启动前端服务...
cd web
start cmd /k "npm install && npm run dev"
cd ..

echo =========================================
echo 应用已启动！
echo 前端访问: http://localhost:8080
echo 后端API: http://localhost:3000
echo MongoDB: localhost:27017
echo =========================================
echo 关闭此窗口不会停止服务，需要手动关闭其他命令窗口
pause