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
  return {
    wait,
    waitLabel: null,
    waitReported: true,
    sales,
    salesReported: true,
    updatedAt: nowLabel(),
    updatedMin: null,
  };
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

  // 待ち人数（トラメガ隊のフォーム）と売上（模擬店のフォーム）は別シートになる想定。
  // 同じ形なので同じ関数で読み込み、live に上書きしていく。
  if (CFG.congestionCsvUrl) {
    await mergeCsvInto(live, CFG.congestionCsvUrl, '混雑データ', errors);
  }
  if (CFG.salesCsvUrl) {
    await mergeCsvInto(live, CFG.salesCsvUrl, '売上データ', errors);
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

  /* 足りないぶんをデモ値で埋めるかどうか。
     原則は「その項目の取得元を設定したなら、その項目は絶対に捏造しない」。
     混雑シートを繋いだのに未巡回の店にデモの待ち人数を入れてしまうと、
     わざわざ作った「未報告」表示が意味を失い、来場者に嘘をつくことになる。
     一方、取得元をまだ設定していない項目は、試作を見せるために埋めてよい。 */
  const bucket = Math.floor(Date.now() / 60000);
  const hasLiveSource = !!(CFG.congestionCsvUrl || CFG.salesCsvUrl);
  const fillLive = CFG.demoMode === 'on' || !hasLiveSource;
  const fillReviews = CFG.demoMode === 'on' || !CFG.reviewCsvUrl;

  Store.items.forEach((it) => {
    if (fillLive && !Store.live[it.id]) Store.live[it.id] = demoLive(it, bucket);
    if (fillReviews && !Store.reviews[it.id]) Store.reviews[it.id] = demoReviews(it);
  });

  applyMyReviews();
  Store.emit();
}

/**
 * 「どちらの報告が新しいか」を比べるための値を作る。
 *
 * Googleフォームは回答を下に追記するので、普通は行の順番＝時刻の順番になる。
 * ただしシートをIDで並べ替えたり、別タブに並べ直したりすると崩れる。
 * そこでタイムスタンプが読めるならそれで比べ、読めないときだけ行の順番で比べる。
 */
function rowOrder(stamp, rowIndex) {
  if (!stamp) return { time: null, index: rowIndex };
  // 日付が読めれば日をまたいでも正しく比べられる
  const dayNo = stamp.date ? Date.parse(stamp.date + 'T00:00:00') / 60000 : 0;
  return { time: dayNo + stamp.min, index: rowIndex };
}

/** a が b より新しい（または b がまだ無い）か */
function isNewer(a, b) {
  if (!b) return true;
  if (a.time !== null && b.time !== null) {
    if (a.time !== b.time) return a.time > b.time;
    return a.index >= b.index; // 同時刻なら後の行
  }
  return a.index >= b.index; // 時刻が読めない側があるなら行の順番で
}

/**
 * Googleフォームの回答シート（CSV）を読んで live に反映する。
 *
 * 待ち人数のシートにも売上のシートにも使える。列が無ければその項目は触らないので、
 * 「待ち人数だけのシート」と「売上だけのシート」を重ねて読んでも壊れない。
 * 同じ店の行が複数あれば、後の行（＝新しい報告）で上書きする。
 * Googleフォームの回答は下に追記されるので、最後の行が最新になる。
 */
async function mergeCsvInto(live, url, label, errors) {
  try {
    const rows = await fetchCsv(url);
    const header = rows.shift();
    const cId = pickColumn(header, ['模擬店ID', '企画ID', 'ID', 'id']);
    const cWait = pickColumn(header, ['待ち人数', '並び人数', 'wait']);
    const cSales = pickColumn(header, ['売上個数', '販売個数', 'sales']);
    const cTime = pickColumn(header, ['タイムスタンプ', '更新時刻', 'timestamp']);
    if (cId < 0) throw new Error('ID列が見つかりません');
    if (cWait < 0 && cSales < 0) throw new Error('待ち人数の列も売上個数の列も見つかりません');

    const today = todayIso();
    rows.forEach((r, rowIndex) => {
      const id = normalizeId(r[cId]);
      if (!id) return;
      const stamp = cTime >= 0 ? parseStamp(r[cTime]) : null;

      // 1日目の報告を2日目の朝に表示してしまわないよう、日付の違う行は捨てる。
      // （日付が読めない行や、開催日以外に動かしている試作段階では捨てない）
      if (CFG.onlyTodaysRows && stamp && stamp.date && stamp.date !== today) return;

      const prev = live[id] || {};
      const wait = cWait >= 0 ? parseWait(r[cWait]) : null;
      const sales = cSales >= 0 ? parseNum(r[cSales]) : null;
      const order = rowOrder(stamp, rowIndex);
      const next = { ...prev };

      // 待ち人数と売上は、それぞれ「その項目を報告している行の中で最新のもの」を採る。
      // 項目ごとに比べるので、待ち人数だけの報告が売上を消すことはない。
      if (wait !== null && isNewer(order, prev._waitOrder)) {
        next.wait = wait.value;
        next.waitLabel = wait.label;
        next.waitReported = true;
        next._waitOrder = order;
        // 「いつの情報か」は待ち人数が更新された行の時刻。
        // 売上だけの報告で待ち人数の鮮度が上がったように見せないため。
        next.updatedAt = stamp ? stamp.label : nowLabel();
        next.updatedMin = stamp ? stamp.min : null;
      }
      if (sales !== null && isNewer(order, prev._salesOrder)) {
        next.sales = sales;
        next.salesReported = true;
        next._salesOrder = order;
      }

      // 空欄しか無い行でも、その店の存在は記録しておく（値は既定のまま）
      next.wait = next.wait || 0;
      next.waitLabel = next.waitLabel || null;
      next.waitReported = next.waitReported === true;
      next.sales = next.sales || 0;
      next.salesReported = next.salesReported === true;
      if (!next.updatedAt) {
        next.updatedAt = '—';
        next.updatedMin = null;
      }

      live[id] = next;
    });
  } catch (e) {
    errors.push(label + ': ' + e.message);
  }
}

/** 「12」「12人」「 12 」などを数値に。空欄は null（＝前の値を残す合図）を返す */
function parseNum(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * 待ち人数の欄を読む。フォームの答え方2通りに両対応する。
 *
 *   記述式（数値）   「12」      → 12人ちょうど。そのまま表示
 *   ラジオ（段階）   「4〜9人」   → 計算には中央値の7を使い、表示は「4〜9人」のまま
 *                   「20人以上」 → 計算には25を使い、表示は「20人以上」のまま
 *
 * 段階で答えてもらったのに「7人」と言い切って表示すると嘘になるので、
 * 数値（並べ替え・混雑レベル用）と表示文字列を分けて持つ。
 */
function parseWait(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const nums = s.match(/\d+/g);
  if (!nums) return null;

  const a = parseInt(nums[0], 10);

  // 「4〜9人」のように2つ数字がある → 中央値
  if (nums.length >= 2) {
    const b = parseInt(nums[1], 10);
    return { value: Math.round((a + b) / 2), label: s };
  }
  // 「20人以上」→ 下限より少し上を代表値にする
  if (/以上|超|\+/.test(s)) {
    return { value: a + Math.max(3, Math.round(a * 0.25)), label: s };
  }
  // ただの数値 → そのまま。表示用ラベルは不要
  return { value: a, label: null };
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

/**
 * Googleフォームのタイムスタンプ（例 2026/06/13 14:35:22）を読む。
 * 日付も返すので、前日の報告を今日の表示に使ってしまう事故を防げる。
 */
function parseStamp(raw) {
  const s = String(raw ?? '');
  const t = s.match(/(\d{1,2}):(\d{2})/);
  if (!t) return null;
  const h = parseInt(t[1], 10);
  const min = parseInt(t[2], 10);

  // 2026/06/13 でも 2026-06-13 でも拾う
  const d = s.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  const date = d ? `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}` : null;

  return { label: `${String(h).padStart(2, '0')}:${t[2]}`, min: h * 60 + min, date };
}

/** 今日の日付（YYYY-MM-DD） */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
 * 待ち人数・売上の現在値。
 *
 * waitReported / salesReported は「その項目の報告が来ているか」。
 * 待ち人数と売上は報告する人が違う（トラメガ隊／模擬店の1年生）ので、
 * 片方だけ届いている状態が普通に起きる。だからフラグも別々に持つ。
 * 未報告を 0 と同じ扱いにすると「空いてる」「売れていない」と誤解されるので、
 * 画面側では必ず分けて表示する。
 */
function liveOf(id) {
  return (
    Store.live[id] || {
      wait: 0,
      waitLabel: null,
      waitReported: false,
      sales: 0,
      salesReported: false,
      updatedAt: '—',
      updatedMin: null,
    }
  );
}

/** 並べ替え用の待ち人数。未報告は末尾に送りたいので特別扱いする */
function waitForSort(id, order) {
  const l = liveOf(id);
  if (!l.waitReported) return order === 'busy' ? -1 : Infinity;
  return l.wait;
}

/**
 * 売上個数の学内順位（模擬店のみで競う）。
 *
 * 売上を報告していない店を 0個 として順位に混ぜると、
 * ただ報告が来ていないだけの店に「学内14位」と付いてしまうので、
 * **報告が来ている店だけ**で順位を作る。報告が無ければ null を返す。
 */
function salesRank(id) {
  const reported = Store.items
    .filter((i) => i.type === 'shop')
    .map((i) => ({ id: i.id, sales: liveOf(i.id).sales, has: liveOf(i.id).salesReported }))
    .filter((s) => s.has && s.sales > 0);

  const sorted = reported.sort((a, b) => b.sales - a.sales);
  const idx = sorted.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  return {
    rank: idx + 1,
    total: sorted.length,
    // 上位だけを見せたいとき用（下位まで公開するとクラス間の角が立つため）
    isTop: idx + 1 <= (CFG.salesRankTopN || 3),
  };
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
