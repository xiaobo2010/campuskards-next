#!/usr/bin/env bash
# 将 .service.example 安装为 systemd 单元，替换 __PROJECT_ROOT__ 为实际路径
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "项目根目录: ${PROJECT_ROOT}"
echo ""

for svc in campuskards-backend campuskards-frontend; do
  src="${SCRIPT_DIR}/${svc}.service.example"
  dst="/etc/systemd/system/${svc}.service"

  if [[ ! -f "$src" ]]; then
    echo "跳过: 模板不存在 $src"
    continue
  fi

  echo "生成 ${dst} ..."
  sed "s|__PROJECT_ROOT__|${PROJECT_ROOT}|g" "$src" | sudo tee "$dst" > /dev/null
done

sudo systemctl daemon-reload
echo ""
echo "安装完成。启用并启动服务:"
echo "  sudo systemctl enable --now campuskards-backend campuskards-frontend"
