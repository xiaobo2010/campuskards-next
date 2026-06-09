# CampusKards 测试与演示

```
test/
├── README.md              # 本文件
├── frontend/              # 前端单元测试
│   ├── vitest.config.ts   # Vitest 配置
│   └── lib/               # 前端工具/API 测试
└── demo/                  # 演示模式前端（离线 UI 预览）
    └── frontend/          # 从生产代码迁移的演示文件
```

## 后端测试（pytest）

后端测试已全部整合至 `backend/tests/`（12 个测试文件）。

```bash
cd backend
pytest tests/              # 运行全部 12 个测试
pytest tests/ -v           # 详细输出
```

## 前端测试（Vitest）

```bash
cd frontend
npx vitest run ../test/frontend/
npx vitest ../test/frontend/   # 监视模式
```

## 演示模式

```bash
# 环境变量启用
NEXT_PUBLIC_DEMO_MODE=true npm run dev

# 演示页面源码位于 test/demo/frontend/
```
