// 階層別2Dマップ。同上、JSとして置いてある。
window.MAP_DATA = {
  "_note": "階層別2Dマップ。座標は各フロア共通の 0-100 × 0-100 の正規化空間。entry はそのフロアの主要な入口で、ナビの矢印はここから目的地セルへ引かれる。実測図に差し替えるときは cell の x/y/w/h だけ描き直せばよい。",
  "areas": [
    {
      "id": "outdoor",
      "name": "屋外エリア",
      "sub": "中庭・正門前",
      "floors": [
        {
          "id": "outdoor-g",
          "label": "屋外",
          "entry": { "x": 50, "y": 96 },
          "cells": [
            { "id": "o-gate", "label": "正門", "kind": "landmark", "x": 38, "y": 88, "w": 24, "h": 8 },
            { "id": "o-plaza", "label": "中庭広場", "kind": "landmark", "x": 33, "y": 40, "w": 34, "h": 26 },
            { "id": "o-1", "label": "2ｸﾗ", "kind": "stall", "x": 8, "y": 74, "w": 15, "h": 9 },
            { "id": "o-2", "label": "20ｸﾗ", "kind": "stall", "x": 26, "y": 74, "w": 15, "h": 9 },
            { "id": "o-3", "label": "22ｸﾗ", "kind": "stall", "x": 44, "y": 74, "w": 15, "h": 9 },
            { "id": "o-4", "label": "4ｸﾗ", "kind": "stall", "x": 62, "y": 74, "w": 15, "h": 9 },
            { "id": "o-5", "label": "15ｸﾗ", "kind": "stall", "x": 80, "y": 74, "w": 15, "h": 9 },
            { "id": "o-6", "label": "11ｸﾗ", "kind": "stall", "x": 8, "y": 58, "w": 15, "h": 9 },
            { "id": "o-7", "label": "9ｸﾗ", "kind": "stall", "x": 8, "y": 44, "w": 15, "h": 9 },
            { "id": "o-8", "label": "13ｸﾗ", "kind": "stall", "x": 8, "y": 30, "w": 15, "h": 9 },
            { "id": "o-9", "label": "5ｸﾗ", "kind": "stall", "x": 77, "y": 58, "w": 15, "h": 9 },
            { "id": "o-10", "label": "17ｸﾗ", "kind": "stall", "x": 77, "y": 44, "w": 15, "h": 9 },
            { "id": "o-11", "label": "25ｸﾗ", "kind": "stall", "x": 77, "y": 30, "w": 15, "h": 9 },
            { "id": "o-wc", "label": "WC", "kind": "facility", "x": 44, "y": 14, "w": 12, "h": 8 },
            { "id": "o-info", "label": "総合案内", "kind": "facility", "x": 62, "y": 88, "w": 18, "h": 8 },
            { "id": "o-aid", "label": "救護", "kind": "facility", "x": 20, "y": 88, "w": 14, "h": 8 }
          ]
        }
      ]
    },
    {
      "id": "east1",
      "name": "東1号館",
      "sub": "教室企画・屋内模擬店",
      "floors": [
        {
          "id": "east1-1f",
          "label": "1F",
          "entry": { "x": 50, "y": 96 },
          "cells": [
            { "id": "e1-hall1", "label": "エントランス", "kind": "landmark", "x": 34, "y": 78, "w": 32, "h": 14 },
            { "id": "e1-101", "label": "101 相談ブース", "kind": "room", "x": 8, "y": 52, "w": 26, "h": 18 },
            { "id": "e1-102", "label": "102 まめの木", "kind": "room", "x": 38, "y": 52, "w": 26, "h": 18 },
            { "id": "e1-103", "label": "103 控室", "kind": "room", "x": 68, "y": 52, "w": 24, "h": 18 },
            { "id": "e1-stair1", "label": "階段→2F", "kind": "stair", "x": 68, "y": 76, "w": 24, "h": 10 },
            { "id": "e1-wc1", "label": "WC", "kind": "facility", "x": 8, "y": 76, "w": 20, "h": 10 },
            { "id": "e1-corr1", "label": "", "kind": "corridor", "x": 8, "y": 72, "w": 84, "h": 3 }
          ]
        },
        {
          "id": "east1-2f",
          "label": "2F",
          "entry": { "x": 80, "y": 88 },
          "cells": [
            { "id": "e1-stair2", "label": "階段↑", "kind": "stair", "x": 68, "y": 80, "w": 24, "h": 10 },
            { "id": "e1-201", "label": "201 冷やし中華", "kind": "room", "x": 8, "y": 52, "w": 26, "h": 18 },
            { "id": "e1-202", "label": "202 ゼミ展示", "kind": "room", "x": 38, "y": 52, "w": 26, "h": 18 },
            { "id": "e1-203", "label": "203 巨大迷路", "kind": "room", "x": 68, "y": 52, "w": 24, "h": 18 },
            { "id": "e1-204", "label": "204 休憩室", "kind": "room", "x": 8, "y": 24, "w": 26, "h": 18 },
            { "id": "e1-wc2", "label": "WC", "kind": "facility", "x": 8, "y": 80, "w": 20, "h": 10 },
            { "id": "e1-corr2", "label": "", "kind": "corridor", "x": 8, "y": 72, "w": 84, "h": 3 }
          ]
        }
      ]
    },
    {
      "id": "gym",
      "name": "体育館",
      "sub": "メインステージ",
      "floors": [
        {
          "id": "gym-1f",
          "label": "1F",
          "entry": { "x": 50, "y": 96 },
          "cells": [
            { "id": "g-stage", "label": "メインステージ", "kind": "landmark", "x": 22, "y": 12, "w": 56, "h": 20 },
            { "id": "g-seat", "label": "客席（自由）", "kind": "room", "x": 16, "y": 38, "w": 68, "h": 34 },
            { "id": "g-stand", "label": "立ち見エリア", "kind": "room", "x": 16, "y": 76, "w": 40, "h": 12 },
            { "id": "g-wc", "label": "WC", "kind": "facility", "x": 62, "y": 76, "w": 22, "h": 12 }
          ]
        }
      ]
    },
    {
      "id": "kanematsu",
      "name": "兼松講堂",
      "sub": "音楽・式典",
      "floors": [
        {
          "id": "kanematsu-1f",
          "label": "1F",
          "entry": { "x": 50, "y": 96 },
          "cells": [
            { "id": "k-hall", "label": "講堂ホール", "kind": "landmark", "x": 18, "y": 22, "w": 64, "h": 46 },
            { "id": "k-lobby", "label": "ロビー", "kind": "room", "x": 26, "y": 74, "w": 48, "h": 14 },
            { "id": "k-wc", "label": "WC", "kind": "facility", "x": 78, "y": 74, "w": 16, "h": 14 }
          ]
        }
      ]
    },
    {
      "id": "mercury",
      "name": "マーキュリータワー",
      "sub": "サークル企画",
      "floors": [
        {
          "id": "mercury-3f",
          "label": "3F",
          "entry": { "x": 50, "y": 94 },
          "cells": [
            { "id": "m-cafe", "label": "カフェ・アンプ", "kind": "room", "x": 20, "y": 34, "w": 40, "h": 24 },
            { "id": "m-lounge", "label": "ひとつなびラウンジ", "kind": "landmark", "x": 64, "y": 34, "w": 28, "h": 24 },
            { "id": "m-ev", "label": "EV / 階段", "kind": "stair", "x": 40, "y": 74, "w": 22, "h": 12 },
            { "id": "m-wc", "label": "WC", "kind": "facility", "x": 68, "y": 74, "w": 20, "h": 12 }
          ]
        }
      ]
    }
  ]
};
