# AGL — 学习需求诊断工具

AI 驱动的企业培训需求诊断工具。通过结构化对话，帮助讲师从模糊的培训需求中识别真实的绩效问题及根因。

## 快速部署

### 前置要求

- Node.js 18+
- npm
- Anthropic API Key（Claude）
- 如果在国内，需要 HTTP 代理访问 Claude API

### 1. 克隆项目

```bash
git clone https://github.com/Cros-G/AGL.git
cd AGL
```

### 2. 安装依赖

```bash
cd src
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `src/.env`，填入：

```env
# 必填
ANTHROPIC_API_KEY=sk-ant-api03-你的key

# 模型（可选，有默认值）
ANTHROPIC_MODEL=claude-opus-4-6
ANTHROPIC_MINI_MODEL=claude-sonnet-4-6

# 代理（国内必填）
HTTPS_PROXY=http://127.0.0.1:7897
```

### 4. 初始化数据库

```bash
npx prisma migrate dev
```

这会在 `src/prisma/dev.db` 创建 SQLite 数据库。

### 5. 启动

```bash
npm run dev
```

打开 http://localhost:3000

### 6.（可选）文档处理服务

如果需要上传 PDF/Word 文档：

```bash
cd services/doc-processor
pip install -r requirements.txt
python main.py
```

在 `src/.env` 中加上：

```env
DOC_PROCESSOR_URL=http://127.0.0.1:8100
```

## 项目结构

```
AGL/
├── src/                    # Next.js 全栈应用
│   ├── src/
│   │   ├── app/            # 页面和 API 路由
│   │   ├── components/     # UI 组件
│   │   ├── lib/agent/      # Agent Loop + Tool 定义
│   │   ├── stores/         # Zustand 状态管理
│   │   └── types/          # TypeScript 类型
│   └── prisma/             # 数据库 schema
├── services/doc-processor/ # Python 文档处理服务
├── docs/                   # 开发计划
├── prompts/                # PRD、设计文档、Agent Prompt
└── materials/              # 业务背景资料
```

## 技术栈

- **前端**: Next.js 16 + React 19 + Tailwind CSS + Zustand
- **后端**: Next.js API Routes + SQLite (Prisma)
- **AI**: Claude API (原生 tool_use，非 SDK)
- **文档处理**: Python FastAPI + PaddleOCR + markitdown
