# 塔罗 v2 代码审查任务 — Claude Code

## 项目信息
- 线上地址：https://tarot.liaomagic.com/v2/
- 源代码目录（VPS）：/var/www/sites/tarot-v2/
- 核心文件：index.html（内联CSS+JS）、data/cards.js（78张卡牌数据）、js/app.js（应用逻辑）

## 已知问题（用户反馈 + 我自测发现）
1. 跳过选牌按钮（btnSkip）偶尔不工作，draw页面显示占位符而非实际卡牌
2. 图片加载慢（卡牌图片2-4MB/张）
3. app.js中flipCard()后的getReading() setTimeout延迟时间可能不准
4. 解读页（scrRead）调用showReading()后，reading内容渲染可能失败

## 审查要求

### 1. 代码审查
- 检查app.js中所有函数的执行路径，确认无死代码、空catch、未处理的promise rejection
- 检查localStorage读取/写入的容错
- 检查CSS样式在各页面切换时是否有状态残留
- 检查所有onclick、addEventListener绑定是否正确

### 2. Bug修复
- 如发现bug直接修复代码
- 修复后在本目录测试：`cd /Users/jinraymond/.openclaw/workspace/tarot-v2 && python3 -m http.server 3470`
- 用浏览器打开 http://localhost:3470 测试完整流程

### 3. 输出
写出你发现的所有bug清单和修复内容
