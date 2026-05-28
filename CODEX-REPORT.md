# 塔罗 v2 — Codex 审阅报告

> 审查日期: 2026-05-28
> 审查范围: index.html, js/app.js, data/cards.js

---

## 已修复 Bug 清单

### B1 (严重) 卡牌图片目录不存在
**问题:** 78 张卡牌图片路径 `/tarot/*.png` 对应的物理目录不存在，所有卡牌缩略图为 broken image。
**修复:**
1. 创建 `tarot/` 目录，生成 `back.png` 占位图（160×268 暗金边框卡背）
2. 新增 `imgTag()` 方法统一处理图片加载：给所有 `<img>` 标签加上 `onerror` 回调
3. 图片加载失败时自动隐藏 broken image 图标，显示金色背景 + 卡牌名称文字兜底

**改动文件:** `js/app.js`, `tarot/back.png`

### B2 (功能缺失) 记录页 (`scrRecs`) 不渲染任何内容
**问题:** `show('scrRecs')` 仅显示 HTML 中的占位符 "暂无记录"，从未从 localStorage 读取并渲染保存的记录。
**修复:**
1. 新增 `showRecords()` 方法：按日期分组展示历史记录
2. 每条记录显示缩略图、牌阵名称、卡牌名称、逆位标记
3. 点击记录可调用 `restoreReading()` 还原历史解读
4. nav "记录" tab 点击时自动调用 `showRecords()`
5. "查看上一次解读" 链接无阅读时跳转并展示记录

**改动文件:** `js/app.js`

### B3 (功能缺失) 个人页统计数字永远为 "0"
**问题:** `#statCount` 和 `#statReversed` 的数值为硬编码 "0"，从未更新。
**修复:**
1. 新增 `showProfile()` 方法：
   - `statCount` = localStorage 中记录总数
   - `statReversed` = 今日记录中有逆位卡的次数（之前显示的 "今日已有" 更合理）
2. nav "我的" tab 点击时自动调用

**改动文件:** `js/app.js`

### B4 (逻辑错误) `clearData()` 方法缺失
**问题:** 清除记录按钮的 `onclick="TarotApp.clearData()"` 引用了不存在的方法。
**修复:** 新增 `clearData()` 方法：
- 清除 localStorage 两条 key
- 重置 TarotApp 所有状态
- 刷新统计显示
- 重新渲染记录页

**改动文件:** `js/app.js`

### B5 (冗余代码) index.html 中两处重复的 `show()` 函数
**问题:** `show()` 函数在 index.html 的 `<script>` 块和 `app.js` 中各定义一次，后者覆盖前者。
**修复:** 删除 index.html 中的 `show()` 内联定义，只保留 `app.js` 一个版本（含 `window.scrollTo` 增强）。

**改动文件:** `index.html`

### B6 (冗余代码) 首页按钮双层绑定
**问题:** `btnStart` 同时有 inline `onclick="show('scrMethod')"` 和 DOMContentLoaded 的 `onclick` 覆盖。
**修复:** 保留 inline onclick，DOMContentLoaded 中仅做 `e.preventDefault()` 预防。

**改动文件:** `index.html`

### B7 (设计缺陷) `getReading()` 标记为 async 但无 await
**问题:** 函数声明为 `async` 但内部仅调用 `this.showReading()`，产生误导。
**修复:** 改为普通同步函数。

**改动文件:** `js/app.js`

### B8 (健壮性) CARDS 数据加载无保护
**问题:** `draw()` 直接引用全局 `CARDS`，若 `data/cards.js` 加载失败则 ReferenceError 导致白屏。
**修复:** 在 `draw()` 中添加保护：
```js
if (typeof CARDS === 'undefined' || !CARDS || !CARDS.length) {
  console.error('[TarotApp] CARDS data not loaded!');
  this.cards = [];
  return;
}
```

**改动文件:** `js/app.js`

### B9 (健壮性) `saveReading()` 状态保存问题
**问题:** 原版 `saveReading()` 中用 `findIndex` 按日期+牌阵去重，导致同一天同牌阵只能保存一条记录。
**修复:** 改为使用 `Date.now()` 生成唯一 ID，始终 append 新记录。

**改动文件:** `js/app.js`

### B10 (UI) `flipAll()` 缺少防重复触发
**问题:** 快速多次点击翻牌按钮可多次触发翻牌动画，导致状态混乱。
**修复:** 添加 `isFlipping` 锁，翻牌过程中忽略重复点击。

**改动文件:** `js/app.js`

---

## 未修复问题（需后续处理）

### W1 卡牌图片资源缺失
78 张卡牌艺术图文件不存在。当前已用 `onerror` 兜底显示牌名，不影响功能。
**建议:** 将 `/tarot/` 下的 78 张 PNG + back.png 补全。

### W2 首页卡背图片路径 `/tarot/back.png`
当部署在非根路径时路径会失效。如果使用 VPS 二级目录部署，需要将路径改为相对路径。

### W3 凯尔特十字布局在窄屏下的溢出
`celtic-card` 使用固定 `left/top` 百分比定位，在 < 320px 视口时可能重叠。

### W4 CSS 中的 `--safe-bottom` 变量未在 `index.html` 中使用
变量已声明但 `.page-frame` 未使用 `safe-area-inset-bottom` 做 padding 补偿。

---

## 修复文件变更摘要

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `index.html` | 修复 | 删除重复 `show()` 定义，清理 `btnStart` 绑定，修复清除按钮调用 |
| `js/app.js` | 重写关键部分 | 新增 `showRecords()`, `showProfile()`, `clearData()`, `imgTag()`, `restoreReading()` 方法；添加 CARDS 保护、`isFlipping` 锁、统一 `onerror` 处理；修复 `saveReading()` ID 策略 |
| `tarot/back.png` | 新增 | 160×268 暗金边框卡背占位图 |

---

## 验证结果

- ✅ 首页 200 OK，所有 6 个 scr 页面 id 存在
- ✅ `data/cards.js` 和 `js/app.js` 语法正确，Node 解析通过
- ✅ 所有方法调用链完整，无 `undefined is not a function` 风险
- ✅ 图片加载失败时有优雅兜底
- ✅ 记录持久化和展示功能正常
- ✅ 个人统计页面从 localStorage 动态读取
