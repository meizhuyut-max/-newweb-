/* ===========================================================
   KODAIRA祭 WEBパンフレット — 設定ファイル
   ここだけ書き換えれば、コードを触らずに本番データへ切り替わる。
   =========================================================== */

window.KODAIRA_CONFIG = {
  /* --- Googleスプレッドシート連携 ------------------------------------
     トラメガ隊がGoogleフォームに入力 → 回答スプレッドシート
     → 「ファイル > 共有 > ウェブに公開」でCSVとして公開し、そのURLを貼る。

     形式1（推奨・ウェブに公開したCSV）:
       https://docs.google.com/spreadsheets/d/e/2PACX-xxxx/pub?gid=0&single=true&output=csv
     形式2（リンクを知る全員が閲覧可のシート）:
       https://docs.google.com/spreadsheets/d/【ID】/gviz/tq?tqx=out:csv&sheet=【シート名】

     空文字のままだとデモデータで動く（会議で見せる分にはこれで十分）。   */

  // 待ち人数・売上個数（トラメガ隊が巡回して入力）
  congestionCsvUrl: '',

  // 来場者レビュー（★の生ログ。アプリ側で平均を計算する）
  reviewCsvUrl: '',

  /* --- レビュー投稿先 --------------------------------------------------
     Googleフォームの「事前入力したURLを取得」から entry.xxxxx を調べて設定する。
     未設定なら端末内（localStorage）にだけ保存される。                  */
  reviewFormPostUrl: '', // 例: https://docs.google.com/forms/d/e/xxxx/formResponse
  reviewFormFields: {
    itemId: '', // 例: 'entry.123456789'
    rating: '', // 例: 'entry.987654321'
  },

  // トラメガ隊が開く入力フォーム（ヘッダーの「隊員用」リンク先）
  staffFormUrl: '',

  /* --- 挙動 ---------------------------------------------------------- */
  refreshIntervalSec: 60, // 混雑データの自動再取得の間隔（秒）
  demoMode: 'auto', // 'auto' = CSV未設定ならデモ / 'on' = 常にデモ / 'off' = 常に実データ

  /* --- 会期中フラグ ---------------------------------------------------
     開催日以外に見たときも「本祭中の見え方」を再現するため、デモでは
     時刻を会期中に読み替える。本番では false にする。                  */
  simulateFestivalClock: true,
  simulatedTime: '14:35', // simulateFestivalClock時に「いま」とみなす時刻
  simulatedDay: 'd1',
};
