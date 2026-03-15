@echo off
echo ========================================
echo  AGL - 一键安装/更新/启动
echo ========================================
echo.

:: 拉取最新代码
echo [1/4] 拉取最新代码...
cd /d "%~dp0\.."
git pull origin main
echo.

:: 安装依赖
echo [2/4] 安装依赖...
cd /d "%~dp0"
call npm install
echo.

:: 数据库迁移
echo [3/4] 数据库迁移...
call npx prisma migrate dev --name auto
echo.

:: 检查 .env
if not exist ".env" (
    echo [!] 未找到 .env 文件
    echo     正在从 .env.example 创建...
    copy .env.example .env
    echo     请编辑 src\.env 填入 ANTHROPIC_API_KEY
    echo     然后重新运行此脚本
    pause
    exit /b 1
)

:: 启动
echo [4/4] 启动开发服务器...
echo.
echo  打开浏览器访问 http://localhost:3000
echo  按 Ctrl+C 停止
echo ========================================
echo.
call npm run dev
