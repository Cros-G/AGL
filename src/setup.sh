#!/bin/bash
echo "========================================"
echo " AGL - 一键安装/更新/启动"
echo "========================================"
echo ""

# 拉取最新代码
echo "[1/4] 拉取最新代码..."
cd "$(dirname "$0")/.."
git pull origin main
echo ""

# 安装依赖
echo "[2/4] 安装依赖..."
cd "$(dirname "$0")"
npm install
echo ""

# 数据库迁移
echo "[3/4] 数据库迁移..."
npx prisma migrate dev --name auto
echo ""

# 检查 .env
if [ ! -f ".env" ]; then
    echo "[!] 未找到 .env 文件"
    echo "    正在从 .env.example 创建..."
    cp .env.example .env
    echo "    请编辑 src/.env 填入 ANTHROPIC_API_KEY"
    echo "    然后重新运行此脚本: bash setup.sh"
    exit 1
fi

# 启动
echo "[4/4] 启动开发服务器..."
echo ""
echo " 打开浏览器访问 http://localhost:3000"
echo " 按 Ctrl+C 停止"
echo "========================================"
echo ""
npm run dev
