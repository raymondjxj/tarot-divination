# 🃏 塔罗 v2 部署方案

> 生成时间: 2026-05-28
> 基于实际 VPS 探测 + 架构分析

---

## 一、当前架构快照

| 项目 | 值 |
|------|-----|
| 域名 | `tarot.liaomagic.com` (Cloudflare proxied) |
| VPS IP | 65.49.222.127 (LA, IT7 Networks) |
| 系统 | Ubuntu 24.04 LTS, 1GB RAM / 1 vCPU (AMD EPYC-Genoa) |
| 内存现状 | **827MiB/1GiB 使用中 + 675MiB/2GiB swap 已用 → 严重告警** |
| Node.js | v22.22.2 |
| PM2 | `tarot-api` (PID 1274139, 49.2MB, 0 req/min) |
| API 端口 | 3099 (127.0.0.1 only) |
| API 后端 | `reading-api.js` → 纯 Node.js HTTP, 调用 DeepSeek API |
| 前端路径 | `/var/www/sites/tarot-v2/` (9MB) |
| 原始图片 | `/var/www/sites/tarot/*.png` (78张 + back.png ≈ 346MB) |
| 优化图片 | `/var/www/sites/tarot-v2/img/*.jpg` (78张 + back.jpg ≈ 8.8MB) |
| 前端 JS | `app.js` (18K) + `cards.js` (104K, 78张全量数据内嵌) |

### 页面加载速度 (via Cloudflare)

| 资源 | 耗时 | 大小 |
|------|------|------|
| HTML | 0.11s | 17KB |
| cards.js | 0.07s | 104KB |
| back.png | — | **3.1MB** (! 问题) |
| 卡面.jpg | — | 平均 100-140KB/张 |

---

## 二、🔍 探測發現的重要問題

在分析过程中发现了以下几个 bug 和优化机会，**与部署方案同等重要**：

### ⚠️ Bug 1: cards.js 图片扩展名错误

```
cards.js 引用:  "/v2/img/00_fool.png"   → 404 Not Found
实际文件:      /v2/img/00_fool.jpg      → 200 OK
所有 78 张卡都是如此：代码引用 .png 但文件是 .jpg
```

**后果**: 卡面图片完全无法加载。前端虽有 `onerror` 兜底（隐藏并显示背景色），但用户体验极差——用户看到的只是空白卡片。

### ⚠️ Bug 2: 卡背使用 3.1MB 原始 PNG

```
app.js 使用:  /tarot/back.png    (3.1MB, 原始未压缩)
优化版本:     /v2/img/back.jpg   (333KB, 缩小 89%)
```

**后果**: 每次翻牌动画都加载 3.1MB 图片，在手机上尤其慢。

### ⚠️ VPS 内存告警

```
总内存: 1GiB
已用:  827MiB (80%)
Swap:  675MiB/2GiB
```

VPS 在持续换页，虽然 tarot-api 只占 49MB，但系统层面的压力和潜在的 OOM killer 风险不容忽视。

---

## 三、方案对比

### 方案 A: 后端放 NAS，前端留 VPS

| 维度 | 说明 |
|------|------|
| **架构** | VPS 只托管静态文件 (HTML/CSS/JS/JPG)；NAS 运行 Node.js API |
| **VPS 改动** | 极小。删除 PM2 API 进程，Nginx 加 `proxy_pass` 指向 NAS |
| **NAS 需求** | Node.js 环境、PM2 或 Docker、公网可达的 API 端口 |
| **API 暴露方式** | 见下方详细比对 |
| **优点** | API 流量极小 (0 req/min)；VPS 前端面 CDN 性能不变；释放 VPS ~49MB 内存 |
| **缺点** | 需要解决 NAS→公网的通路；API 延迟增加 (用户→VPS→NAS→DeepSeek) |
| **复杂度** | ⭐⭐⭐ 中等 |

#### API 暴露方式对比

| 方式 | 延迟 | 稳定性 | 配置复杂度 | 依赖 | 推荐度 |
|------|------|--------|-----------|------|--------|
| **Cloudflare Tunnel** | +5-10ms | ⭐⭐⭐⭐⭐ | 低 (一行命令) | Cloudflare 免费 | ⭐⭐⭐⭐⭐ |
| **Tailscale** | +2-5ms | ⭐⭐⭐⭐ | 低 | Tailscale 免费版 | ⭐⭐⭐⭐ |
| **DDNS + 端口转发** | +0ms | ⭐⭐⭐ | 中 (看运营商) | 公网 IP | ⭐⭐⭐ |
| **frp** | +5-15ms | ⭐⭐⭐ | 高 | frp 服务端 | ⭐⭐ |
| **仅 VPS 反代 (SSH隧道)** | +0ms | ⭐⭐⭐⭐ | 低 | autossh | ⭐⭐⭐ |

**推荐**: Cloudflare Tunnel → 无需公网 IP，零配置暴露内网服务，免费额度足够

### 方案 B: 全部放 NAS

| 维度 | 说明 |
|------|------|
| **架构** | NAS 运行 Nginx + Node.js API + 静态文件服务 |
| **VPS** | 可释放，或保留作为 Cloudflare 回源站 |
| **NAS 需求** | Nginx / Caddy + Node.js (Docker 或原生)；公网 IP 或 Tunnel |
| **域名** | Cloudflare 仍代理域名，回源指向 NAS |
| **优点** | 彻底摆脱 VPS 费用；家用上行带宽通常 >50KB/s；无内存限制 |
| **缺点** | 家宽稳定性不如数据中心；需要 24h 开机；需要解决 NAT/防火墙 |
| **复杂度** | ⭐⭐⭐⭐ 较高 |

### 方案 C: 混合优化（不动部署）

| 维度 | 说明 |
|------|------|
| **架构** | 保持现有 VPS 部署，只做前端 / 配置优化 |
| **核心措施** | 修复图片bug + 压缩优化 + Cloudflare 规则 + 代码拆分 |
| **VPS 改动** | 中等 (文件替换 + Nginx 配置) |
| **耗时** | 1-2 小时可完成 |
| **优点** | 无风险、立竿见影、不用考虑网络穿透 |
| **缺点** | VPS 1GB 内存瓶颈仍然存在；长期来看不是终极方案 |
| **复杂度** | ⭐ 最低 |

---

### 对比总表

| 指标 | 方案 A (后端→NAS) | 方案 B (全部→NAS) | 方案 C (只优化) |
|------|:-:|:-:|:-:|
| 加载速度提升 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 实施难度 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| 风险 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| 维护成本 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| VPS 释放 | 部分 (省49MB) | 全部 (省1GB) | 不释放 |
| 成本节约 | 少 | 最大 (可取消VPS) | 无 |
| 家用带宽依赖 | 低 (仅 API 流量) | 高 | 无 |
| **推荐优先级** | **🥇 首选** | 作为长期目标 | **🥇 优先执行** |

---

## 四、针对问题的回答

### Q1: NAS 上是否有 Node.js 环境？

**通用回答**: 取决于 NAS 品牌和型号。

- **Synology DSM 7.x**: 可通过 **Docker** 安装 Node.js 镜像，或通过 Package Center 安装 Node.js v18/20/22
- **QNAP**: 同样支持 Docker + Container Station
- **自建 NAS (Linux)**: 直接 `apt install nodejs` 或 `nvm install 22`

**此项目的 Node.js 需求极低**：
- 使用纯内置模块 (http, https)，**零 npm 依赖**
- 内存只需 ~50MB
- 完全兼容 Docker 轻量部署

### Q2: 家宽是否有公网 IP？上行带宽多少？

**推测分析**:
- SSH 连接源 IP 为 `220.198.97.149` → 中国运营商 (大概率电信/联通)
- 任务描述"VPS 上行带宽 50KB/s" → 反推用户下载速度约 5-10Mbps
- **中国家宽通常**: 下行 100-1000Mbps / 上行 20-50Mbps
- 部分运营商分配 **NAT 内网 IP** (CGNAT)，需要申请公网 IP

**最佳实践**:
- 先登录路由器查 WAN IP，与 `ip.sb` 结果对比 → 一致则有公网 IP
- 不一致 → 打电话给运营商申请公网 IP (通常免费)
- 或直接用 **Cloudflare Tunnel** 跳过公网 IP 问题

### Q3: NAS 是否 24h 在线？

**回答**: 取决于实际使用习惯。建议：

- 如果 NAS 本身就是 24h 开机（NAS 典型用法），方案 B 完全可行
- 如果非 24h → **方案 C** 是唯一选择，或方案 A 在 NAS 关机时降级到 VPS API
- 一个考虑：可写一个健康检查脚本，NAS 在线时切到 NAS，离线时自动 fallback 到 VPS

### Q4: 是否需要内网穿透？

| 方案 | 需要内网穿透？ | 方案 |
|------|:-------------:|------|
| A (后端→NAS) | **是**，仅 API 端口 | Cloudflare Tunnel 最佳 |
| B (全部→NAS) | **是**，HTTP(S) 端口 | Cloudflare Tunnel 或 DDNS |
| C (只优化) | **否** | 无需任何穿透 |

### Q5: 如果 NAS 不可行，VPS 优化极限在哪？

**可以做到的优化**:

| 优化项 | 效果 | 工作量 |
|--------|------|--------|
| 修复 `.png` → `.jpg` 路径 | **卡面图片恢复加载** | 5 分钟 |
| 卡背改用 back.jpg (333K) | 加载从 3.1MB → 333KB, -89% | 5 分钟 |
| Cloudflare Polish (Lossy) | 图片再压缩 ~30-50% | 1 次配置 |
| cards.js 拆包 | 首屏只加载前22张大阿卡纳 (~25K), 小阿卡纳按需加载 | ~2 小时 |
| Nginx 强缓存 + 长 max-age | 二次访问几乎免加载 | 10 分钟 |
| 图片 WebP 转换 | 再缩小 30-50% | 1 小时 |
| VPS 升级 (如 2GB 方案) | $5-10/月 消除内存瓶颈 | 10 分钟 |

**优化后极限表现**:
- **首次访问**: ~1.5s (HTML 0.1s + cards.js 0.07s + back.jpg 0.2s + 首张卡图 0.2s)
- **再次访问**: <0.3s (全缓存命中)
- **最差情况** (Cloudflare 未缓存): ~3s (17K+104K+8.8M 图片)

---

## 五、🏆 推荐方案

### 分阶段执行

```
阶段 0 (紧急修复) → 阶段 1 (VPS 极致优化) → 阶段 2 (NAS 部署)
```

---

## 六、实施步骤

### 🚨 阶段 0: 紧急修复 (30 分钟)

**优先级最高** — 先让网站正常工作

1. **修复 cards.js 图片扩展名**
   ```bash
   ssh root@65.49.222.127
   sed -i 's/\.png"/.jpg"/g' /var/www/sites/tarot-v2/cards.js
   ```

2. **卡背改用优化版**
   ```bash
   # 修改 app.js 中 backImg 路径
   sed -i 's|/tarot/back.png|/v2/img/back.jpg|g' /var/www/sites/tarot-v2/app.js
   ```

3. **清除浏览器缓存影响**
   ```bash
   # 增加 index.html 的版本号（防止缓存旧的 JS）
   sed -i 's|cards.js|cards.js?v=2|' /var/www/sites/tarot-v2/index.html
   sed -i 's|app.js|app.js?v=2|' /var/www/sites/tarot-v2/index.html
   ```

4. **验证**
   - 打开 `https://tarot.liaomagic.com/v2/`
   - 确认卡面图片正常显示
   - 做一次完整的抽牌→翻牌→解读流程

---

### 阶段 1: VPS 极致优化 (2-3 小时)

> 适合不搬 NAS 时的最佳优化方案

#### 1. Nginx + Cloudflare 调优

```nginx
# 在现有 tarot Nginx 配置中增加
location /v2/img/ {
    # 图片缓存一年
    add_header Cache-Control "public, max-age=31536000, immutable";
    # 开启 Cloudflare Polish 时告知源站
    add_header Vary Accept;
    # 启用 Brotli 压缩 (需安装 nginx-mod-brotli)
    brotli on;
    brotli_types image/jpeg image/png image/webp;
    alias /var/www/sites/tarot-v2/img/;
}

location /v2/ {
    alias /var/www/sites/tarot-v2/;
    index index.html;
    # HTML/CSS/JS 强缓存 1 天
    add_header Cache-Control "public, max-age=86400";
}
```

#### 2. Cloudflare Dashboard 开启

| 功能 | 位置 | 效果 |
|------|------|------|
| **Polish → Lossy** | Speed → Optimization | 图片自动压缩 30-50% |
| **Auto Minify** | Speed → Optimization | HTML/CSS/JS 自动压缩 |
| **Brotli** | Speed → Optimization | 比 gzip 再小 20% |
| **Cache Level → Standard** | Caching → Configuration | 静态资源全缓存 |
| **Edge Cache TTL → 1 month** | Caching → Configuration | 边缘缓存一个月 |
| **Always Online** | Caching → Configuration | 源站挂时显示缓存 |

#### 3. 图片 WebP 转换（可选，耗时较长）

```bash
# 在本地或 VPS 上转换
for f in /var/www/sites/tarot-v2/img/*.jpg; do
  base=$(basename "$f" .jpg)
  cwebp -q 80 "$f" -o "/var/www/sites/tarot-v2/img/${base}.webp"
done
```

修改 `cards.js` 添加 picture 标签支持，或使用 `<img>` 的 `accept` 嗅探。

#### 4. cards.js 懒加载拆分（可选，高级优化）

```javascript
// 策略: cards.js 拆为 majors.js (22张大牌) + minors.js (56张小牌)
// 首屏只加载 majors.js，用户点"全部牌"时再加载 minors.js
// 或: 将 cards.js 数据直接通过 API 按需获取
```

**预期效果**:
- cards.js 从 104KB → 首屏 30KB + 按需 74KB
- 首次 JS 解析时间从 ~150ms 降至 ~40ms

---

### 阶段 2: NAS 部署 (按需执行，预计 1-2 天)

#### 前置检查清单

- [ ] NAS 型号和 DSM/QNAP 版本确认
- [ ] Docker 可用性确认
- [ ] 家宽互联网类型 (公网 IP / CGNAT)
- [ ] 家宽上行带宽测试 (speedtest)
- [ ] NAS 是否 24h 开机

#### 方案 A 实施 (推荐首选尝试)

**Step 1: NAS 上部署 API**

```bash
# Synology Container Manager (Docker)
docker run -d \
  --name tarot-api \
  --restart unless-stopped \
  -p 3099:3099 \
  -e DEEPSEEK_API_KEY=sk-your-key \
  node:22-alpine \
  sh -c 'cat > /app/server.js && node /app/server.js'
```

或更简单的本地 Node (如果 NAS 支持 Node.js 原生):

```bash
# 上传 reading-api.js 到 NAS
node reading-api.js
```

**Step 2: Cloudflare Tunnel 打通内网**

```bash
# 在 NAS 上安装 cloudflared
docker run -d \
  --name cloudflared \
  --restart unless-stopped \
  cloudflare/cloudflared tunnel --no-autoupdate run --token YOUR_TUNNEL_TOKEN
```

在 Cloudflare Zero Trust Dashboard:
1. 创建 Tunnel
2. 添加路由: `tarot.liaomagic.com/api/*` → `http://nas-ip:3099`
3. 部署 token 到 NAS

**Step 3: VPS Nginx 配置调整**

```nginx
# 删除或注释掉 localhost 代理
# location /api/tarot-reading {
#     proxy_pass http://127.0.0.1:3099;
# }

# 改为 Cloudflare Tunnel 或其他方式指向 NAS
# 实际上不需要修改 VPS 配置——Tunnel 直接接管域名路由
```

或者保持 VPS 上 PM2 作为 fallback（健康检查切换）:

```nginx
# VPS 上保留 API 作为 fallback，通过健康检查决定路由目标
# 简单做法：在 Cloudflare 上把 /api/* 直接路由到 Tunnel
# 静态文件仍然由 VPS 提供
```

#### 方案 B 实施 (终极方案)

1. **NAS 安装 Nginx (Docker 或 DSM Web Station)**
2. **上传所有静态文件到 NAS 共享目录**
3. **NAS 运行 API**
4. **Cloudflare Tunnel 或 DDNS**: 整站指向 NAS
5. **停止 VPS**: 或保留作为冷备

```yaml
# docker-compose.yml (NAS 上一键部署)
version: '3'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./tarot-v2:/var/www/tarot-v2
    restart: unless-stopped

  api:
    image: node:22-alpine
    volumes:
      - ./reading-api.js:/app/server.js
    environment:
      - PORT=3099
      - DEEPSEEK_API_KEY=sk-your-key
    command: node /app/server.js
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared
    command: tunnel --no-autoupdate run --token YOUR_TOKEN
    restart: unless-stopped
```

---

## 七、决策树

```
NAS 已 24h 运行?
├── 是 → NAS 有 Docker?
│   ├── 是 → 执行阶段2-A (方案A)
│   │        └── 家宽上行 > 20Mbps? → 执行阶段2-B (方案B)
│   └── 否 → 先执行阶段1 (VPS优化)
│            └── 评估后考虑升级 NAS 或买新 NAS
└── 否 → 先执行阶段0+1 (VPS优化)
         └── 长远可选: $5/月升级 VPS (2GB) 解决内存瓶颈
```

**我的建议路径**:

```
今晚:  阶段0 (修复bug) → 30分钟
明天:  阶段1 (VPS优化) → 2-3小时
↓ 评估效果
如果满意: 保持阶段1，NAS 作为远期目标
如果不满意: 检查 NAS 条件 → 执行阶段2-A
```

---

## 八、预算对比

| 方案 | 月成本 | 说明 |
|------|--------|------|
| 当前 | ~$5-10/月 | VPS |
| 阶段0+1 | ~$5-10/月 | VPS 不变 |
| 方案A (后端→NAS) | ~$5-10/月 | VPS 可降配省 ~$3/月 |
| 方案B (全部→NAS) | **$0/月** | 如果取消 VPS |
| VPS 升级 2GB | ~$10-15/月 | 缓解当前内存压力 |

---

## 九、技术风险评估

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| NAS 无公网 IP | 高 | 中 | Cloudflare Tunnel 无需公网 IP |
| 家宽上行不稳定 | 中 | 高 (方案B) | 方案A 只有 API 流量，上行影响小 |
| NAS 断电 | 低 | 高 | 方案A 降级回 VPS API；UPS + 自动恢复 |
| NAS 无 Docker | 低 | 中 | 可安装 Docker 或直接用 Node.js 原生 |
| VPS OOM 导致 API 挂 | 中 | 中 | 设置 PM2 自动重启，或加 swap 监控 |

---

## 十、立即行动清单 (Tonight)

```bash
# 1. SSH 到 VPS
ssh root@65.49.222.127

# 2. 修复卡片图片扩展名
sed -i 's/\.png"/.jpg"/g' /var/www/sites/tarot-v2/cards.js

# 3. 修复卡背路径
sed -i 's|/tarot/back.png|/v2/img/back.jpg|g' /var/www/sites/tarot-v2/app.js

# 4. 验证
curl -s -o /dev/null -w "%{http_code}" https://tarot.liaomagic.com/v2/img/00_fool.jpg
# 应该返回 200

# 5. 重启 Nginx / 清除缓存
nginx -s reload

# 6. 浏览器打开 https://tarot.liaomagic.com/v2/ 验证图片
```

---

## 附录: 当前系统的完整诊断摘要

```
[OK]  域名 DNS → Cloudflare → VPS (65.49.222.127)
[OK]  Nginx 配置语法正确
[OK]  PM2 tarot-api 运行正常 (6h uptime, 0 restarts)
[OK]  DeepSeek API 调用正常 (HTTP P95 22s, 但 0 req/min)
[OK]  页面加载速度尚可 (HTML 0.11s, cards.js 0.07s via Cloudflare)
[WARN] VPS 内存 80% 使用 + 675MB swap 使用 ⚠
[BUG]  cards.js 图片引用 .png 但文件是 .jpg × 78 张 ⚠
[BUG]  卡背使用 3.1MB PNG 而非 333KB JPG ⚠
[BUG]  index.html 设了 Cache-Control: no-cache → 影响 Cloudflare 缓存效率 ⚠
[INFO] 原始 PNG 346MB / 优化 JPG 8.8MB (缩 97.5%)
[INFO] API 零外部依赖 (纯 Node.js 内置模块)
[INFO] SSH 源 IP: 220.198.97.149 (推测为家宽, 中国)
```
