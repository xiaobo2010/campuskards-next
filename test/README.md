# CampusKards 测试与演示

```
test/
├── README.md              # 本文件
├── backend/               # 后端 API 集成测试
│   ├── test_shop.py       # 商城/开包测试
│   ├── test_decks.py      # 卡组 CRUD 测试
│   └── test_leaderboard.py# 排行榜测试
├── frontend/              # 前端单元测试
│   ├── vitest.config.ts   # Vitest 配置
│   └── lib/               # 前端工具/API 测试
└── demo/                  # 演示模式前端（离线 UI 预览）
    └── frontend/          # 从生产代码迁移的演示文件
```

## 后端测试（pytest）

```bash
# 安装依赖（如首次运行）
cd backend
pip install -e ".[dev]"

# 运行所有后端测试
pytest tests/                     # 现有测试
pytest ../test/backend/           # 新增测试
pytest tests/ ../test/backend/    # 全部
```

## 前端测试（Vitest）

```bash
# 安装 Vitest
cd frontend
npm install -D vitest

# 运行前端测试
npx vitest run ../test/frontend/

# 监视模式
npx vitest ../test/frontend/
```

## 演示模式

```bash
# 方式一：环境变量启用（旧方式，保持兼容）
NEXT_PUBLIC_DEMO_MODE=true npm run dev

# 方式二：直接查看演示页面源码
# test/demo/frontend/ 中包含从生产代码迁移的演示文件
# 可用浏览器打开或参考其中的 mock 数据结构
```
