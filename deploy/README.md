# CampusKards 部署文档

## 目录结构

```
deploy/
├── deploy.sh              # 交互式部署总控（菜单选择）
├── deploy-backend.sh      # 后端独立部署
├── deploy-frontend.sh     # 前端独立部署
├── rollback.sh            # 回滚工具（代码/数据库）
├── xiaoboserver/          # 生产服务器配置（systemd）
│   ├── .env.example
│   ├── backup.sh
│   ├── campuskards-backend.service
│   ├── campuskards-frontend.service
│   └── deploy.sh
└── logs/                  # 部署日志（自动生成）
```

## 使用方式

### 交互式总控（推荐）

```bash
# 全自动交互菜单
sudo bash deploy/deploy.sh
```

提供 6 种模式：
1. **全量部署** — 拉代码 → 后端依赖 → 前端构建 → 迁移 → 重启
2. **仅后端** — 拉代码 → 依赖 → 迁移 → （可选）重启
3. **仅前端** — 拉代码 → 依赖 → 构建 → （可选）重启
4. **仅重启服务** — 重启前/后端 systemd 服务
5. **仅迁移** — 数据库备份 + alembic upgrade
6. **退出**

### 独立部署

```bash
# 后端（交互式，每步可确认/跳过）
sudo bash deploy/deploy-backend.sh

# 前端（交互式，可清理缓存/选择分支）
sudo bash deploy/deploy-frontend.sh
```

### 回滚

```bash
sudo bash deploy/rollback.sh
```

支持：
- 回滚代码到指定 Git 提交
- 回滚代码 + 数据库迁移降级
- 仅回滚数据库迁移

## 部署流程

```
预检 → Git Pull → 依赖安装 → 构建/迁移 → 重启 → 验证
```

- 预检：检查命令/版本/磁盘/未提交更改
- 每步可交互确认/跳过
- 自动记录日志到 `deploy/logs/`
