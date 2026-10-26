# HTML スライドキット

話す順に見せる、日本語の投影スライドを HTML 1 枚で作るための小さな道具一式。ブラウザで開けばそのまま発表でき、印刷すれば 1 枚 1 ページの PDF になる。Claude Code のスキル（[SKILL.md](SKILL.md)）としても使える。

見本：[examples/index.html](examples/index.html)（GitHub Pages を有効にすると <https://narupeko.github.io/html-slide-kit/> で見られる）

## できること

- 1280×720 で作り、画面に合わせて拡大縮小する
- クリック・Space・→ で **1 段ずつ**出す（段階送り）。全部出たら次のスライドへ
- 見出しを 1 行ずつ順に出す、手書き風の下線と丸、数字の数え上げ
- レーザーポインター（L）、全画面（F）、左下の操作ヒント（H）
- 印刷・PDF 保存では、最初から全部出た状態になる

## 使い方

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap">
  <link rel="stylesheet" href="kit/slide.css">
  <style>deck-stage:not(:defined){ visibility:hidden; }</style>
</head>
<body>
<deck-stage width="1280" height="720">
  <section class="section">
    <div data-cascade="350">
      <p class="no">SECTION 01</p>
      <h1>見出しは、<br>話す順に出す</h1>
    </div>
    <p class="lead" data-step="1">クリックで出る説明文</p>
  </section>
  <section>…</section>
</deck-stage>
<script src="kit/deck-shell.js"></script>
<script src="kit/deck-extras.js"></script>
</body>
</html>
```

| ファイル | 役割 |
|---|---|
| `kit/deck-shell.js` | スライドの枠組み（`<deck-stage>`）。拡大縮小・キー操作・URL の `#3`・印刷 |
| `kit/deck-extras.js` | 発表用の機能。段階送り・レーザー・全画面・操作ヒント |
| `kit/slide.css` | 見た目。色と文字の大きさは先頭の CSS 変数で変える |

### 操作

| キー | 動き |
|---|---|
| → ↓ Space ・ クリック | 段が残っていれば 1 段出す。全部出ていれば次のスライド |
| ← ↑ | 前のスライド（全部出た状態で出る） |
| Shift + Space | 1 段戻す |
| Home ・ R ／ End | 最初へ ／ 最後へ |
| F ／ L ／ H | 全画面 ／ レーザーポインター ／ 操作ヒントの出し入れ |
| スワイプ | 前後のスライド（タッチ端末） |

### 段階送りの書き方

| 書き方 | 動き |
|---|---|
| `data-step="1"` | 1 回目のクリックで出る。`2`、`3` … と続ける |
| `data-step="0"` | スライドに入ったとき自動で出る |
| `data-cascade="350"`（親に） | 子要素を 350ms ずつずらして順に出す |
| `data-each="1"`（親に） | 子要素をクリックごとに 1 つずつ出す |
| `class="fx-pop"` ／ `class="fx-fade"` | 出方を変える（無印は下から浮き上がる） |
| `style="--d:400ms"` | 出るまでの遅れ |
| `<span class="uline" data-step="1">…</span>` | その段で手書き風の下線を引く（`circ` で丸囲み） |
| `<b data-count="3212">3,212</b>` | その段で 0 から数え上がる（`data-dec="1"` で小数） |

決まり：1 枚 4 段まで。結論は最後の段。表とグラフは一度に出す。

## 公開する

作ったスライドは静的なファイルなので、どこにでも置ける。

**GitHub Pages**：リポジトリの Settings → Pages で公開するブランチを選ぶ。

**Cloudflare Workers**：スライド一式を `public/` に入れ、次の `wrangler.jsonc` を置いて `npx wrangler deploy`。`https://<名前>.<アカウント>.workers.dev/` で開ける。

```jsonc
{
  "name": "my-slides",
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./public" }
}
```

workers.dev の URL は誰でも開ける。参加者だけに見せたいときは Cloudflare Access で守るか、URL を共有する範囲を絞る。検索に出したくないときは `<meta name="robots" content="noindex">` を入れる。

**公開する前に**：個人情報と、所属組織の実データ・内部の事例を外す。参加者の自由記述は要約にする。当日の発表から内容を変えたときは、そのことを表紙に書く。

## ライセンス

- コード（`kit/` の JavaScript と CSS）：[MIT License](LICENSE)
- 文書と見本（`README.md`、`SKILL.md`、`examples/`）：[クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）](LICENSE-docs.md)

© 2026 しらとり なるひこ（Naruhiko Shiratori / narupeko）

CC BY 4.0 の部分を使うときは、たとえば次のように表示する。

> 「HTML スライドキット」しらとり なるひこ、CC BY 4.0（https://github.com/narupeko/html-slide-kit）を改変して作成

## 参考と謝辞

- 段階送り・レーザーポインター・操作ヒントの操作感は、shintajiri 氏の HTML スライド（<https://ai-fd-ishikawa-2026.shintajiri.workers.dev/>）を参考にした。コードは写さず、このキットのために書き直している。同スライドには、レーザーポインターは @fujikururi 氏の HTML スライドの機能を移植したものと書かれている。
- フォント：[BIZ UDPゴシック](https://fonts.google.com/specimen/BIZ+UDPGothic)（© The BIZ UDGothic Project Authors、[SIL Open Font License 1.1](https://openfontlicense.org/)）。このリポジトリにはフォントのファイルを含めず、Google Fonts から読み込む。
