#!/bin/bash
# 清理历次绕缓存产生的调试/废弃文件。
# 保留最终生效链：index2.html + src/v2/{config,config2,i18n2,data4,bake6,globe6,features3,labels3,ui3,main8} + src/style.css
set -e
cd /mnt/d/workspace/code/ws/earth-atlas

# 删除整个 v1 源码目录（含其测试），v2 不再引用
rm -rf src/core src/data src/i18n src/render src/ui
rm -f src/main.ts src/fresh-main.ts src/probe.ts src/style.css.bak*

# 删除废弃的 v2 中间版本（保留最终链）
rm -f src/v2/bake2.ts src/v2/bake3.ts src/v2/bake5.ts
rm -f src/v2/data2.ts src/v2/data3.ts
rm -f src/v2/globe4.ts src/v2/globe5.ts
rm -f src/v2/main2.ts src/v2/main3.ts src/v2/main4.ts src/v2/main5.ts src/v2/main6.ts src/v2/main7.ts
rm -f src/v2/probe.ts src/v2/fresh-main.ts

# 删除根目录调试页（保留 index2.html 作为入口，index.html 改为重定向）
rm -f bake.html index-fresh.html probe.ts fresh-main.ts

echo "=== 清理后保留的文件 ==="
find src -type f | sort
echo "=== 根目录 html ==="
ls -1 *.html
echo "=== 完成 ==="
