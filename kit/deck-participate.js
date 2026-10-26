/**
 * deck-participate.js — 聞き手が参加するための部品（クイズ・話し合いタイマー・投票の QR・結果の埋め込み）
 *
 * (c) 2026 しらとり なるひこ (Naruhiko Shiratori) — MIT License
 *
 * deck-extras.js より前に読み込む（クイズの「正解を出す段」を deck-extras.js の段階送りに乗せるため）。
 *
 *   <script src="kit/deck-shell.js"></script>
 *   <script src="kit/deck-participate.js"></script>
 *   <script src="kit/deck-extras.js"></script>
 *
 * 1. その場クイズ（サーバー不要）。予想させてから、クリックで正解と解説を出す
 *      <div class="quiz" data-answer="2" data-reveal="1">
 *        <p class="quiz-q">問い</p>
 *        <ol class="quiz-choices"><li>…</li><li>…</li><li>…</li></ol>
 *        <p class="quiz-why">解説（正解と一緒に出る）</p>
 *      </div>
 *    data-answer は正解の番号（1 始まり）。選択肢には A・B・C … が付くので「指で答えて」「B の人」と言える。
 *    data-reveal は正解を出す段（既定 1）。data-prompt で上の一言を変える（既定「予想して、指で答えてください」）
 *
 * 2. 話し合いタイマー（サーバー不要）
 *      <button class="timer" data-seconds="90">隣の人と話す</button>
 *    クリックで開始・一時停止。data-autostart を付けると、その要素が出たとき（スライドに入ったとき）に始まる。
 *    スライドを離れると元に戻る
 *
 * 3. 投票ページの入口（QR コードと URL）
 *      <div class="join" data-url="https://example.com/poll/q1">スマホで投票</div>
 *    QR コードは qrcode-generator（MIT, Kazuhiko Arase）を cdnjs から読み込んで描く。読めないときは URL だけ出す
 *
 * 4. 結果の埋め込み
 *      <iframe class="live-frame" src="https://example.com/poll/q1/results"></iframe>
 *    埋め込んだページが parent.postMessage({nav: 1}) / ({nav: -1}) を送ると、スライドを送る・戻す
 *    （iframe をクリックするとキーが iframe に取られるため。送らないサービスでは、スライドの外をクリックしてから操作する）
 *
 * 5. 事前配布用の印刷
 *    URL の末尾に ?handout を付けて開き、印刷 → PDF にすると、クイズの答えと解説を伏せる。
 *    ほかに伏せたい要素には data-handout="hide" を付ける。?handout なしで印刷すると全部出る（発表後の配布用）
 */
(() => {
  const deck = document.querySelector('deck-stage');
  if (!deck) return;

  const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const LETTERS = 'ABCDEFGH';

  const css = `
    .quiz{ border-top:5px solid var(--accent, #0B72B9); background:var(--paper-2, #F4F6F9); border-radius:8px; padding:22px 30px 26px; }
    .quiz-prompt{ display:flex; align-items:center; gap:12px; font-size:16px; color:var(--ink-2, #48515C); margin:0 0 10px; }
    .quiz-prompt b{ font-size:14px; letter-spacing:.1em; color:#fff; background:var(--accent, #0B72B9); padding:2px 10px; border-radius:999px; }
    .quiz-q{ font-size:28px; font-weight:700; color:var(--navy, #13294B); margin:0 0 18px; line-height:1.45; }
    .quiz-choices{ list-style:none; margin:0; padding:0; display:grid; gap:12px; }
    .quiz-choices:has(> li:nth-child(4)){ grid-template-columns:1fr 1fr; }   /* 4 択以上は 2 列 */
    .quiz-choices > li{ position:relative; display:flex; align-items:center; gap:16px; background:#fff; border:2px solid var(--rule, #D5DBE2);
      border-radius:8px; padding:12px 18px; font-size:22px; transition:opacity 300ms ease, border-color 300ms ease, background 300ms ease; }
    .quiz-choices > li::before{ content:attr(data-letter); flex:none; width:40px; height:40px; border-radius:50%; display:grid; place-items:center;
      font-weight:700; font-size:20px; color:var(--accent, #0B72B9); border:2px solid var(--accent, #0B72B9); }
    .quiz-mark{ display:none; }
    .quiz:has(.quiz-mark.on) .quiz-choices > li:not(.ok){ opacity:.38; }
    .quiz:has(.quiz-mark.on) .quiz-choices > li.ok{ border-color:var(--accent, #0B72B9); background:var(--accent-pale, #E7F2FA); }
    .quiz:has(.quiz-mark.on) .quiz-choices > li.ok::before{ color:#fff; background:var(--accent, #0B72B9); }
    .quiz:has(.quiz-mark.on) .quiz-choices > li.ok::after{ content:"正解"; margin-left:auto; font-size:16px; font-weight:700; color:var(--accent-dark, #075A93); }
    .quiz-why{ margin:16px 0 0; font-size:20px; color:var(--ink-2, #48515C); opacity:0; transition:opacity 300ms ease 150ms; }
    .quiz:has(.quiz-mark.on) .quiz-why{ opacity:1; }

    .timer{ font:inherit; display:inline-flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;
      background:#fff; color:var(--navy, #13294B); border:3px solid var(--accent, #0B72B9); border-radius:12px; padding:14px 34px 12px; }
    .timer .t-time{ font-family:var(--ff-mono, ui-monospace, monospace); font-size:64px; font-weight:700; line-height:1; color:var(--accent, #0B72B9); }
    .timer .t-label{ font-size:18px; color:var(--ink-2, #48515C); }
    .timer .t-bar{ width:100%; height:6px; background:var(--rule, #D5DBE2); border-radius:3px; overflow:hidden; margin-top:6px; }
    .timer .t-bar i{ display:block; height:100%; width:100%; background:var(--accent, #0B72B9); transform-origin:left; }
    .timer.paused .t-time{ opacity:.55; }
    .timer.done{ animation:timer-done 1s ease-in-out 3; border-color:var(--navy, #13294B); }
    .timer.done .t-time{ color:var(--navy, #13294B); }
    @keyframes timer-done{ 50%{ transform:scale(1.04); } }

    .join{ display:inline-flex; align-items:center; gap:22px; background:#fff; border:2px solid var(--rule, #D5DBE2); border-radius:12px; padding:16px 22px; }
    .join .j-qr{ width:200px; height:200px; flex:none; display:grid; place-items:center; background:#fff; }
    .join .j-qr svg{ width:100%; height:100%; display:block; }
    .join .j-qr:empty{ display:none; }
    .join .j-text{ display:flex; flex-direction:column; gap:8px; }
    .join .j-label{ font-size:20px; font-weight:700; color:var(--navy, #13294B); }
    .join .j-url{ font-family:var(--ff-mono, ui-monospace, monospace); font-size:22px; color:var(--accent-dark, #075A93); word-break:keep-all; overflow-wrap:normal; max-width:440px; }

    .live-frame{ width:100%; height:100%; border:0; border-radius:8px; background:#fff; }

    /* 事前配布用の印刷（URL に ?handout）：クイズの答えと解説、data-handout="hide" の要素を伏せる */
    @media print{
      .handout .quiz .quiz-choices > li{ opacity:1 !important; border-color:var(--rule, #D5DBE2) !important; background:#fff !important; }
      .handout .quiz .quiz-choices > li::before{ color:var(--accent, #0B72B9) !important; background:none !important; }
      .handout .quiz .quiz-choices > li.ok::after{ content:none !important; }
      .handout .quiz-why, .handout [data-handout="hide"]{ visibility:hidden !important; }
    }`;
  const style = document.createElement('style');
  style.id = 'deck-participate';
  style.textContent = css;
  document.head.appendChild(style);

  if (new URLSearchParams(location.search).has('handout')) document.documentElement.classList.add('handout');

  const slideOf = (el) => el.closest('deck-stage > *');

  /* ---------- 1. その場クイズ ---------- */
  deck.querySelectorAll('.quiz').forEach(q => {
    const ans = parseInt(q.dataset.answer, 10);
    const choices = q.querySelectorAll('.quiz-choices > li');
    choices.forEach((li, i) => {
      li.dataset.letter = LETTERS[i] || String(i + 1);
      if (i + 1 === ans) li.classList.add('ok');
    });
    if (!q.querySelector('.quiz-prompt')){
      const p = document.createElement('p');
      p.className = 'quiz-prompt';
      p.innerHTML = '<b>QUIZ</b><span></span>';
      p.querySelector('span').textContent = q.dataset.prompt || '予想して、指で答えてください';
      q.prepend(p);
    }
    if (ans){
      const mark = document.createElement('span');
      mark.className = 'quiz-mark';
      mark.dataset.step = q.dataset.reveal || '1';
      q.appendChild(mark);
    }
  });

  /* ---------- 2. 話し合いタイマー ---------- */
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const timers = [...deck.querySelectorAll('.timer')].map(el => {
    const total = Math.max(1, parseInt(el.dataset.seconds, 10) || 60);
    const label = el.textContent.trim();
    el.textContent = '';
    el.innerHTML = '<span class="t-time"></span><span class="t-label"></span><span class="t-bar"><i></i></span>';
    el.querySelector('.t-label').textContent = label || 'クリックで開始';
    if (el.tagName === 'BUTTON') el.type = 'button';
    const t = { el, total, left: total, tick: null };
    const draw = () => {
      el.querySelector('.t-time').textContent = fmt(t.left);
      el.querySelector('.t-bar i').style.transform = `scaleX(${t.left / total})`;
    };
    t.start = () => {
      if (t.tick || t.left <= 0) return;
      el.classList.remove('paused');
      const end = Date.now() + t.left * 1000;
      t.tick = setInterval(() => {
        t.left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        draw();
        if (t.left === 0){ clearInterval(t.tick); t.tick = null; el.classList.add('done'); el.querySelector('.t-label').textContent = '時間です'; }
      }, 200);
    };
    t.pause = () => { clearInterval(t.tick); t.tick = null; el.classList.add('paused'); };
    t.reset = () => {
      clearInterval(t.tick); t.tick = null; t.left = total;
      el.classList.remove('paused', 'done');
      el.querySelector('.t-label').textContent = label || 'クリックで開始';
      draw();
    };
    el.addEventListener('click', (e) => { e.stopPropagation(); t.tick ? t.pause() : (t.left ? t.start() : t.reset()); });
    /* data-autostart：段で出たら始める */
    if (el.hasAttribute('data-autostart')){
      new MutationObserver(() => {
        if (el.classList.contains('on') && slideOf(el)?.hasAttribute('data-deck-active')) t.start();
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    draw();
    return t;
  });
  deck.addEventListener('slidechange', (e) => {
    timers.forEach(t => {
      const s = slideOf(t.el);
      if (s !== e.detail.slide){ t.reset(); return; }
      /* 段の付いていないタイマーは、スライドに入ったら始める */
      if (t.el.hasAttribute('data-autostart') && !t.el.hasAttribute('data-step')) t.start();
    });
  });

  /* ---------- 3. 投票ページの入口（QR） ---------- */
  const joins = [...deck.querySelectorAll('.join')];
  joins.forEach(j => {
    const url = j.dataset.url || '';
    const label = j.textContent.trim() || 'スマホで参加';
    j.textContent = '';
    j.innerHTML = '<div class="j-qr"></div><div class="j-text"><span class="j-label"></span><span class="j-url"></span></div>';
    j.querySelector('.j-label').textContent = label;
    /* 折り返しは「/」「.」の後ろで（単語の途中で切らない） */
    const shown = url.replace(/^https?:\/\//, '') || '（URL 未設定）';
    const box = j.querySelector('.j-url');
    shown.split(/(?<=[./?=&])/).forEach((part, i) => {
      if (i) box.appendChild(document.createElement('wbr'));
      box.appendChild(document.createTextNode(part));
    });
  });
  if (joins.some(j => j.dataset.url)){
    const s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = () => {
      if (typeof qrcode !== 'function') return;
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      joins.forEach(j => {
        if (!j.dataset.url) return;
        try {
          const qr = qrcode(0, 'M');
          qr.addData(j.dataset.url);
          qr.make();
          j.querySelector('.j-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true,
            alt: { text: j.dataset.url + ' の QR コード' } });
        } catch (err) {}
      });
    };
    document.head.appendChild(s);   /* 読めなくても URL の文字は出ている */
  }

  /* ---------- 4. 埋め込んだ結果ページからの「送る・戻す」 ---------- */
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || (d.nav !== 1 && d.nav !== -1)) return;
    const fromDeck = [...deck.querySelectorAll('iframe')].some(f => f.contentWindow === e.source);
    if (!fromDeck) return;
    /* キーと同じ扱いにして、段階送りにも乗せる */
    window.dispatchEvent(new KeyboardEvent('keydown', { key: d.nav > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
  });
})();
