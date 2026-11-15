#!/usr/bin/env bash
# awesome-design-md 本地调用工具
# 用法: ./design.sh list | search <关键词> | info <slug> | use <slug> [目标目录] | open <slug>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$ROOT/awesome-design-md/design-md"

if [ ! -d "$LIB" ]; then
  echo "找不到 $LIB，请先执行：git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git" >&2
  exit 1
fi

usage() {
  cat <<'EOF'
awesome-design-md 本地工具

  ./design.sh list                 列出全部 84 套设计
  ./design.sh search <关键词>      按名称/描述搜索（如 dashboard, dark, green）
  ./design.sh info <slug>          查看配色、字体、圆角等令牌摘要
  ./design.sh use <slug> [目录]    把 DESIGN.md 装进项目（默认当前目录）
  ./design.sh open <slug>          在浏览器打开官方预览页
  ./design.sh tokens <slug>        输出 YAML 令牌（可直接转 Tailwind/CSS 变量）
  ./design.sh css <slug> [选择器]  生成 CSS 变量（默认 :root）

示例:
  ./design.sh search dashboard
  ./design.sh use posthog ./my-app
  ./design.sh tokens vercel > tokens.yaml
  ./design.sh css vercel > app/theme.css
EOF
}

list_all() {
  for d in "$LIB"/*/; do
    slug="$(basename "$d")"
    printf '%-16s %s\n' "$slug" "$(desc_of "$slug" | cut -c1-90)"
  done
}

desc_of() {
  local f="$LIB/$1/DESIGN.md" line
  line="$(grep -m1 '^description:' "$f" 2>/dev/null || true)"
  case "$line" in
    ""|"description: |"|"description: >"|"description: |-"|"description: >-")
      # 多行描述：取 frontmatter 里 description 之后的第一段正文
      awk '/^description: *[|>]/{f=1;next} f&&/^[a-zA-Z-]+:/{exit} f&&NF{gsub(/^ +/,"");print;exit}' "$f" ;;
    *)
      printf '%s\n' "${line#description: }" ;;
  esac
}

search() {
  local kw lc_kw slug found=0
  kw="${1:-}"
  [ -z "$kw" ] && { echo "请给出关键词" >&2; exit 1; }
  lc_kw="$(printf '%s' "$kw" | tr '[:upper:]' '[:lower:]')"
  for d in "$LIB"/*/; do
    slug="$(basename "$d")"
    if printf '%s %s' "$slug" "$(desc_of "$slug")" \
       | tr '[:upper:]' '[:lower:]' | grep -q -- "$lc_kw"; then
      printf '%-16s %s\n' "$slug" "$(desc_of "$slug" | cut -c1-90)"
      found=$((found + 1))
    fi
  done
  [ "$found" -eq 0 ] && echo "没有匹配「$kw」的设计，试试 ./design.sh list"
  return 0
}

info() {
  local slug="${1:?用法: ./design.sh info <slug>}" f="$LIB/$1/DESIGN.md"
  [ -f "$f" ] || { echo "没有 $slug，先 ./design.sh list 看看" >&2; exit 1; }
  echo "== $slug =="
  desc_of "$slug" | fold -s -w 96
  echo
  echo "配色令牌:"
  grep -E '^  [a-z0-9-]+: "#' "$f" | sed 's/: / = /; s/"//g' | head -18 || true
  echo
  echo "字体:"
  grep -E '^ +fontFamily:' "$f" | sed 's/.*fontFamily: //' | sort -u | head -4 || true
  echo
  echo "圆角:"
  awk '/^rounded:/{f=1;next} f&&/^[a-zA-Z-]+:/{exit} f&&NF' "$f" | head -10 || true
  echo
  echo "全文: $f"
}

use_design() {
  local slug="${1:?用法: ./design.sh use <slug> [目录]}" dest="${2:-$PWD}"
  local src="$LIB/$slug/DESIGN.md"
  [ -f "$src" ] || { echo "没有 $slug，先 ./design.sh list 看看" >&2; exit 1; }
  mkdir -p "$dest"
  if [ -f "$dest/DESIGN.md" ]; then
    local backup
    backup="$dest/DESIGN.md.bak.$(date +%Y%m%d%H%M%S)"
    cp "$dest/DESIGN.md" "$backup"
    echo "已备份原 DESIGN.md -> $backup"
  fi
  cp "$src" "$dest/DESIGN.md"
  echo "已安装 $slug -> $dest/DESIGN.md"
  echo
  echo "下一步：在项目根目录的 AGENTS.md 里加一行——"
  echo "  DESIGN.md 是唯一设计来源；所有 UI 必须使用其中的颜色/字体/间距/圆角令牌。"
}

tokens() {
  local slug="${1:?用法: ./design.sh tokens <slug>}" f="$LIB/$1/DESIGN.md"
  [ -f "$f" ] || { echo "没有 $slug" >&2; exit 1; }
  awk 'NR==1 && $0!="---"{exit} NR>1 && /^---$/{exit} NR>1{print}' "$f"
}

css() {
  local slug="${1:?用法: ./design.sh css <slug> [选择器]}" sel="${2:-:root}"
  local f="$LIB/$slug/DESIGN.md"
  [ -f "$f" ] || { echo "没有 $slug" >&2; exit 1; }
  echo "/* $slug — generated from $slug/DESIGN.md */"
  echo "$sel {"
  awk '
    /^[a-zA-Z-]+:/ { block=$0; sub(/:.*/,"",block) }
    block=="colors" && match($0, /^  [a-z0-9-]+: "#[0-9a-fA-F]+"/) {
      key=$1; sub(/:/,"",key); hex=$2; gsub(/"/,"",hex);
      printf "  --color-%s: %s;\n", key, hex
    }
    block=="rounded" && match($0, /^  [a-z0-9-]+: [0-9.]+(px|rem|em)?/) {
      key=$1; sub(/:/,"",key);
      printf "  --radius-%s: %s;\n", key, $2
    }
    block=="spacing" && match($0, /^  [a-z0-9-]+: [0-9.]+(px|rem|em)?/) {
      key=$1; sub(/:/,"",key);
      printf "  --space-%s: %s;\n", key, $2
    }
  ' "$f"
  echo "}"
}

case "${1:-}" in
  list)   list_all ;;
  search) shift; search "$@" ;;
  info)   shift; info "$@" ;;
  use)    shift; use_design "$@" ;;
  tokens) shift; tokens "$@" ;;
  css)    shift; css "$@" ;;
  open)   shift; open "https://getdesign.md/${1:?用法: ./design.sh open <slug>}/design-md" ;;
  *)      usage ;;
esac
