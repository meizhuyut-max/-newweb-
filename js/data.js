/* ===========================================================
   データ層
   ・マスタ（模擬店・企画・マップ）は data/*.js
   ・待ち人数／売上／レビューは Googleスプレッドシート（CSV）
   ・CSV未設定ならデモ値を生成して同じ形で返す
   画面側は常に Store.live[id] / Store.rating(id) だけを見ればよい。
   =========================================================== */

const CFG = window.KODAIRA_CONFIG;

const Store = {
  fes: null,
  items: [],
  byId: {},
  areas: [],
  live: {}, // id -> { wait, sales, updatedAt }
  reviews: {}, // id -> { sum, count }
  source: 'demo', // 'sheet' | 'demo'
  lastSync: null,
  listeners: [],

  onChange(fn) {
    this.listeners.push(fn);
  },
  emit() {
    this.listeners.forEach((fn) => fn());
  },
};

/* ---------- localStorage（自分のスケジュール・自分の★） ---------- */

const LS_SCHEDULE = 'kodaira.schedule.v1';
const LS_REVIEWS = 'kodaira.myreviews.v1';

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* プライベートモード等では黙って諦める */
  }
}

const MySchedule = {
  get() {
    return lsGet(LS_SCHEDULE, []);
  },
  has(id, day, start) {
    return this.get().some((e) => e.id === id && e.day === day && e.start === start);
  },
  add(entry) {
    const list = this.get();
    if (!this.has(entry.id, entry.day, entry.start)) list.push(entry);
    lsSet(LS_SCHEDULE, list);
    Store.emit();
  },
  remove(id, day, start) {
    lsSet(
      LS_SCHEDULE,
      this.get().filter((e) => !(e.id === id && e.day === day && e.start === start))
    );
    Store.emit();
  },
  clear() {
    lsSet(LS_SCHEDULE, []);
    Store.emit();
  },
};

const MyReviews = {
  get() {
    return lsGet(LS_REVIEWS, {});
  },
  of(id) {
    return this.get()[id] || 0;
  },
  set(id, stars) {
    const all = this.get();
    all[id] = stars;
    lsSet(LS_REVIEWS, all);
  },
};

/* ---------- CSV ---------- */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** ヘッダー名のゆらぎ（「模擬店ID」「ID」「id」等）を吸収する */
function pickColumn(header, candidates) {
  const norm = (s) => String(s).replace(/[\s　]/g, '').toLowerCase();
  const H = header.map(norm);
  for (const cand of candidates) {
    const i = H.findIndex((h) => h === norm(cand));
    if (i >= 0) return i;
  }
  for (const cand of candidates) {
    const i = H.findIndex((h) => h.includes(norm(cand)));
    if (i >= 0) return i;
  }
  return -1;
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('CSV取得に失敗: ' + res.status);
  return parseCsv(await res.text());
}

/* ---------- デモ用の疑似リアルタイム値 ---------- */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** 同じ店なら数分単位でゆっくり変わる、それらしい待ち人数を作る */
function demoLive(item, minuteBucket) {
  const base = hash(item.id); // 店ごとの「基礎的な人気」
  const wave = Math.sin(minuteBucket / 9 + base * 6.28); // 時間によるゆらぎ
  const popularity = item.tags && item.tags.includes('行列必至') ? 1.6 : 1;
  let wait = Math.round((2 + base * 20 + wave * 5) * popularity);
  if (item.type === 'event') wait = Math.round(wait * 0.35);
  wait = Math.max(0, Math.min(45, wait));
  const elapsed = minuteBucket % 400;
  const sales = Math.round((30 + base * 90) * (1 + elapsed / 120));
  return { wait, sales, updatedAt: nowLabel(), reported: true };
}

function demoReviews(item) {
  const base = hash(item.id + 'r');
  const count = 8 + Math.floor(base * 90);
  const avg = 3.4 + base * 1.5; // 3.4〜4.9
  return { sum: Math.round(avg * count), count };
}

/* ---------- 時刻 ---------- */

function nowMinutes() {
  if (CFG.simulateFestivalClock) {
    const [h, m] = CFG.simulatedTime.split(':').map(Number);
    return h * 60 + m;
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function nowDay() {
  if (CFG.simulateFestivalClock) return CFG.simulatedDay;
  const today = new Date().toISOString().slice(0, 10);
  const hit = (Store.fes?.days || []).find((d) => d.date === today);
  return hit ? hit.id : Store.fes?.days?.[0]?.id;
}
function nowLabel() {
  const t = nowMinutes();
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function fromMin(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/* ---------- 混雑レベル ---------- */

const LEVELS = [
  { key: 'free', max: 3, label: 'すぐ買える', short: '空いてる' },
  { key: 'mid', max: 9, label: 'ちょっと待つ', short: 'ふつう' },
  { key: 'busy', max: 19, label: '混んでいる', short: '混雑' },
  { key: 'peak', max: Infinity, label: '大行列', short: '大行列' },
];
function levelOf(wait) {
  return LEVELS.find((l) => wait <= l.max);
}
/** ざっくり待ち時間（分）。1人あたり40秒として計算 */
function waitMinutes(wait) {
  return Math.max(0, Math.round((wait * 40) / 60));
}

/* ---------- ロード ---------- */

function loadMaster() {
  const shops = window.SHOPS_DATA;
  const map = window.MAP_DATA;
  if (!shops || !map) throw new Error('data/shops.js または data/map.js を読み込めませんでした');
  Store.fes = shops.fes;
  Store.items = shops.items;
  Store.byId = {};
  Store.items.forEach((it) => {
    Store.byId[it.id] = it;
    // 模擬店は開店中ずっとやっているので、スロットを1つ持たせて企画と同じ形に揃える
    if (!it.slots) {
      it.slots = (it.days || []).map((d) => ({ day: d, start: it.open, end: it.close }));
    }
  });
  Store.areas = map.areas;
}

async function loadLive() {
  const useDemo =
    CFG.demoMode === 'on' || (CFG.demoMode === 'auto' && !CFG.congestionCsvUrl && !CFG.reviewCsvUrl);

  if (useDemo) {
    const bucket = Math.floor(Date.now() / 60000);
    Store.live = {};
    Store.reviews = {};
    Store.items.forEach((it) => {
      Store.live[it.id] = demoLive(it, bucket);
      Store.reviews[it.id] = demoReviews(it);
    });
    Store.source = 'demo';
    Store.lastSync = new Date();
    applyMyReviews();
    Store.emit();
    return;
  }

  const errors = [];
  const live = {};
  const reviews = {};

  if (CFG.congestionCsvUrl) {
    try {
      const rows = await fetchCsv(CFG.congestionCsvUrl);
      const header = rows.shift();
      const cId = pickColumn(header, ['模擬店ID', '企画ID', 'ID', 'id']);
      const cWait = pickColumn(header, ['待ち人数', '並び人数', 'wait']);
      const cSales = pickColumn(header, ['売上個数', '販売個数', 'sales']);
      const cTime = pickColumn(header, ['タイムスタンプ', '更新時刻', 'timestamp']);
      if (cId < 0) throw new Error('ID列が見つかりません');
      // 同じ店の行が複数あれば、後の行（＝新しい報告）で上書きしていく。
      // Googleフォームの回答は下に追記されるので、最後の行が最新になる。
      rows.forEach((r) => {
        const id = normalizeId(r[cId]);
        if (!id) return;
        const prev = live[id] || {};
        const wait = cWait >= 0 ? parseNum(r[cWait]) : null;
        const sales = cSales >= 0 ? parseNum(r[cSales]) : null;
        const stamp = cTime >= 0 ? parseStamp(r[cTime]) : null;
        live[id] = {
          // 空欄の項目は前の報告の値を残す（待ち人数だけ報告する運用があるため）
          wait: wait === null ? prev.wait || 0 : wait,
          sales: sales === null ? prev.sales || 0 : sales,
          updatedAt: stamp ? stamp.label : nowLabel(),
          updatedMin: stamp ? stamp.min : null,
          reported: true,
        };
      });
    } catch (e) {
      errors.push('混雑データ: ' + e.message);
    }
  }

  if (CFG.reviewCsvUrl) {
    try {
      const rows = await fetchCsv(CFG.reviewCsvUrl);
      const header = rows.shift();
      const cId = pickColumn(header, ['模擬店ID', '企画ID', 'ID', 'id']);
      const cStar = pickColumn(header, ['評価', '星', 'rating', 'stars']);
      if (cId < 0 || cStar < 0) throw new Error('ID列または評価列が見つかりません');
      rows.forEach((r) => {
        const id = (r[cId] || '').trim();
        const star = parseFloat(r[cStar]);
        if (!id || !star) return;
        if (!reviews[id]) reviews[id] = { sum: 0, count: 0 };
        reviews[id].sum += star;
        reviews[id].count += 1;
      });
    } catch (e) {
      errors.push('レビュー: ' + e.message);
    }
  }

  Store.live = live;
  Store.reviews = reviews;
  Store.source = errors.length && !Object.keys(live).length ? 'demo' : 'sheet';
  Store.syncErrors = errors;
  Store.lastSync = new Date();

  // シートにまだ行がない店はデモ値で埋めておく（試作段階で穴が空くのを防ぐ）
  if (CFG.demoMode !== 'off') {
    const bucket = Math.floor(Date.now() / 60000);
    Store.items.forEach((it) => {
      if (!Store.live[it.id]) Store.live[it.id] = demoLive(it, bucket);
      if (!Store.reviews[it.id]) Store.reviews[it.id] = demoReviews(it);
    });
  }

  applyMyReviews();
  Store.emit();
}

/** 「12」「12人」「 12 」などを数値に。空欄は null（＝前の値を残す合図）を返す */
function parseNum(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * フォームのID欄を、こちらの知っているIDに正規化する。
 * プルダウンの選択肢を「s20 ｜ 20クラスの焼き小籠包」のようにしても拾えるよう、
 * 行の中から既知のIDを探す。
 */
function normalizeId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (Store.byId[s]) return s;
  const token = s.split(/[\s|｜,、:：]+/).find((t) => Store.byId[t]);
  if (token) return token;
  const hit = Object.keys(Store.byId).find((id) => s.includes(id));
  return hit || '';
}

/** Googleフォームのタイムスタンプ（例 2026/06/13 14:35:22）を読む */
function parseStamp(raw) {
  const m = String(raw ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return { label: `${String(h).padStart(2, '0')}:${m[2]}`, min: h * 60 + min };
}

/**
 * その報告が何分前のものか。実データのときだけ意味を持つ。
 * タイムスタンプが無い／デモのときは null。
 */
function minutesSinceUpdate(id) {
  if (Store.source !== 'sheet') return null;
  const l = Store.live[id];
  if (!l || l.updatedMin == null) return null;
  const d = new Date();
  const nowReal = d.getHours() * 60 + d.getMinutes();
  const diff = nowReal - l.updatedMin;
  return diff < 0 ? 0 : diff;
}

/** 報告が古すぎて当てにならない状態か */
function isStale(id) {
  const m = minutesSinceUpdate(id);
  return m !== null && m >= (CFG.staleAfterMinutes || 30);
}

/** 自分がこの端末で付けた★を平均に反映させる（投稿直後に数字が動く体験のため） */
function applyMyReviews() {
  const mine = MyReviews.get();
  Object.entries(mine).forEach(([id, stars]) => {
    if (!Store.reviews[id]) Store.reviews[id] = { sum: 0, count: 0 };
    Store.reviews[id] = {
      sum: Store.reviews[id].sum + stars,
      count: Store.reviews[id].count + 1,
      includesMine: true,
    };
  });
}

/* ---------- 参照用ヘルパ ---------- */

function ratingOf(id) {
  const r = Store.reviews[id];
  if (!r || !r.count) return { avg: 0, count: 0 };
  return { avg: r.sum / r.count, count: r.count };
}

/**
 * 待ち人数などの現在値。
 * まだ一度も報告が来ていない店は reported:false になる。
 * これを 0人 と同じ扱いにすると「空いてる」と誤解されるので、画面側で必ず分ける。
 */
function liveOf(id) {
  return Store.live[id] || { wait: 0, sales: 0, updatedAt: '—', reported: false };
}

/** 並べ替え用の待ち人数。未報告は末尾に送りたいので特別扱いする */
function waitForSort(id, order) {
  const l = liveOf(id);
  if (l.reported === false) return order === 'busy' ? -1 : Infinity;
  return l.wait;
}

/** 売上個数の学内順位（模擬店のみで競う） */
function salesRank(id) {
  const shops = Store.items.filter((i) => i.type === 'shop');
  const sorted = shops
    .map((i) => ({ id: i.id, sales: liveOf(i.id).sales }))
    .sort((a, b) => b.sales - a.sales);
  const idx = sorted.findIndex((s) => s.id === id);
  return idx < 0 ? null : { rank: idx + 1, total: sorted.length };
}

function findCell(cellId) {
  for (const area of Store.areas) {
    for (const floor of area.floors) {
      const cell = floor.cells.find((c) => c.id === cellId);
      if (cell) return { area, floor, cell };
    }
  }
  return null;
}

/** 指定日のいま以降に始まる予定を、早い順に返す */
function upcoming(day, fromMinutes, limit) {
  const out = [];
  Store.items.forEach((it) => {
    (it.slots || []).forEach((s) => {
      if (s.day !== day) return;
      const start = toMin(s.start);
      if (start >= fromMinutes) out.push({ item: it, slot: s, start });
    });
  });
  out.sort((a, b) => a.start - b.start);
  return limit ? out.slice(0, limit) : out;
}

/** いま開催中のもの */
function ongoing(day, atMinutes) {
  return Store.items.filter((it) =>
    (it.slots || []).some(
      (s) => s.day === day && toMin(s.start) <= atMinutes && atMinutes < toMin(s.end)
    )
  );
}

async function initData() {
  loadMaster();
  await loadLive();
  if (CFG.refreshIntervalSec > 0) {
    setInterval(loadLive, CFG.refreshIntervalSec * 1000);
  }
}
