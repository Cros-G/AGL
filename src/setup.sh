#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo " AGL - 一键安装/更新/启动"
echo "========================================"
echo ""

# 拉取最新代码
echo "[1/5] 拉取最新代码..."
cd "$PROJECT_ROOT"
git pull origin main
echo ""

# 安装依赖
echo "[2/5] 安装依赖..."
cd "$SCRIPT_DIR"
npm install
echo ""

# 数据库迁移
echo "[3/5] 数据库迁移..."
cd "$SCRIPT_DIR"
npx prisma generate
npx prisma migrate dev --name auto
echo ""

# 检查 .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "[!] 未找到 .env 文件"
    echo "    正在从 .env.example 创建..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo ""
    echo "    请编辑 $SCRIPT_DIR/.env 填入 ANTHROPIC_API_KEY"
    echo "    然后重新运行: cd src && ./setup.sh"
    exit 1
fi

# 启动
echo "[4/5] 构建检查..."
echo "[5/5] 启动开发服务器..."
echo ""
echo " 打开浏览器访问 http://localhost:3000"
echo " 按 Ctrl+C 停止"
echo "========================================"
echo ""
cd "$SCRIPT_DIR"
npm run dev
