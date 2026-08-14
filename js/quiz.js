/* ===========================================================
   おすすめ模擬店診断（二択・アキネイター方式）
   固定の分岐表ではなく、「残った候補を一番きれいに二分する質問」を
   毎回選んで出す。だから質問数が少なくて済むし、店が増減しても
   質問側を書き直さなくていい。
   =========================================================== */

const QUIZ_QUESTIONS = [
  {
    id: 'type',
    pinned: true, // PDFの診断イメージ①どおり、これだけは必ず最初に聞く
    text: '今行きたいのは…',
    a: { label: '模擬店！', sub: '食べたい・飲みたい', emoji: '🍢', test: (i) => i.type === 'shop' },
    b: { label: '企画！', sub: '見たい・体験したい', emoji: '🎪', test: (i) => i.type === 'event' },
  },
  {
    id: 'portion',
    text: 'お腹の空き具合は？',
    a: { label: 'がっつり', sub: 'これで一食にしたい', emoji: '🍽', test: (i) => i.portion === 'heavy' },
    b: { label: '軽くつまむ', sub: '食べ歩きしたい', emoji: '🥢', test: (i) => i.portion === 'light' },
  },
  {
    id: 'taste',
    text: 'いま欲しいのは？',
    a: { label: '甘いもの', sub: 'スイーツ気分', emoji: '🍬', test: (i) => i.taste === 'sweet' },
    b: { label: 'しょっぱいもの', sub: 'ごはん気分', emoji: '🧂', test: (i) => i.taste === 'savory' },
  },
  {
    id: 'temp',
    text: 'どっちの気分？',
    a: { label: 'あつあつ', sub: '出来たてがいい', emoji: '♨️', test: (i) => i.temp === 'hot' },
    b: { label: 'ひんやり', sub: '涼みたい', emoji: '🧊', test: (i) => i.temp === 'cold' },
  },
  {
    id: 'indoor',
    text: 'どこで過ごしたい？',
    a: { label: '屋内でゆっくり', sub: '座りたい・涼みたい', emoji: '🏠', test: (i) => i.indoor === true },
    b: { label: '外を歩きながら', sub: '祭りの空気を吸う', emoji: '🌞', test: (i) => i.indoor === false },
  },
  {
    id: 'wait',
    text: '行列、どうする？',
    a: {
      label: '待ってでも人気店',
      sub: 'いま並んでいる店',
      emoji: '🔥',
      test: (i) => liveOf(i.id).wait >= 8,
    },
    b: {
      label: 'とにかく早く',
      sub: 'いま空いている店',
      emoji: '⚡',
      test: (i) => liveOf(i.id).wait < 8,
    },
  },
  {
    id: 'seat',
    text: '休憩は必要？',
    a: {
      label: '座れる場所がいい',
      sub: 'ちょっと疲れた',
      emoji: '🪑',
      test: (i) => (i.tags || []).includes('座れる'),
    },
    b: {
      label: '立ったままでOK',
      sub: 'まだまだ回る',
      emoji: '🚶',
      test: (i) => !(i.tags || []).includes('座れる'),
    },
  },
  {
    id: 'photo',
    text: 'どっちを優先する？',
    a: {
      label: '写真映え',
      sub: 'SNSに上げたい',
      emoji: '📸',
      test: (i) => (i.tags || []).includes('写真映え'),
    },
    b: { label: '中身重視', sub: '味・内容で選ぶ', emoji: '💯', test: (i) => !(i.tags || []).includes('写真映え') },
  },
  {
    id: 'company',
    text: '今日は誰と？',
    a: {
      label: '家族・子どもと',
      sub: '小さい子がいる',
      emoji: '👨‍👩‍👧',
      test: (i) => (i.tags || []).includes('子ども歓迎') || (i.tags || []).includes('無料'),
    },
    b: {
      label: '友達・ひとりで',
      sub: '自由に動ける',
      emoji: '🧑‍🤝‍🧑',
      test: (i) => !(i.tags || []).includes('子ども歓迎'),
    },
  },
  {
    id: 'mood',
    text: '過ごし方の好みは？',
    a: {
      label: '盛り上がりたい',
      sub: '熱気の中へ',
      emoji: '🎉',
      test: (i) => (i.tags || []).includes('盛り上がる'),
    },
    b: {
      label: '落ち着きたい',
      sub: '静かに楽しむ',
      emoji: '🍃',
      test: (i) => (i.tags || []).includes('落ち着く') || (i.tags || []).includes('涼しい'),
    },
  },
  {
    id: 'exam',
    text: '受験生ですか？',
    a: {
      label: 'はい',
      sub: '大学のことを知りたい',
      emoji: '📗',
      test: (i) => (i.tags || []).includes('受験生向け'),
    },
    b: { label: 'いいえ', sub: 'とにかく楽しみたい', emoji: '🙌', test: (i) => !(i.tags || []).includes('受験生向け') },
  },
];

const QUIZ_MAX_QUESTIONS = 6;

const Quiz = {
  candidates: [],
  asked: [],
  history: [],

  start() {
    this.candidates = Store.items.slice();
    this.asked = [];
    this.history = [];
    return this.next();
  },

  /** 残り候補を最もきれいに二分する、まだ聞いていない質問を選ぶ */
  next() {
    const pinned = QUIZ_QUESTIONS.find((q) => q.pinned && !this.asked.includes(q.id));
    if (pinned) return pinned;

    if (this.candidates.length <= 2) return null;
    if (this.asked.length >= QUIZ_MAX_QUESTIONS) return null;

    let best = null;
    let bestScore = -1;
    for (const q of QUIZ_QUESTIONS) {
      if (this.asked.includes(q.id)) continue;
      const nA = this.candidates.filter(q.a.test).length;
      const nB = this.candidates.filter(q.b.test).length;
      if (nA === 0 || nB === 0) continue; // どちらかが空になる質問は聞く意味がない
      const balance = Math.min(nA, nB) / Math.max(nA, nB); // 1に近いほど半々
      if (balance > bestScore) {
        bestScore = balance;
        best = q;
      }
    }
    return best;
  },

  answer(question, side) {
    const test = question[side].test;
    const filtered = this.candidates.filter(test);
    // 絞りすぎて候補が1件以下になるときは、その回答は「好みの重み」としてだけ覚えて
    // 候補は維持する。結果を必ず2件出せるようにするため。
    if (filtered.length >= 2) this.candidates = filtered;
    this.asked.push(question.id);
    this.history.push({ q: question.text, a: question[side].label, test });
    return this.next();
  },

  /** 最終結果：レビュー平均と「いま空いているか」で並べて上位2件 */
  results() {
    const scored = this.candidates.map((item) => {
      const r = ratingOf(item.id);
      const wait = liveOf(item.id).wait;
      const matched = this.history.filter((h) => h.test(item)).length;
      const score = matched * 10 + r.avg * 2 - wait * 0.15;
      return { item, score, rating: r, wait };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 2);
  },

  progress() {
    return Math.min(1, this.asked.length / QUIZ_MAX_QUESTIONS);
  },
};
