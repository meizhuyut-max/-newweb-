/* ===========================================================
   画面とルーティング
   ハッシュルーター（#/home, #/item/s04 …）。ビルド不要で
   index.html をそのまま開いても動くようにしてある。
   =========================================================== */

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');

const UI = {
  liveFilter: 'all',
  liveSort: 'busy',
  listFilter: 'all',
  listQuery: '',
  scheduleDay: null,
  mapFloor: null,
  quizQuestion: null,
  quizDone: false,
};

/* ---------- 小道具 ---------- */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function go(hash) {
  location.hash = hash;
}

function starsHtml(avg) {
  const full = Math.round(avg);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function waitHtml(id) {
  const l = liveOf(id);
  // まだ報告が来ていない店を「0人・空いてる」と出すと嘘になるので、はっきり分ける
  if (l.reported === false) {
    return `<div class="wait" style="color:var(--faint)">
        <div><span class="wait__num">—</span></div>
        <div class="wait__label" style="background:rgba(255,255,255,.07)">未報告</div>
      </div>`;
  }
  const lv = levelOf(l.wait);
  return `<div class="wait lv-${lv.key}">
      <div><span class="wait__num">${l.wait}</span><span class="wait__unit">人</span></div>
      <div class="wait__label">${lv.short}</div>
    </div>`;
}

function itemRow(item, opts = {}) {
  const r = ratingOf(item.id);
  const sub = opts.sub ?? `${item.org}・${item.genre}`;
  return `<button class="row" data-go="#/item/${item.id}">
      <span class="row__emoji">${item.emoji || '📍'}</span>
      <span class="row__main">
        <span class="row__name">${esc(item.name)}</span>
        <span class="row__sub">${esc(sub)}</span>
      </span>
      <span class="row__right">${
        opts.right ?? (opts.showRating ? `<div style="color:var(--amber);font-size:12.5px;font-weight:700">★ ${r.avg.toFixed(1)}</div><div style="font-size:10.5px;color:var(--faint)">${r.count}件</div>` : waitHtml(item.id))
      }</span>
    </button>`;
}

function placeLabel(item) {
  const found = findCell(item.cell);
  if (!found) return item.pin || '—';
  const floorLabel = found.area.floors.length > 1 ? ` ${found.floor.label}` : '';
  return `${found.area.name}${floorLabel}・${found.cell.label || item.pin}`;
}

function slotLabelFor(item, day) {
  const s = (item.slots || []).filter((x) => x.day === day);
  if (!s.length) return 'この日はお休み';
  return s.map((x) => `${x.start}–${x.end}`).join(' / ');
}

function dayLabel(dayId) {
  return (Store.fes.days.find((d) => d.id === dayId) || {}).label || '';
}

/* ---------- ホーム ---------- */

function viewHome() {
  const day = nowDay();
  const t = nowMinutes();
  const next = upcoming(day, t, 1)[0];
  const shops = Store.items.filter((i) => i.type === 'shop');
  // 報告が届いている店だけを「空いている／並んでいる」に出す
  const reported = shops.filter((i) => liveOf(i.id).reported !== false);
  const freeNow = reported
    .slice()
    .sort((a, b) => liveOf(a.id).wait - liveOf(b.id).wait)
    .slice(0, 3);
  const hotNow = reported
    .slice()
    .sort((a, b) => liveOf(b.id).wait - liveOf(a.id).wait)
    .slice(0, 3);

  const tiles = [
    { go: '#/live', icon: '📊', name: 'リアルタイム混雑', copy: '模擬店の混雑の様子が一目で分かる！', c1: 'var(--coral)' },
    { go: '#/quiz', icon: '🎯', name: 'おすすめ模擬店診断', copy: 'あなたにぴったりの模擬店が見つかる！', c1: 'var(--magenta)' },
    { go: '#/schedule', icon: '🗓', name: 'マイスケジュール', copy: 'お気に入りの企画を登録して見逃しを防ごう！', c1: 'var(--violet)' },
    { go: '#/map', icon: '🧭', name: 'キャンパスナビ', copy: '企画や模擬店への行き方はお任せあれ！', c1: '#3ddc97' },
    { go: '#/list', icon: '📖', name: '模擬店・企画情報', copy: '全模擬店・企画の情報がここに集約！', c1: '#60a5fa', wide: true },
  ];

  return `
    <div class="view">
      <div class="hero">
        <div class="hero__kicker">${esc(Store.fes.place)}</div>
        <h1 class="hero__title"><span>${esc(Store.fes.name)}</span><br>WEBパンフレット</h1>
        <div class="hero__meta">${Store.fes.days.map((d) => esc(d.label)).join('　')}　${Store.fes.openTime}–${Store.fes.closeTime}</div>
      </div>

      ${
        next
          ? `<button class="nextup" data-go="#/item/${next.item.id}">
              <div class="nextup__label">この後 ${next.start - t <= 0 ? '開催中' : `あと${next.start - t}分`}</div>
              <div class="nextup__time">${next.slot.start}〜</div>
              <div class="nextup__name">${esc(next.item.name)}</div>
              <div class="nextup__where">${esc(placeLabel(next.item))}　/　${esc(next.item.org)}</div>
              <span class="nextup__cta">詳しく見る →</span>
            </button>`
          : `<div class="card" style="padding:18px;margin-bottom:18px"><div class="hero__kicker">本日の企画</div><div style="font-weight:700">本日の企画はすべて終了しました</div></div>`
      }

      <div class="tiles">
        ${tiles
          .map(
            (x) => `<button class="tile ${x.wide ? 'tile--wide' : ''}" data-go="${x.go}">
              <span class="tile__glow" style="background:${x.c1}"></span>
              <span class="tile__icon">${x.icon}</span>
              <span class="tile__name">${x.name}</span>
              <span class="tile__copy">${x.copy}</span>
            </button>`
          )
          .join('')}
      </div>

      <div class="section-head"><h2>いま空いている模擬店</h2><button data-go="#/live">すべて見る</button></div>
      ${freeNow.map((i) => itemRow(i)).join('')}

      <div class="section-head"><h2>いま並んでいる模擬店</h2><button data-go="#/live">すべて見る</button></div>
      ${hotNow.map((i) => itemRow(i)).join('')}

      <div class="foot">
        ${esc(Store.fes.sns.instagram)} / ${esc(Store.fes.sns.x)}<br>
        ${Store.source === 'demo' ? 'いまはデモデータで動いています' : `最終更新 ${liveOf(shops[0].id).updatedAt}`}
      </div>
    </div>`;
}

/* ---------- リアルタイム混雑 ---------- */

function viewLive() {
  const cats = [
    ['all', 'すべて'],
    ['グルメ', 'グルメ'],
    ['スイーツ', 'スイーツ'],
    ['ドリンク', 'ドリンク'],
    ['event', '企画'],
  ];
  let list = Store.items.filter((i) => {
    if (UI.liveFilter === 'all') return true;
    if (UI.liveFilter === 'event') return i.type === 'event';
    return i.category === UI.liveFilter;
  });
  // 未報告の店はどちらの並び順でも末尾に送る
  list.sort((a, b) =>
    UI.liveSort === 'busy'
      ? waitForSort(b.id, 'busy') - waitForSort(a.id, 'busy')
      : waitForSort(a.id, 'free') - waitForSort(b.id, 'free')
  );

  // 会期中の時計をシミュレートしているときは、詳細画面の時刻と食い違わないよう揃える
  const stamp = window.KODAIRA_CONFIG.simulateFestivalClock
    ? nowLabel()
    : Store.lastSync
    ? `${String(Store.lastSync.getHours()).padStart(2, '0')}:${String(Store.lastSync.getMinutes()).padStart(2, '0')}`
    : '—';

  const cfg = window.KODAIRA_CONFIG;

  return `
    <div class="view">
      ${
        Store.syncErrors && Store.syncErrors.length
          ? `<div class="banner">スプレッドシートを読めなかったため、一部はデモ値を表示しています。<br>${Store.syncErrors.map(esc).join('<br>')}</div>`
          : ''
      }
      <div class="chips">
        ${cats
          .map(
            ([k, label]) =>
              `<button class="chip" data-set="liveFilter" data-value="${k}" aria-pressed="${UI.liveFilter === k}">${label}</button>`
          )
          .join('')}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:11.5px;color:var(--muted)">
          ${Store.source === 'demo' ? 'デモデータ' : 'スプレッドシート連携中'}・${stamp} 更新
        </div>
        <button class="chip" data-toggle="liveSort" style="color:var(--text)">
          ${UI.liveSort === 'busy' ? '混んでいる順' : '空いている順'} ⇅
        </button>
      </div>

      ${list
        .map((i) => {
          const l = liveOf(i.id);
          let note;
          if (l.reported === false) note = 'まだ報告がありません';
          else if (isStale(i.id)) note = `⚠ ${minutesSinceUpdate(i.id)}分前の情報`;
          else note = l.wait > 0 ? `およそ${waitMinutes(l.wait)}分待ち` : '待ちなし';
          return itemRow(i, { sub: `${placeLabel(i)}　${note}` });
        })
        .join('')}

      <div class="navnote" style="margin-top:14px">
        待ち人数は<b>広報1年「トラメガ隊」</b>が学内を巡回して報告した最新値です。
        1人あたり40秒で計算したおおよその待ち時間も表示しています。
        ${
          cfg.staffFormUrl
            ? `<br><a href="${esc(cfg.staffFormUrl)}" target="_blank" rel="noopener" style="color:var(--magenta);font-weight:700">隊員用の入力フォームを開く →</a>`
            : ''
        }
      </div>
    </div>`;
}

/* ---------- 模擬店・企画一覧 ---------- */

function viewList() {
  const cats = [
    ['all', 'すべて'],
    ['グルメ', 'グルメ'],
    ['スイーツ', 'スイーツ'],
    ['ドリンク', 'ドリンク'],
    ['ステージ', 'ステージ'],
    ['展示', '展示'],
    ['体験', '体験'],
    ['ツアー', 'ツアー'],
    ['相談', '相談'],
  ];
  const q = UI.listQuery.trim().toLowerCase();
  const list = Store.items.filter((i) => {
    const okCat = UI.listFilter === 'all' || i.category === UI.listFilter;
    const okQ =
      !q ||
      [i.name, i.org, i.genre, ...(i.tags || [])].join(' ').toLowerCase().includes(q);
    return okCat && okQ;
  });

  return `
    <div class="view">
      <input class="search" id="listSearch" placeholder="模擬店・企画を検索" value="${esc(UI.listQuery)}">
      <div class="chips">
        ${cats
          .map(
            ([k, label]) =>
              `<button class="chip" data-set="listFilter" data-value="${k}" aria-pressed="${UI.listFilter === k}">${label}</button>`
          )
          .join('')}
      </div>
      ${
        list.length
          ? list.map((i) => itemRow(i, { showRating: true })).join('')
          : `<div class="empty"><span class="empty__emoji">🔍</span>該当する模擬店・企画がありません</div>`
      }
      <div class="foot">全${Store.items.length}件（模擬店${Store.items.filter((i) => i.type === 'shop').length}・企画${Store.items.filter((i) => i.type === 'event').length}）</div>
    </div>`;
}

/* ---------- 詳細 ---------- */

function viewItem(id) {
  const item = Store.byId[id];
  if (!item) return `<div class="view"><div class="empty">見つかりませんでした</div></div>`;

  const live = liveOf(id);
  const r = ratingOf(id);
  const lv = levelOf(live.wait);
  const rank = item.type === 'shop' ? salesRank(id) : null;
  const mine = MyReviews.of(id);
  const day = nowDay();
  const slots = (item.slots || []).filter((s) => s.day === day);
  const added = slots.length && MySchedule.has(id, day, slots[0].start);

  return `
    <div class="view">
      <div class="detail__banner" data-emoji="${item.emoji || ''}">
        <div class="detail__org">${esc(item.org)}</div>
        <div class="detail__name">${esc(item.name)}</div>
        <span class="detail__genre">${item.type === 'shop' ? '🍽' : '🎪'} ${esc(item.genre)}</span>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat__label">いまの待ち人数</div>
          ${
            live.reported === false
              ? `<div class="stat__value" style="color:var(--faint)">—</div>
                 <div class="stat__note">まだ報告が届いていません</div>`
              : `<div class="stat__value" style="color:var(--${lv.key})">${live.wait}人</div>
                 <div class="stat__note">${lv.label}・およそ${waitMinutes(live.wait)}分<br>${
                   isStale(id)
                     ? `<span style="color:var(--peak)">⚠ ${minutesSinceUpdate(id)}分前の情報です</span>`
                     : `${live.updatedAt} 時点`
                 }</div>`
          }
        </div>
        <div class="stat">
          <div class="stat__label">${item.type === 'shop' ? '現在の売上個数' : '平均レビュー'}</div>
          <div class="stat__value">${item.type === 'shop' ? `${live.sales}個` : r.avg.toFixed(1)}</div>
          <div class="stat__note">${
            item.type === 'shop'
              ? rank
                ? `<span class="rank">学内${rank.rank}位！</span>（全${rank.total}店）`
                : ''
              : `${r.count}件のレビュー`
          }</div>
        </div>
      </div>

      <div class="card info-list">
        <div class="info-list__item"><span class="info-list__icon">📍</span><span class="info-list__label">場所</span><span>${esc(placeLabel(item))}</span></div>
        <div class="info-list__item"><span class="info-list__icon">🕒</span><span class="info-list__label">${esc(dayLabel(day))}</span><span>${esc(slotLabelFor(item, day))}</span></div>
        <div class="info-list__item"><span class="info-list__icon">💴</span><span class="info-list__label">価格</span><span>${item.price ? `${item.price}円` : '無料'}</span></div>
        <div class="info-list__item"><span class="info-list__icon">📅</span><span class="info-list__label">開催日</span><span>${(item.days || []).map(dayLabel).join(' / ')}</span></div>
      </div>

      <p style="font-size:14px;line-height:1.85;margin:0 2px 12px">${esc(item.desc)}</p>
      <div style="margin:0 2px 16px">${(item.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>

      <div class="card review">
        <div class="review__avg">平均レビュー</div>
        <div class="review__stars-static">${starsHtml(r.avg)}</div>
        <div class="review__count">${r.avg.toFixed(1)}　/　${r.count}件${r.includesMine ? '（あなたの評価を含む）' : ''}</div>
        <div class="review__prompt">${mine ? 'あなたの評価' : 'タップでレビューを追加して、模擬店を応援しよう！'}</div>
        <div class="stars-input" data-review="${id}">
          ${[1, 2, 3, 4, 5]
            .map((n) => `<button data-star="${n}" class="${n <= mine ? 'on' : ''}" aria-label="${n}">★</button>`)
            .join('')}
        </div>
        ${mine ? `<div class="review__thanks">ありがとう！平均に反映されました</div>` : ''}
      </div>

      <button class="btn ${added ? 'btn--added' : 'btn--primary'}" data-schedule="${id}">
        ${
          added
            ? item.type === 'shop'
              ? '✓ 行きたいリストに登録済み'
              : '✓ マイスケジュールに登録済み'
            : item.type === 'shop'
            ? '＋ 行きたい模擬店に追加'
            : '＋ マイスケジュールに追加'
        }
      </button>
      <button class="btn btn--ghost" data-go="#/map/${item.cell}">🧭 ここへの行き方を見る</button>
    </div>`;
}

/* ---------- おすすめ模擬店診断 ---------- */

function viewQuiz() {
  if (UI.quizDone) return quizResultHtml();
  if (!UI.quizQuestion) UI.quizQuestion = Quiz.start();
  const q = UI.quizQuestion;
  if (!q) {
    UI.quizDone = true;
    return quizResultHtml();
  }
  return `
    <div class="view quiz">
      <div class="quiz__progress"><i style="width:${Math.round(Quiz.progress() * 100)}%"></i></div>
      <div class="quiz__step">QUESTION ${Quiz.asked.length + 1}　/　残り${Quiz.candidates.length}件</div>
      <div class="quiz__q">${esc(q.text)}</div>
      <div class="quiz__choices">
        ${['a', 'b']
          .map(
            (side) => `<button class="choice" data-answer="${side}">
              <span class="choice__emoji">${q[side].emoji}</span>
              <span class="choice__label">${esc(q[side].label)}</span>
              <span class="choice__sub">${esc(q[side].sub)}</span>
            </button>`
          )
          .join('')}
      </div>
      ${Quiz.asked.length ? `<button class="btn btn--ghost" style="margin-top:22px" data-quiz="restart">最初からやり直す</button>` : ''}
    </div>`;
}

function quizResultHtml() {
  const results = Quiz.results();
  if (!results.length) {
    return `<div class="view"><div class="empty"><span class="empty__emoji">🤔</span>条件に合う模擬店が見つかりませんでした<br><button class="btn btn--primary" style="margin-top:16px" data-quiz="restart">もう一度診断する</button></div></div>`;
  }
  return `
    <div class="view">
      <div class="result__lead">あなたにおすすめの模擬店は…</div>
      ${results
        .map(
          (res, idx) => `<button class="result__card" data-go="#/item/${res.item.id}">
            <div class="result__top">
              <span class="result__badge">${idx === 0 ? '★ ベストマッチ' : '次点のおすすめ'}</span>
              <div class="result__name">${res.item.emoji || ''} ${esc(res.item.name)}</div>
              <div class="result__org">${esc(res.item.org)}・${esc(res.item.genre)}</div>
            </div>
            <div class="result__bottom">
              <span style="color:var(--amber);font-weight:700">★ ${res.rating.avg.toFixed(1)}</span>
              <span class="lv-${levelOf(res.wait).key}" style="font-weight:700">いま${res.wait}人待ち</span>
              <span class="result__cta">詳細を見る →</span>
            </div>
          </button>`
        )
        .join('')}
      <div class="result__why">
        <b style="color:var(--text)">あなたの回答</b><br>
        ${Quiz.history.map((h) => `${esc(h.q)} → <b style="color:var(--text)">${esc(h.a)}</b>`).join('<br>')}
      </div>
      <button class="btn btn--ghost" data-quiz="restart">もう一度診断する</button>
      <button class="btn btn--ghost" data-go="#/list">全部の模擬店を見る</button>
    </div>`;
}

/* ---------- マイスケジュール ---------- */

const TT_START = 10 * 60;
const TT_END = 16 * 60 + 30;
const TT_PPM = 1.15; // 1分あたりのピクセル

function viewSchedule() {
  if (!UI.scheduleDay) UI.scheduleDay = nowDay();
  const day = UI.scheduleDay;
  const saved = MySchedule.get()
    .filter((e) => e.day === day)
    .map((e) => ({ ...e, item: Store.byId[e.id] }))
    .filter((e) => e.item)
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  // 時間の決まっている企画だけを時間割に置く。模擬店は開店中ずっとやっているので
  // 時間割を埋めてしまわないよう「行きたい模擬店」として別枠に出す。
  // 終日やっている展示・相談は時間割を埋め尽くしてしまうので、上に別枠で出す
  const isAllDay = (e) => toMin(e.end) - toMin(e.start) >= 300;
  const entries = saved.filter((e) => e.item.type === 'event' && !isAllDay(e));
  const allDay = saved.filter((e) => e.item.type === 'event' && isAllDay(e));
  const wishlist = saved.filter((e) => e.item.type === 'shop');

  const height = (TT_END - TT_START) * TT_PPM;
  const hours = [];
  for (let m = TT_START; m <= TT_END; m += 60) {
    hours.push(
      `<div class="tt__hour" style="top:${(m - TT_START) * TT_PPM}px"><span>${fromMin(m)}</span></div>`
    );
  }

  // 時間が重なる予定は横に並べる（重ねると読めなくなるため）。
  // 重なりが連なっている「かたまり」ごとに列数を決めるので、
  // 関係ない時間帯の予定まで細くなることはない。
  const clusters = [];
  let cluster = [];
  let clusterEnd = -1;
  entries.forEach((e) => {
    const s = toMin(e.start);
    if (cluster.length && s >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, toMin(e.end));
  });
  if (cluster.length) clusters.push(cluster);

  clusters.forEach((cl) => {
    const cols = []; // cols[n] = その列で最後に終わる時刻
    cl.forEach((e) => {
      const s = toMin(e.start);
      let col = cols.findIndex((endAt) => endAt <= s);
      if (col < 0) col = cols.length;
      cols[col] = toMin(e.end);
      e._col = col;
    });
    cl.forEach((e) => (e._cols = cols.length));
  });

  const palette = ['#ec4899', '#fb6f5c', '#a855f7', '#3ddc97', '#60a5fa', '#fbbf24'];
  const blocks = entries.map((e, i) => {
    const top = (toMin(e.start) - TT_START) * TT_PPM;
    const h = Math.max(30, (toMin(e.end) - toMin(e.start)) * TT_PPM - 3);
    const color = palette[i % palette.length];
    const w = 100 / (e._cols || 1);
    return `<button class="tt__event" data-remove="${e.id}|${e.day}|${e.start}"
        style="top:${top}px;height:${h}px;background:${color};left:calc(${e._col * w}% + 4px);right:auto;width:calc(${w}% - 8px)">
        <b>${esc(e.item.name)}</b><small>${e.start}–${e.end}</small>
      </button>`;
  });

  const nowT = nowMinutes();
  const showNow = day === nowDay() && nowT >= TT_START && nowT <= TT_END;

  return `
    <div class="view">
      <div class="daytabs">
        ${Store.fes.days
          .map(
            (d) =>
              `<button class="daytab" data-set="scheduleDay" data-value="${d.id}" aria-pressed="${day === d.id}">${esc(d.label)}</button>`
          )
          .join('')}
      </div>

      ${
        entries.length
          ? `<div class="timetable">
              <div class="tt__grid" style="height:${height}px">
                ${hours.join('')}
                ${blocks.join('')}
                ${showNow ? `<div class="tt__now" style="top:${(nowT - TT_START) * TT_PPM}px"></div>` : ''}
              </div>
            </div>
            <div style="font-size:11.5px;color:var(--faint);text-align:center;margin:10px 0 18px">予定をタップすると削除できます</div>`
          : allDay.length || wishlist.length
          ? ''
          : `<div class="empty">
              <span class="empty__emoji">🗓</span>
              まだ予定がありません。<br>気になる企画のページから「マイスケジュールに追加」してみてください。
            </div>`
      }

      ${
        allDay.length
          ? `<div class="section-head"><h2>終日やっている企画</h2></div>
             ${allDay
               .map((e) =>
                 itemRow(e.item, { sub: `${e.start}–${e.end}　${placeLabel(e.item)}` })
               )
               .join('')}`
          : ''
      }

      ${
        wishlist.length
          ? `<div class="section-head"><h2>行きたい模擬店</h2></div>
             ${wishlist
               .map((e) => itemRow(e.item, { sub: `${placeLabel(e.item)}　${e.start}–${e.end}` }))
               .join('')}`
          : ''
      }

      <div class="section-head"><h2>企画を追加する</h2></div>
      <input class="search" id="schedSearch" placeholder="企画名で検索して追加" value="${esc(UI.listQuery)}">
      ${(() => {
        const q = UI.listQuery.trim().toLowerCase();
        const cands = Store.items
          .filter((i) => i.type === 'event' && (i.slots || []).some((s) => s.day === day))
          .filter((i) => !q || [i.name, i.org, i.genre].join(' ').toLowerCase().includes(q))
          // 同じ企画でも回が複数あるもの（キャンパスツアー等）は回ごとに行を出す
          .flatMap((i) => (i.slots || []).filter((s) => s.day === day).map((s) => ({ i, s })))
          .sort((a, b) => toMin(a.s.start) - toMin(b.s.start))
          .slice(0, q ? 30 : 8);
        return cands
          .map(({ i, s }) => {
            const on = MySchedule.has(i.id, day, s.start);
            return `<button class="row" data-add="${i.id}|${day}|${s.start}|${s.end}">
                <span class="row__emoji">${i.emoji || '📍'}</span>
                <span class="row__main">
                  <span class="row__name">${esc(i.name)}</span>
                  <span class="row__sub">${s.start}–${s.end}・${esc(placeLabel(i))}</span>
                </span>
                <span class="row__right" style="font-size:12.5px;font-weight:700;color:${on ? 'var(--free)' : 'var(--magenta)'}">${on ? '✓ 追加済' : '＋ 追加'}</span>
              </button>`;
          })
          .join('');
      })()}

      ${entries.length ? `<button class="btn btn--ghost" style="margin-top:14px" data-clear="1">この端末の予定をすべて消す</button>` : ''}
      <div class="foot">予定はこの端末にだけ保存されます（サーバーには送られません）</div>
    </div>`;
}

/* ---------- キャンパスナビ ---------- */

function viewMap(targetCellId) {
  const target = targetCellId ? findCell(targetCellId) : null;
  if (target && !UI.mapFloor) UI.mapFloor = target.floor.id;

  const allFloors = [];
  Store.areas.forEach((a) => a.floors.forEach((f) => allFloors.push({ area: a, floor: f })));
  const current =
    allFloors.find((x) => x.floor.id === UI.mapFloor) || allFloors[0];

  const svg = floorSvg(current.floor, target && target.floor.id === current.floor.id ? target.cell : null);
  const here = target ? Store.items.find((i) => i.cell === targetCellId) : null;

  return `
    <div class="view">
      ${
        target
          ? `<div class="navnote">
              目的地は <b>${esc(target.area.name)}${target.area.floors.length > 1 ? ' ' + target.floor.label : ''}・${esc(target.cell.label)}</b> です。
              ${here ? `${esc(here.name)}（${esc(here.org)}）` : ''}<br>
              下の地図の<b style="color:var(--magenta)">ピンク</b>が目的地、<b style="color:var(--free)">緑の点</b>が入口です。
            </div>`
          : `<div class="navnote">建物と階を選ぶと、その階の配置が見られます。模擬店ページの「行き方を見る」からも開けます。</div>`
      }

      <div class="floorpicker">
        ${allFloors
          .map(
            (x) =>
              `<button data-set="mapFloor" data-value="${x.floor.id}" aria-pressed="${x.floor.id === current.floor.id}">${esc(x.area.name)}${x.area.floors.length > 1 ? ' ' + x.floor.label : ''}</button>`
          )
          .join('')}
      </div>

      <div class="mapwrap">${svg}</div>
      <div class="legend">
        <span><i style="background:rgba(168,85,247,.5)"></i>模擬店</span>
        <span><i style="background:rgba(251,111,92,.45)"></i>広場・ステージ</span>
        <span><i style="background:rgba(61,220,151,.45)"></i>階段・EV</span>
        <span><i style="background:rgba(255,255,255,.14)"></i>設備（WC等）</span>
      </div>

      <div class="section-head"><h2>${esc(current.area.name)}${current.area.floors.length > 1 ? ' ' + current.floor.label : ''} の企画</h2></div>
      ${(() => {
        const ids = current.floor.cells.map((c) => c.id);
        const items = Store.items.filter((i) => ids.includes(i.cell));
        return items.length
          ? items.map((i) => itemRow(i)).join('')
          : `<div class="empty" style="padding:20px">このフロアに登録された企画はありません</div>`;
      })()}
    </div>`;
}

function floorSvg(floor, targetCell) {
  const cells = floor.cells
    .map((c) => {
      const isTarget = targetCell && c.id === targetCell.id;
      const cls = `cell cell--${c.kind}${isTarget ? ' cell--target' : ''}`;
      const label = c.label
        ? `<text class="cell-label${isTarget ? ' cell-label--target' : ''}" x="${c.x + c.w / 2}" y="${c.y + c.h / 2}">${esc(c.label)}</text>`
        : '';
      return `<g><rect class="${cls}" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="1.4"/>${label}</g>`;
    })
    .join('');

  let route = '';
  if (targetCell) {
    const e = floor.entry;
    const cx = targetCell.x + targetCell.w / 2;
    const cy = targetCell.y + targetCell.h / 2;
    // 廊下があればそこを通る経路にする（実際の歩き方に近い見え方になる）
    const corridor = floor.cells.find((c) => c.kind === 'corridor');
    const midY = corridor ? corridor.y + corridor.h / 2 : (e.y + cy) / 2;
    route = `
      <path class="navpath" d="M ${e.x} ${e.y} V ${midY} H ${cx} V ${cy + targetCell.h / 2 + 1}" marker-end="url(#arrow)"/>
      <circle class="navstart" cx="${e.x}" cy="${e.y}" r="1.6"/>
      <text class="cell-label" x="${e.x}" y="${e.y - 3}" style="fill:var(--free);font-size:2.4px">入口</text>`;
  }

  return `<svg viewBox="0 0 100 100" role="img" aria-label="${esc(floor.label)}のフロアマップ">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fb6f5c"/>
        </marker>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,.015)" rx="2"/>
      ${cells}
      ${route}
    </svg>`;
}

/* ---------- 隊員モード（トラメガ隊の報告用） ---------- */

/** 模擬店IDを入力済みにしたGoogleフォームのURLを組み立てる */
function staffFormLink(itemId) {
  const cfg = window.KODAIRA_CONFIG;
  if (!cfg.staffFormUrl) return '';
  const f = cfg.staffFormFields || {};
  if (!f.itemId) return cfg.staffFormUrl; // 事前入力の設定が無ければ素のフォームを開く
  const u = new URL(cfg.staffFormUrl);
  u.searchParams.set('usp', 'pp_url');
  u.searchParams.set(f.itemId, itemId);
  return u.toString();
}

function viewStaff() {
  const cfg = window.KODAIRA_CONFIG;
  const configured = !!cfg.staffFormUrl;
  const shops = Store.items.filter((i) => i.type === 'shop');

  return `
    <div class="view">
      <div class="navnote">
        <b>トラメガ隊の報告用ページです。</b><br>
        店を選ぶとGoogleフォームが開きます。${
          cfg.staffFormFields && cfg.staffFormFields.itemId
            ? '模擬店IDは入力済みなので、<b>並んでいる人数を数えて入れるだけ</b>です。'
            : '模擬店IDと待ち人数を入力してください。'
        }<br>
        送信すると、来場者の画面には最大${cfg.refreshIntervalSec}秒で反映されます。
      </div>

      ${
        configured
          ? ''
          : `<div class="banner">
              まだフォームが設定されていません。<code>js/config.js</code> の
              <code>staffFormUrl</code> にGoogleフォームのURLを入れてください。
              設定するまで、下のボタンを押しても何も起きません。
            </div>`
      }

      ${shops
        .map((i) => {
          const l = liveOf(i.id);
          const since = minutesSinceUpdate(i.id);
          const stale = isStale(i.id);
          const url = staffFormLink(i.id);
          // 「報告が無い」と「報告はあるが時刻が分からない（デモ等）」は別物
          let status;
          if (l.reported === false) {
            status = '<span style="color:var(--faint);font-size:11px">未報告</span>';
          } else if (since === null) {
            status = `<span style="color:var(--faint);font-size:11px">${
              Store.source === 'demo' ? 'デモ値' : '時刻不明'
            }</span>`;
          } else {
            status = `<span style="font-size:11px;color:${stale ? 'var(--peak)' : 'var(--muted)'}">${
              since === 0 ? 'たった今' : `${since}分前`
            }</span>`;
          }
          return `<a class="row" ${url ? `href="${esc(url)}" target="_blank" rel="noopener"` : ''} style="text-decoration:none">
              <span class="row__emoji">${i.emoji || '📍'}</span>
              <span class="row__main">
                <span class="row__name">${esc(i.name)}</span>
                <span class="row__sub">${esc(i.id)}・${esc(placeLabel(i))}</span>
              </span>
              <span class="row__right">
                <div style="font-size:15px;font-weight:800">${l.wait}人</div>
                ${status}
              </span>
            </a>`;
        })
        .join('')}

      <div class="foot">
        このページは来場者向けメニューには出していません。<br>
        隊員には <code>${esc(location.origin + location.pathname)}#/staff</code> を共有してください。
      </div>
    </div>`;
}

/* ---------- ルーター ---------- */

const TABS = [
  { hash: '#/home', icon: '🏠', label: 'ホーム' },
  { hash: '#/live', icon: '📊', label: '混雑' },
  { hash: '#/list', icon: '📖', label: '一覧' },
  { hash: '#/quiz', icon: '🎯', label: '診断' },
  { hash: '#/schedule', icon: '🗓', label: 'マイ予定' },
];

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, ...rest] = raw.split('/');
  return { name, arg: rest.join('/') };
}

function render() {
  const { name, arg } = currentRoute();
  const titles = {
    home: '',
    live: 'リアルタイム混雑',
    list: '模擬店・企画情報',
    item: Store.byId[arg] ? Store.byId[arg].name : '詳細',
    quiz: 'おすすめ模擬店診断',
    schedule: 'マイスケジュール',
    map: 'キャンパスナビ',
    staff: '隊員モード（報告用）',
  };

  const isRoot = TABS.some((t) => t.hash === '#/' + name);
  topbar.innerHTML = `
    ${isRoot ? '' : `<button class="topbar__back" data-back="1" aria-label="戻る">‹</button>`}
    <div class="topbar__title">${esc(titles[name] ?? '')}</div>
    <div class="topbar__live">
      <span class="dot ${Store.source === 'demo' ? 'dot--demo' : ''}"></span>
      ${Store.source === 'demo' ? 'デモ' : 'LIVE'}
    </div>`;

  const views = {
    home: viewHome,
    live: viewLive,
    list: viewList,
    item: () => viewItem(arg),
    quiz: viewQuiz,
    schedule: viewSchedule,
    map: () => viewMap(arg || null),
    staff: viewStaff,
  };
  app.innerHTML = (views[name] || viewHome)();

  tabbar.innerHTML = TABS.map(
    (t) =>
      `<button data-go="${t.hash}" ${'#/' + name === t.hash ? 'aria-current="page"' : ''}><i>${t.icon}</i>${t.label}</button>`
  ).join('');

  window.scrollTo(0, 0);
}

/* ---------- イベント（1か所で受ける） ---------- */

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-go],[data-back],[data-set],[data-toggle],[data-answer],[data-quiz],[data-star],[data-schedule],[data-add],[data-remove],[data-clear]');
  if (!t) return;

  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.back) return history.length > 1 ? history.back() : go('#/home');

  if (t.dataset.set) {
    UI[t.dataset.set] = t.dataset.value;
    if (t.dataset.set === 'mapFloor') {
      // フロアを手で切り替えたら目的地表示は解除しない（同じ階なら矢印が残る）
    }
    return render();
  }

  if (t.dataset.toggle === 'liveSort') {
    UI.liveSort = UI.liveSort === 'busy' ? 'free' : 'busy';
    return render();
  }

  if (t.dataset.answer) {
    UI.quizQuestion = Quiz.answer(UI.quizQuestion, t.dataset.answer);
    if (!UI.quizQuestion) UI.quizDone = true;
    return render();
  }

  if (t.dataset.quiz === 'restart') {
    UI.quizDone = false;
    UI.quizQuestion = Quiz.start();
    return render();
  }

  if (t.dataset.star) {
    const box = t.closest('[data-review]');
    const id = box.dataset.review;
    const stars = Number(t.dataset.star);
    MyReviews.set(id, stars);
    postReview(id, stars);
    // 自分の★を平均に混ぜ直す
    loadLive().then(render);
    toast(`★${stars} を送信しました`);
    return;
  }

  if (t.dataset.schedule) {
    const item = Store.byId[t.dataset.schedule];
    const day = nowDay();
    const slot = (item.slots || []).find((s) => s.day === day) || (item.slots || [])[0];
    if (!slot) return toast('開催時間が未定です');
    if (MySchedule.has(item.id, slot.day, slot.start)) {
      MySchedule.remove(item.id, slot.day, slot.start);
      toast('マイスケジュールから外しました');
    } else {
      MySchedule.add({ id: item.id, day: slot.day, start: slot.start, end: slot.end });
      toast('マイスケジュールに追加しました');
    }
    return render();
  }

  if (t.dataset.add) {
    const [id, day, start, end] = t.dataset.add.split('|');
    if (MySchedule.has(id, day, start)) {
      MySchedule.remove(id, day, start);
      toast('予定から外しました');
    } else {
      MySchedule.add({ id, day, start, end });
      toast('予定に追加しました');
    }
    return render();
  }

  if (t.dataset.remove) {
    const [id, day, start] = t.dataset.remove.split('|');
    MySchedule.remove(id, day, start);
    toast('予定から外しました');
    return render();
  }

  if (t.dataset.clear) {
    MySchedule.clear();
    toast('予定をすべて消しました');
    return render();
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'listSearch' || ev.target.id === 'schedSearch') {
    UI.listQuery = ev.target.value;
    const pos = ev.target.selectionStart;
    const id = ev.target.id;
    render();
    const again = document.getElementById(id);
    if (again) {
      again.focus();
      again.setSelectionRange(pos, pos);
    }
  }
});

/* レビューをGoogleフォームへ送る（未設定なら端末内保存のみ） */
function postReview(id, stars) {
  const cfg = window.KODAIRA_CONFIG;
  if (!cfg.reviewFormPostUrl || !cfg.reviewFormFields.itemId || !cfg.reviewFormFields.rating) return;
  const body = new URLSearchParams();
  body.append(cfg.reviewFormFields.itemId, id);
  body.append(cfg.reviewFormFields.rating, String(stars));
  // Googleフォームはブラウザから直接POSTするとCORSを返さないため no-cors で投げっぱなしにする
  fetch(cfg.reviewFormPostUrl, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
}

/* ---------- 起動 ---------- */

window.addEventListener('hashchange', () => {
  const { name } = currentRoute();
  if (name !== 'quiz') {
    UI.quizDone = false;
    UI.quizQuestion = null;
  }
  if (name !== 'map') UI.mapFloor = null;
  render();
});

(async function main() {
  try {
    await initData();
    Store.onChange(() => {
      /* データ更新時、詳細・混雑画面だけは静かに描き直す */
      const { name } = currentRoute();
      if (name === 'live' || name === 'home' || name === 'item') render();
    });
    if (!location.hash) location.hash = '#/home';
    render();
  } catch (e) {
    app.innerHTML = `<div class="view"><div class="empty">
      <span class="empty__emoji">⚠️</span>
      データを読み込めませんでした。<br>
      <span style="font-size:11.5px">${esc(e.message)}</span><br><br>
      <span style="font-size:11.5px;color:var(--faint)">ファイルを直接開いた場合、ブラウザの制限でJSONを読めないことがあります。<br>README の「ローカルで開く」の手順をご覧ください。</span>
    </div></div>`;
  }
})();
