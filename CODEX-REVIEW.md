# 塔罗 v2 代码审查任务 — Codex

## 项目信息
- 线上地址：https://tarot.liaomagic.com/v2/
- 源代码目录（VPS）：/var/www/sites/tarot-v2/
- 本地代码：/Users/jinraymond/.openclaw/workspace/tarot-v2/

## 核心文件
- index.html（含内联 CSS + 内联导航 JS）
- data/cards.js（78 张卡牌数据，含正逆位解读文本）
- js/app.js（TarotApp 对象，抽牌/翻转/解读逻辑）

## 已知 Bug 清单

### Bug 1: Cloudflare 缓存导致用户拿到旧版 JS
已在 script 标签加 v=3 参数，但需确认是否彻底解决。
建议：在 app.js 和 cards.js URL 上加随机版本号。

### Bug 2: 选牌阵后“跳过选牌阵”按钮偶尔失效
修复：inline JS 中 btnSkip 的 onclick 改为调用 goDraw()
但用户报告"点跳过没反应"。
怀疑：TarotApp 未初始化完成时调用 renderDraw() 报错。

### Bug 3: 选择牌阵后 draw 页显示占位符 "选择牌阵后开始抽牌"
修复：renderDraw() 中调用 this.draw() 填充 cards 数组。
但可能存在时序问题：draw() 先清空再填充，读卡需要时间。

### Bug 4: 单张牌 flip 后 reading 页不自动显示
修复：flipCard() 末尾加 setTimeout(() => this.getReading(), 1200)
需确认 1200ms 是否足够图片加载，不够需加 loading 回调。

### Bug 5: 图片加载极慢
所有 78 张卡图 + 卡背图，每张 2-4MB PNG。
建议：批量压缩至 200-400KB 有损 JPEG。

### Bug 6: 用户选了一个牌阵后，其他牌阵不可选
原因：选牌阵后自动跳转到 draw 页，用户回不去 method 页继续选。
修复建议：占卜 tab 点回 method 页时重置状态，或允许在 method 页不跳转，只高亮选中项。

## 审查要求
1. 完整阅读 index.html、js/app.js、data/cards.js
2. 本地测试完整流程（首页→选牌阵→抽牌→翻转→解读）
3. 修复发现的所有 bug
4. 输出修复清单和改动的代码
