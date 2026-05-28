# 塔罗 v2 代码审查报告

## 审查结论

- **审查者**: Claude Code (subagent)
- **审查时间**: 2026-05-28
- **发现 Bug**: 11 个
- **已修复**: 11 个
- **功能测试**: 20/20 通过

---

## 一、发现的问题及修复

### 🔴 Bug 1: 卡牌图片不存在，全部 404 （Critical）

**发现**: 项目本地目录没有 `/tarot/` 图片目录。所有 78 张卡牌图片 (`/tarot/00_the_fool.png` 等) 和卡背图 (`/tarot/back.png`) 在本地运行时全部 404。

**修复**: 在 `app.js` 新增 `imgTag()` 辅助函数，为所有 `<img>` 标签添加 `onerror` 自愈处理——图片加载失败时自动隐藏图片并在父容器显示金色半透明背景色，保证页面不会出现烂图或空白。

**影响范围**: index.html 首页卡背图、draw 页面卡背图、flip 后卡牌正面图、reading 页缩略图、modal 大图。

### 🔴 Bug 2: 记录页不加载已保存的记录 （Critical）

**发现**: 用户点击底部导航"记录"时，只显示静态的 `<p class="empty">暂无记录</p>`。`app.js` 没有任何函数从 `localStorage` 读取并渲染记录列表。

**修复**: 新增 `TarotApp.showRecords()` 方法：
- 按日期分组展示历史记录
- 每条显示卡牌缩略图、牌名、牌阵名称、意图
- 支持点击恢复查看历史解读 (`restoreReading`)
- 无记录时显示"暂无记录"
- 在 nav 点击和 `show()` 函数中自动触发

### 🔴 Bug 3: 个人中心统计永远显示 0 （Critical）

**发现**: 个人中心的 `statCount` (占卜次数) 和 `statReversed` (今日已有) 始终为 0，因为没有代码从 localStorage 计算实际数据。

**修复**: 新增 `TarotApp.showProfile()` 方法，从 `tv7sim_records_v2` 计算总占卜次数和今日次数，写入对应 DOM 元素。nav 点击时自动触发。

### 🟡 Bug 4: `hasReading` 状态无法持久化

**发现**: `restoreState()` 通过 `this.reading` 是否为空字符串判断 `hasReading`，但 `reading` 字段在 `draw()` 中被设为 `''` 且 `saveState()` 保存时 `reading` 始终为 `''`，导致页面刷新后 `hasReading` 总是 `false`。

**修复**: 
- `saveState()` 新增 `hasReading` 字段到 JSON
- `restoreState()` 直接读取 `data.hasReading` 而非从 `reading` 推导

### 🟡 Bug 5: `saveReading()` 同天同牌阵覆盖旧记录

**发现**: 原代码使用 `findIndex` 查找同天同牌阵的记录并替换，导致用户在同一天做第二次单牌占卜时，第一次的记录被覆盖丢失。

**修复**: 删除了 dedup 逻辑，改为始终 `unshift` 追加新记录，并给每条记录分配唯一 `id`（基于时间戳+随机数）。

### 🟡 Bug 6: `getReading()` 是 `async` 死代码

**发现**: `getReading()` 标记为 `async` 但不执行任何异步操作，只是调用 `showReading()`。`flipAll()` 中的调用链是 `hasReading→saveState→getReading→showReading`，其中 `getReading` 毫无意义。

**修复**: 移除 `getReading()` 方法，`flipAll()` 直接调用 `this.showReading()`。

### 🟡 Bug 7: 两次 `saveState()` 调用

**发现**: `flipAll()` 先调 `saveState()`，然后 `showReading()` 结尾又调一次，造成不必要的重复写入。

**修复**: 只保留 `flipAll()` 中的一次 `saveState()` 调用。

### 🟡 Bug 8: `renderHomeCard()` 无用代码

**发现**: `init()` 中调用的 `renderHomeCard()` 只是重新设置了首页的一张静态图片，而该图片已在 index.html 的 HTML 模板中写死。

**修复**: 移除了 `renderHomeCard()` 方法及 `init()` 中的调用。

### 🟡 Bug 9: `flipAll()` 无防重复调用保护

**发现**: 如果用户在翻转动画期间连续点击"翻牌解读"按钮，`flipAll()` 会被多次调用，导致多个 setTimeout 重叠、`showReading` 被多次触发。

**修复**: 新增 `isFlipping` 状态开关，`flipAll()` 入口检查，正在翻转时直接 return。

### 🟢 Bug 10: nav 点击"记录"和"我的"时不加载数据

**发现**: `bindEvents()` 中的 nav 点击处理只是简单地 `show(page)`，不会自动加载记录列表或统计数据。

**修复**: nav 点击处理增加 `showRecords()` 和 `showProfile()` 的自动触发。同时在 index.html 的 `show()` 函数中也加入相同逻辑以防外部直接调用 `show()`。

### 🟢 Bug 11: `restoreReading` 不存在

**发现**: 之前没有任何代码可以实现"从历史记录恢复并查看解读"的功能。

**修复**: 新增 `TarotApp.restoreReading(id)` 方法，从 localStorage 查找对应记录，恢复 `cards`、`spread`、`hasReading` 等状态，然后调用 `showReading()`。

---

## 二、变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `js/app.js` | ✅ 重写 | 新增 imgTag、showRecords、showProfile、restoreReading、isFlipping 保护；移除 getReading、renderHomeCard、双 saveState |
| `index.html` | ✏️ 微调 | CSS 增加 `.rec-thumb-img` 共用样式 |

---

## 三、测试结果

```
CARDS loaded: 78 cards
Valid cards: 78/78
TarotApp: loaded
  PASS: init spread=1
  PASS: selectSpread(3)
  PASS: draw(1) returns 1 card
  PASS: draw(3) returns 3 unique cards
  PASS: draw(5) returns 5 cards
  PASS: draw(10) returns 10 cards
  PASS: draw resets hasReading
  PASS: save/restore preserves cards and hasReading
  PASS: saveReading appends records
  PASS: saveReading creates record with id
  PASS: imgTag includes onerror handler
  PASS: showRecords does not crash when empty
  PASS: showRecords does not crash with records
  PASS: showProfile does not crash
  PASS: restoreReading invalid id does not crash
  PASS: restoreReading valid id works
  PASS: SP labels all spreads covered
  PASS: reversed cards have rev data
  PASS: isFlipping guard on flipAll
  PASS: localStorage write failure is silent

=== RESULTS: 20 passed, 0 failed ===
```

---

## 四、未修问题（需后续讨论）

1. **卡牌图片不存在** — `imgTag` 的 `onerror` fallback 只是视觉效果兜底，真正部署时需要准备 78 张 PNG 放 `/tarot/` 目录。建议将每张图片压缩至 200-400KB 以内。
2. **"清除记录"后不自动刷新统计** — 目前 inline onclick 使用 `location.reload()` 实现，刷新后 stats 读空数据展示 0。可接受。
