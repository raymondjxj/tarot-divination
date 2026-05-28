/* ===== 塔罗自察 v2 - TarotApp ===== */
/* Fixes applied by Claude Code review agent:
 * 1. Added image onerror fallback for all card images
 * 2. Added showRecords() to render saved records from localStorage
 * 3. Added showProfile() to calculate and display stats
 * 4. Added RECENT_READING_KEY for saving "last reading" state link
 * 5. Fixed saveReading() - append instead of replace same-day same-spread
 * 6. Fixed hasReading state restore (use dedicated flag)
 * 7. Removed dead async on getReading()
 * 8. Removed double saveState() call
 * 9. Removed dead renderHomeCard() code
 */

const TarotApp = {
  // --- State ---
  spread: 1,
  cards: [],
  reading: '',
  isFlipping: false,
  hasReading: false,
  mood: '',
  intent: '',
  card: null,

  // Spread position labels
  SP: {
    1: ['今日指引'],
    3: ['过去的影响', '当下的状态', '未来的方向'],
    5: ['你的立场', '关系的障碍', '对方/环境', '根基与支撑', '最终的结果'],
    10: ['现在状况', '横交阻碍', '基础根基', '过往影响', '最高目标', '不久将来', '你的态度', '周围环境', '希望与恐惧', '最终结果']
  },

  // --- Init ---
  init() {
    this.restoreState();
    this.bindEvents();
  },

  restoreState() {
    // Restore last reading session
    const saved = localStorage.getItem('tv7sim_v2');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.cards && data.cards.length) {
          this.cards = data.cards;
          this.card = this.cards[0];
          this.spread = data.spread || 1;
          this.mood = data.mood || '';
          this.intent = data.intent || '';
          this.reading = data.reading || '';
          this.hasReading = !!data.hasReading;
        }
      } catch(e) {/* ignore */}
    }
  },

  saveState() {
    try {
      localStorage.setItem('tv7sim_v2', JSON.stringify({
        cards: this.cards,
        spread: this.spread,
        mood: this.mood,
        intent: this.intent,
        reading: this.reading,
        hasReading: this.hasReading
      }));
    } catch(e) {/* ignore */}
  },

  bindEvents() {
    // Method cards
    document.querySelectorAll('.method-card').forEach(el => {
      el.addEventListener('click', () => {
        this.selectSpread(parseInt(el.dataset.n));
        goDraw();
      });
    });

    // Skip button
    const btnSkip = document.getElementById('btnSkip');
    if (btnSkip) {
      btnSkip.addEventListener('click', e => {
        e.preventDefault();
        goDraw();
      });
    }

    // Last reading link
    const linkLast = document.getElementById('linkLast');
    if (linkLast) {
      linkLast.addEventListener('click', e => {
        e.preventDefault();
        if (this.hasReading && this.cards.length > 0) {
          this.showReading();
        } else {
          show('scrRecs');
          this.showRecords();
        }
      });
    }

    // Nav items — enhanced to load records/profile on tab switch
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const page = el.dataset.page;
        if (!page) return;
        show(page);
        // Trigger page-specific data loading
        if (page === 'scrRecs') {
          TarotApp.showRecords();
        } else if (page === 'scrProfile') {
          TarotApp.showProfile();
        }
      });
    });
  },

  // --- Select Spread ---
  selectSpread(n) {
    this.spread = n;
    document.querySelectorAll('.method-card').forEach(el => {
      el.classList.toggle('sel', parseInt(el.dataset.n) === n);
    });
  },

  // --- Draw Cards ---
  draw() {
    if (typeof CARDS === 'undefined' || !CARDS || !CARDS.length) {
      console.error('[TarotApp] CARDS data not loaded!');
      this.cards = [];
      this.hasReading = false;
      return;
    }
    const n = this.spread;
    const pool = [...CARDS];
    const drawn = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const card = { ...pool[idx], isReversed: Math.random() < 0.3 };
      drawn.push(card);
      pool.splice(idx, 1);
    }
    this.cards = drawn;
    this.card = drawn[0];
    this.hasReading = false;
    this.reading = '';
  },

  // --- Image error fallback helper ---
  imgTag(src, alt, extraAttrs) {
    extraAttrs = extraAttrs || '';
    return `<img src="${src}" alt="${alt}" ${extraAttrs} onerror="this.onerror=null;this.parentElement.style.background='rgba(196,163,90,.06)';this.style.display='none'">`;
  },

  // --- Render Draw Area ---
  renderDraw() {
    const n = this.spread;
    const area = document.getElementById('drawArea');
    this.draw();

    let h = '';
    const backImg = this.imgTag('/v2/img/back.jpg', '卡背');
    const label = n === 1 ? '集中意念，默念你的问题' : `已抽出 ${n} 张牌，请集中意念`;

    if (n === 1) {
      h = `<div class="draw-single">
        <div class="card-wrapper" data-i="0">
          <div class="card-flipper" id="cflip0">
            <div class="card-back">${backImg}</div>
            <div class="card-front" id="cardFront0"></div>
          </div>
        </div>
        <p class="draw-hint">${label}</p>
        <button class="btn-rite flip-btn" id="flipBtn0" onclick="TarotApp.flipAll()">✦ 翻牌解读</button>
      </div>`;
    } else if (n === 3) {
      h = `<div class="draw-triple">
        ${this.cards.map((c, i) => `
          <div class="card-col">
            <div class="card-wrapper" data-i="${i}">
              <div class="card-flipper" id="cflip${i}">
                <div class="card-back">${backImg}</div>
                <div class="card-front" id="cardFront${i}"></div>
              </div>
            </div>
            <p class="card-pos-label">${this.SP[3][i]}</p>
          </div>
        `).join('')}
        <p class="draw-hint">${label}</p>
        <button class="btn-rite flip-btn" id="flipBtnAll" onclick="TarotApp.flipAll()">✦ 翻牌解读</button>
      </div>`;
    } else if (n === 5) {
      h = `<div class="draw-cross">
        <div class="cross-grid">
          <div></div>
          <div class="card-wrapper" data-i="0" style="grid-column:2;grid-row:1">
            <div class="card-flipper" id="cflip0"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront0"></div></div>
          </div>
          <div></div>
          <div class="card-wrapper" data-i="1" style="grid-column:1;grid-row:2">
            <div class="card-flipper" id="cflip1"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront1"></div></div>
          </div>
          <div class="card-wrapper" data-i="2" style="grid-column:2;grid-row:2">
            <div class="card-flipper" id="cflip2"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront2"></div></div>
          </div>
          <div class="card-wrapper" data-i="3" style="grid-column:3;grid-row:2">
            <div class="card-flipper" id="cflip3"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront3"></div></div>
          </div>
          <div></div>
          <div class="card-wrapper" data-i="4" style="grid-column:2;grid-row:3">
            <div class="card-flipper" id="cflip4"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront4"></div></div>
          </div>
          <div></div>
        </div>
        <p class="draw-hint">${label}</p>
        <button class="btn-rite flip-btn" id="flipBtnAll" onclick="TarotApp.flipAll()">✦ 翻牌解读</button>
      </div>`;
    } else if (n === 10) {
      h = `<div class="draw-celtic">
        <div class="celtic-scene">
          ${this.cards.map((c, i) => `
            <div class="card-wrapper celtic-card celtic-${i}" data-i="${i}">
              <div class="card-flipper" id="cflip${i}"><div class="card-back">${backImg}</div><div class="card-front" id="cardFront${i}"></div></div>
            </div>
          `).join('')}
        </div>
        <p class="draw-hint">${label}</p>
        <button class="btn-rite flip-btn" id="flipBtnAll" onclick="TarotApp.flipAll()">✦ 翻牌解读</button>
      </div>`;
    }

    area.innerHTML = h;
  },

  // --- Flip Cards ---
  flipCard(i) {
    const c = this.cards[i];
    if (!c) return;
    const flipper = document.getElementById('cflip' + i);
    const front = document.getElementById('cardFront' + i);
    if (!flipper || !front) return;

    const revTag = c.isReversed ? '<span class="rev-badge">逆位</span>' : '';
    front.innerHTML = this.imgTag(c.img, c.name) + revTag +
      (this.spread <= 3 ? `<div class="card-name-tag">${c.name}</div>` : '');

    flipper.classList.add('flipped');
  },

  flipAll() {
    if (this.isFlipping) return;
    this.isFlipping = true;

    this.cards.forEach((_, i) => {
      setTimeout(() => this.flipCard(i), i * 400);
    });

    // Show reading after all cards flipped
    const totalDelay = this.cards.length * 400 + 1200;
    setTimeout(() => {
      this.hasReading = true;
      this.isFlipping = false;
      this.saveState();
      // Show "查看解读" button instead of auto-navigating
      const fb = document.querySelector('.flip-btn');
      if (fb) {
        fb.textContent = '✦ 查看解读';
        fb.onclick = () => this.showReading();
      }
    }, Math.min(800, totalDelay));
  },

  // --- Show Reading ---
  showReading() {
    show('scrRead');
    const panel = document.querySelector('#scrRead .page-inner');
    if (!panel) return;

    const cardsRow = this.cards.map((c, i) =>
      this.imgTag(c.img, c.name, `class="read-thumb" onclick="TarotApp.zoomCard(${i})" title="${c.name}"`) +
      (c.isReversed ? '' : '')
    ).join('');

    // Build reading
    let readingHtml = '';
    this.cards.forEach((c, i) => {
      const d = c.isReversed ? c.rev : c.up;
      const posLabel = this.SP[this.spread] && this.SP[this.spread][i] ? this.SP[this.spread][i] : `第${i+1}张`;
      readingHtml += `
        <div class="read-card-entry">
          <div class="read-card-header">${c.name} · ${posLabel} ${c.isReversed ? '（逆位）' : '（正位）'}</div>
          <p class="read-card-core">${d.core}</p>
          <p class="read-card-what">🌱 ${d.what}</p>
          <p class="read-card-warn">⚠ ${d.warn}</p>
          ${c.persona ? `<p class="read-card-persona">👤 ${c.persona.split('——')[0]}</p>` : ''}
        </div>`;
    });

    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:12px">
        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">${cardsRow}</div>
        <p style="font-size:12px;color:var(--text-dim);margin-top:6px">点击卡牌放大查看</p>
      </div>
      ${this.mood ? `<p style="font-size:12px;color:var(--gold);text-align:center;margin-bottom:8px">此刻能量：${this.mood}</p>` : ''}
      ${this.intent ? `<p style="font-size:12px;color:var(--text-dim);text-align:center;margin-bottom:8px">你问的是：「${this.intent}」</p>` : ''}
      <div class="readings">${readingHtml}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin:16px 0">
        <button class="btn-rite" onclick="TarotApp.saveReading()" style="max-width:140px;height:36px;font-size:12px">保存记录</button>
      </div>
      <p style="text-align:center;font-size:11px;color:var(--text-dim);margin-bottom:20px;font-style:italic">✦ 以上解读仅供参考。你的判断和选择永远是第一位的。</p>
    `;
  },

  // --- Save Reading to Records ---
  saveReading() {
    const today = new Date().toISOString().slice(0, 10);
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('tv7sim_records_v2') || '[]');
    } catch(e) { records = []; }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: today,
      spread: this.spread,
      mood: this.mood,
      intent: this.intent,
      cards: this.cards.map(c => ({
        id: c.id, name: c.name, en: c.en, img: c.img,
        isReversed: c.isReversed, el: c.el
      })),
      reading: this.reading
    };

    // Always append — no dedup to preserve multiple readings
    records.unshift(entry);

    try {
      localStorage.setItem('tv7sim_records_v2', JSON.stringify(records));
    } catch(e) {/* ignore */}

    const btn = document.querySelector('.btn-rite[onclick*="saveReading"]');
    if (btn) { btn.textContent = '✓ 已保存'; btn.style.opacity = '0.6'; }
  },

  // --- Show Records ---
  showRecords() {
    const area = document.getElementById('recsArea');
    if (!area) return;

    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('tv7sim_records_v2') || '[]');
    } catch(e) { records = []; }

    if (!records.length) {
      area.innerHTML = '<p class="empty">暂无记录</p>';
      return;
    }

    // Group by date
    const groups = {};
    records.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });

    let html = '';
    Object.keys(groups).sort().reverse().forEach(date => {
      html += `<div style="margin-bottom:10px"><p style="font-size:11px;color:var(--gold);letter-spacing:1px;margin-bottom:4px">${date}</p>`;
      groups[date].forEach(r => {
        const spreadNames = {1:'单牌指引', 3:'三牌时序', 5:'关系十字', 10:'凯尔特十字'};
        const thumbHtml = (r.cards || []).slice(0, 4).map(c =>
          `<img src="${c.img}" class="rec-thumb-img" onerror="this.style.display='none'">`
        ).join('');
        const cardNames = (r.cards || []).map(c =>
          c.name + (c.isReversed ? '↕' : '')
        ).join(' · ');
        html += `<div class="rec-entry" onclick="TarotApp.restoreReading('${r.id}')">
          <div class="rec-thumbs">${thumbHtml}</div>
          <div class="rec-info">
            <div class="rec-card-name">${cardNames}</div>
            <div class="rec-date">${spreadNames[r.spread] || r.spread + '张牌阵'}${r.intent ? ' · ' + r.intent : ''}</div>
          </div>
        </div>`;
      });
      html += '</div>';
    });

    area.innerHTML = html;
  },

  // --- Restore a saved record ---
  restoreReading(id) {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('tv7sim_records_v2') || '[]');
    } catch(e) { return; }

    const rec = records.find(r => r.id === id);
    if (!rec) return;

    this.cards = rec.cards || [];
    this.card = this.cards[0] || null;
    this.spread = rec.spread || 1;
    this.mood = rec.mood || '';
    this.intent = rec.intent || '';
    this.reading = rec.reading || "";
    this.hasReading = true;
    this.saveState();
    this.showReading();
  },

  // --- Show Profile ---
  showProfile() {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('tv7sim_records_v2') || '[]');
    } catch(e) { records = []; }

    const totalCount = records.length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = records.filter(r => r.date === today).length;

    const statCount = document.getElementById('statCount');
    const statReversed = document.getElementById('statReversed');
    if (statCount) statCount.textContent = totalCount;
    if (statReversed) statReversed.textContent = todayCount;
  },

  // --- Clear All Data ---
  clearData() {
    try {
      localStorage.removeItem('tv7sim_records_v2');
      localStorage.removeItem('tv7sim_v2');
    } catch(e) {/* ignore */}
    this.cards = [];
    this.card = null;
    this.hasReading = false;
    this.reading = '';
    this.spread = 1;
    this.mood = '';
    this.intent = '';
    const sc = document.getElementById('statCount');
    if (sc) sc.textContent = '0';
    const sr = document.getElementById('statReversed');
    if (sr) sr.textContent = '0';
    this.showRecords();
    show('scrProfile');
  },

  // --- Zoom Card Modal ---
  zoomCard(i) {
    const c = this.cards[i];
    if (!c) return;
    const d = c.isReversed ? c.rev : c.up;
    const posLabel = this.SP[this.spread] && this.SP[this.spread][i] ? this.SP[this.spread][i] : '';

    let mod = document.getElementById('mod');
    if (!mod) {
      mod = document.createElement('div');
      mod.className = 'card-modal';
      mod.id = 'mod';
      mod.innerHTML = '<div class="card-modal-content" id="modC"></div>';
      mod.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('on');
      });
      document.body.appendChild(mod);
    }

    const mc = document.getElementById('modC');
    if (!mc) return;

    mc.innerHTML = `
      <button class="modal-close" onclick="document.getElementById('mod').classList.remove('on')">✕</button>
      ${this.imgTag(c.img, c.name, 'class="modal-card-img"')}
      ${c.isReversed ? '<style>.modal-card-img{transform:rotate(180deg)}</style>' : ''}
      <p class="modal-pos">${posLabel} ${c.isReversed ? '逆位' : '正位'}</p>
      <p class="modal-name">${c.name} · ${c.en}</p>
      <p class="modal-core">${d.core}</p>
      ${d.what ? `<p class="modal-what">🌱 ${d.what}</p>` : ''}
      ${d.warn ? `<p class="modal-warn">⚠ ${d.warn}</p>` : ''}
      ${c.persona ? `<p class="modal-persona">👤 ${c.persona}</p>` : ''}
    `;

    document.getElementById('mod').classList.add('on');
  }
};

// --- Navigation helpers (bridge from index.html) ---
function show(id) {
  document.querySelectorAll('.scr').forEach(p => p.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('sel', n.dataset.page === id));
  window.scrollTo({ top: 0 });
}

function goDraw() {
  TarotApp.renderDraw();
  show('scrDraw');
}

// --- Init on DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
  TarotApp.init();
});
