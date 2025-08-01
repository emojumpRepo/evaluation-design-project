#!/bin/bash

# 启动后端服务（后台）
cd /xiaoju-survey/server
npm run start:prod &

# 启动nginx（前台，主进程）
echo 'nginx start'
nginx -g 'daemon off;' 