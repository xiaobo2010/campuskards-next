# 演示模式前端

从生产代码迁移至此。保留离线 UI 预览能力，不干扰主应用。

## 文件说明

```
demo/frontend/
├── lib/
│   ├── demo-mode.ts        # Demo 配置与 token 生成
│   └── demo-mock-api.ts    # Mock API 响应数据
└── app/game/verify/
    └── page.tsx             # UI 验证页面（8 个预览标签）
```

## 使用方式

```bash
# 方式一：从 test 目录直接复制回源码使用
cp -r test/demo/frontend/lib/*     frontend/src/lib/
cp -r test/demo/frontend/app/*     frontend/src/app/

# 方式二：参考其中的 mock 数据编写独立页面
# 参考 demo-mock-api.ts 中的数据结构对接后端
```
