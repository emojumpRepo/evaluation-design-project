#!/bin/bash

app_env=${1:-development}

# Check if required directories exist
check_directories() {
    if [ ! -d "/home/devbox/project/web" ]; then
        echo "Error: Frontend directory not found at /home/devbox/project/web"
        exit 1
    fi

    if [ ! -d "/home/devbox/project/server" ]; then
        echo "Error: Backend directory not found at /home/devbox/project/server"
        exit 1
    fi
}

# Development environment commands
dev_commands() {
    echo "Running development environment for xiaoju-survey..."

    # Start backend in development mode (background)
    echo "Starting backend development server..."
    cd /home/devbox/project/server
    npm run dev &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"

    # Wait a moment for backend to start
    sleep 3

    # Start frontend in development mode (foreground)
    echo "Starting frontend development server..."
    cd /home/devbox/project/web
    npm run dev
}

# Production environment commands
# ※Make sure both frontend and backend are built before running
prod_commands() {
    echo "Running production environment for xiaoju-survey..."

    # Check if backend build exists
    if [ ! -f "/home/devbox/project/server/dist/main.js" ]; then
        echo "Error: Backend build not found. Please run 'npm run build' in server directory first."
        exit 1
    fi

    # Check if frontend build exists
    if [ ! -d "/home/devbox/project/web/dist" ]; then
        echo "Error: Frontend build not found. Please run 'npm run build' in web directory first."
        exit 1
    fi

    # Start backend in production mode (background)
    echo "Starting backend production server..."
    cd /home/devbox/project/server
    NODE_ENV=production npm run start:prod &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"

    # Wait for backend to start
    sleep 5

    # Check if backend started successfully
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Error: Backend failed to start"
        exit 1
    fi

    echo "Backend running successfully"

    # For production, you might want to serve frontend with a web server
    # Here we'll use a simple Python server for demonstration
    echo "Starting frontend production server..."
    cd /home/devbox/project/web/dist
    python3 -m http.server 8080 --bind 0.0.0.0
}

# Build commands for preparation
build_commands() {
    echo "Building xiaoju-survey..."

    # Build backend
    echo "Building backend..."
    cd /home/devbox/project/server
    npm run build

    # Build frontend
    echo "Building frontend..."
    cd /home/devbox/project/web
    npm run build

    echo "Build completed successfully!"
}

# Check directories first
check_directories

# Check environment variables to determine the running environment
case "$app_env" in
    "production"|"prod")
        echo "Production environment detected"
        prod_commands
        ;;
    "build")
        echo "Build mode detected"
        build_commands
        ;;
    *)
        echo "Development environment detected"
        dev_commands
        ;;
esac
