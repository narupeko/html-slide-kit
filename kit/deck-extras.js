/**
 * deck-extras.js — <deck-stage> に後付けする発表用の機能（v2.2 / 2026-10-26）
 *
 * (c) 2026 しらとり なるひこ (Naruhiko Shiratori) — MIT License
 * 操作感は shintajiri 氏の HTML スライド（https://ai-fd-ishikawa-2026.shintajiri.workers.dev/）を参考に、
 * コードは写さず書き直した。
 *
 * deck-stage.js の後に読み込むだけで動く。deck-stage.js は書き換えない。
 *
 *   <script src="deck-stage.js"></script>
 *   ...
 *   <script src="deck-extras.js"></script>   ← </body> の直前
 *
 * 1. 段階送り（data-step）
 *    出したい要素に data-step="1" などを付ける。クリック・Space・→・↓ で 1 段ずつ出て、
 *    全段出たら次のスライドへ進む。data-step="0" はスライドに入ったときに自動で出る。
 *      - 前に進んで入ったスライドは最初の状態から、戻って入ったスライドは最終状態で出す
 *      - ← はスライド単位で戻る（段は飛ばす）。Shift+Space で 1 段戻す
 *      - 動き：無印＝下から浮き上がる／class="fx-pop"＝小さい所から／class="fx-fade"＝その場で
 *      - ずらし：style="--d:400ms"
 *    まとめて書くための省略記法：
 *      - data-cascade="400"：子要素を同じ段で 400ms ずつずらして順に出す（文字が順次出てくる）
 *        段は親の data-step（無ければ 0）を使う
 *      - data-each="1"：子要素を 1 段ずつ（1, 2, 3 …）クリックごとに出す
 *    印刷・PDF・「視差効果を減らす」設定では、最初から最終状態を出す。
 *
 * 2. 手書き風の線
 *      <span class="uline" data-step="1">学生の学び</span>  … 下線を引く（線の色は CSS 変数 --hw-color で変えられる）
 *      <span class="circ"  data-step="2">335 名</span>       … 丸で囲む
 *    文字は最初から見えていて、線だけがその段で引かれる。
 *
 * 3. 数字のカウントアップ
 *      <b data-count="3212">0</b>  data-dec="1" で小数 1 桁。その要素（または親）の段で数え上がる。
 *
 * 4. レーザーポインター（L）：赤い光点がマウスに付いてくる。Zoom の画面共有で「ここ」を示す
 * 5. 全画面（F）：もう一度 F か Esc で戻る
 * 6. 操作ヒント（左下）：しばらく触らないと薄くなる。H で出し入れ
 *
 * キー一覧：→↓ Space・クリック＝次（段→スライド）／←↑＝戻る／Shift+Space＝1段戻す／
 *           F＝全画面／L＝レーザー／H＝ヒント／R・Home＝最初へ／End＝最後へ（枠組み側。deck-stage.js と deck-shell.js のどちらでも動く）
 */
(() => {
  const deck = document.querySelector('deck-stage');
  if (!deck) return;

  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HELP_TEXT = '→↓ 次｜←↑ 戻る｜クリック・Space 段送り｜F 全画面｜L レーザー｜H ヒント';
  const HELP_KEY = 'deck-extras:help-hidden';
  const INTERACTIVE = 'a,button,input,select,textarea,label,summary,video,audio,canvas,iframe,[contenteditable],[data-no-advance]';
  const Z = 2147483000;

  /* ---------- スタイル ---------- */
  const css = `
    deck-stage > * [data-step]{ transition:opacity 280ms ease-out var(--d,0ms), transform 280ms ease-out var(--d,0ms); }
    deck-stage > * [data-step]:not(.on){ opacity:0; transform:translateY(12px); }
    deck-stage > * [data-step].fx-pop{ transition-duration:240ms; transform-origin:center; }
    deck-stage > * [data-step].fx-pop:not(.on){ transform:scale(.6); }
    deck-stage > * [data-step].fx-fade:not(.on){ transform:none; }

    .uline, .circ{ position:relative; display:inline-block; }
    deck-stage > * svg.hw[data-step]{ position:absolute; overflow:visible; pointer-events:none; transform:rotate(-2deg); }
    deck-stage > * svg.hw[data-step]:not(.on){ opacity:1; transform:rotate(-2deg); }
    .uline > svg.hw{ left:-2%; bottom:-.32em; width:104%; height:.5em; }
    .circ  > svg.hw{ left:-12%; top:-22%; width:124%; height:144%; }
    svg.hw path{ fill:none; stroke:var(--hw-color, #0099D9); stroke-width:5; stroke-linecap:round; stroke-linejoin:round;
      stroke-dasharray:1 2; stroke-dashoffset:0; transition:stroke-dashoffset 600ms ease-in-out var(--d,0ms); }
    .circ > svg.hw path{ stroke-width:4; }
    svg.hw:not(.on) path{ stroke-dashoffset:1.01; opacity:0; }

    deck-stage > .dx-snap, deck-stage > .dx-snap *{ transition:none !important; animation-duration:0s !important; animation-delay:0s !important; }
    @media (prefers-reduced-motion: reduce){
      deck-stage > *, deck-stage > * *{ transition:none !important; animation:none !important; }
    }

    #dx-laser{ position:fixed; left:0; top:0; width:22px; height:22px; margin:-11px 0 0 -11px; border-radius:50%;
      z-index:${Z + 2}; pointer-events:none; display:none;
      background:radial-gradient(circle, rgba(255,40,40,1) 0 30%, rgba(255,40,40,.55) 55%, rgba(255,40,40,0) 72%);
      box-shadow:0 0 14px 4px rgba(255,40,40,.45); }
    body.dx-laser #dx-laser{ display:block; }
    body.dx-laser deck-stage{ cursor:none; }

    #dx-help{ position:fixed; left:14px; bottom:10px; z-index:${Z + 1}; pointer-events:none;
      font:12px/1.6 var(--ff-jp, "BIZ UDPGothic", sans-serif); letter-spacing:.02em;
      color:rgba(255,255,255,.78); background:rgba(14,40,65,.55); padding:3px 12px; border-radius:999px;
      transition:opacity 600ms ease; }
    #dx-help.idle{ opacity:.18; }
    #dx-help.hidden{ display:none; }

    @media print{
      deck-stage > * [data-step]{ opacity:1 !important; transform:none !important; }
      deck-stage > * svg.hw[data-step]{ transform:rotate(-2deg) !important; }
      svg.hw path{ stroke-dashoffset:0 !important; opacity:1 !important; }
      #dx-laser, #dx-help{ display:none !important; }
    }`;
  const style = document.createElement('style');
  style.id = 'deck-extras';
  style.textContent = css;
  document.head.appendChild(style);

  const slides = () => [...deck.children].filter(el => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName));
  const current = () => slides()[deck.index] || null;

  /* ---------- 省略記法を data-step に展開 ---------- */
  function expandShorthands(root){
    root.querySelectorAll('[data-cascade]').forEach(p => {
      const gap = parseFloat(p.dataset.cascade) || 300;
      const at = p.dataset.step || '0';
      p.removeAttribute('data-step');
      [...p.children].forEach((c, i) => {
        if (!c.hasAttribute('data-step')) c.dataset.step = at;
        c.style.setProperty('--d', (i * gap) + 'ms');
      });
      p.removeAttribute('data-cascade');
    });
    root.querySelectorAll('[data-each]').forEach(p => {
      const from = parseInt(p.dataset.each, 10) || 1;
      [...p.children].forEach((c, i) => { if (!c.hasAttribute('data-step')) c.dataset.step = String(from + i); });
      p.removeAttribute('data-each');
    });
    const NS = 'http://www.w3.org/2000/svg';
    const shapes = {
      uline: ['0 0 100 22', 'M1 13 C 22 7, 58 16, 99 8'],
      circ:  ['0 0 100 60', 'M58 4 C 26 2, 3 14, 4 31 C 5 50, 34 58, 62 55 C 88 52, 98 38, 96 24 C 94 10, 72 3, 46 5'],
    };
    Object.entries(shapes).forEach(([cls, [vb, d]]) => {
      root.querySelectorAll('.' + cls + '[data-step]').forEach(el => {
        if (el.querySelector(':scope > svg.hw')) return;
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'hw');
        svg.setAttribute('viewBox', vb);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.dataset.step = el.dataset.step;
        if (el.style.getPropertyValue('--d')) svg.style.setProperty('--d', el.style.getPropertyValue('--d'));
        el.removeAttribute('data-step');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('pathLength', '1');
        path.setAttribute('d', d);
        svg.appendChild(path);
        el.appendChild(svg);
      });
    });
  }

  /* ---------- 段階送り ---------- */
  const stepAt = new Map();   /* slide -> いまの段 */

  function maxStep(slide){
    let m = 0;
    slide.querySelectorAll('[data-step]').forEach(e => { m = Math.max(m, +e.dataset.step || 0); });
    return m;
  }
  function counters(el){
    const list = [...el.querySelectorAll('[data-count]')];
    if (el.matches('[data-count]')) list.unshift(el);
    return list;
  }
  function runCounter(c, animate){
    const to = parseFloat(c.dataset.count), dec = +(c.dataset.dec || 0);
    const fmt = v => v.toLocaleString('ja-JP', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (!animate){ c.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      c.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    c.textContent = fmt(0);
    requestAnimationFrame(tick);
  }
  function setStep(slide, n, animate){
    stepAt.set(slide, n);
    if (!animate) slide.classList.add('dx-snap');
    slide.querySelectorAll('[data-step]').forEach(e => {
      const on = (+e.dataset.step || 0) <= n;
      const was = e.classList.contains('on');
      e.classList.toggle('on', on);
      if (on && (!was || !animate)) counters(e).forEach(c => runCounter(c, animate));
    });
    if (!animate){
      void slide.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.remove('dx-snap')));
    }
  }
  const showFinal = (s) => setStep(s, maxStep(s), false);
  function playFromStart(s){
    if (REDUCED){ showFinal(s); return; }
    setStep(s, -1, false);
    /* その間に段が進められていたら、上書きしない */
    requestAnimationFrame(() => requestAnimationFrame(() => { if (stepAt.get(s) === -1) setStep(s, 0, true); }));
  }
  /* 段が残っていれば 1 段進めて true。残っていなければ false（＝次のスライドへ） */
  function stepForward(){
    const s = current();
    if (!s || REDUCED) return false;
    /* 入った直後（段 0 を出す前の -1）に連打されても、段 0 は済んだものとして数える */
    const cur = Math.max(0, stepAt.has(s) ? stepAt.get(s) : maxStep(s));
    if (cur >= maxStep(s)) return false;
    setStep(s, cur + 1, true);
    return true;
  }

  deck.addEventListener('slidechange', (e) => {
    const { index, previousIndex, reason, slide } = e.detail;
    if (!slide) return;
    if (reason === 'mutation') showFinal(slide);
    else if (previousIndex < 0 || index > previousIndex) playFromStart(slide);
    else showFinal(slide);
  });

  /* キー：deck-stage.js より先に受ける（window の捕捉フェーズ） */
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };

    if (k === ' ' && e.shiftKey){
      const s = current();
      if (s && !REDUCED) setStep(s, Math.max(0, (stepAt.get(s) ?? maxStep(s)) - 1), false);
      stop(); return;
    }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' '){
      if (stepForward()) stop();
      else if (k === 'ArrowDown'){ deck.next(); stop(); }   /* ↓ は deck-stage.js が扱わないので補う */
      return;
    }
    if (k === 'ArrowUp'){ deck.prev(); stop(); return; }
    if (k === 'f' || k === 'F'){ toggleFullscreen(); stop(); return; }
    if (k === 'l' || k === 'L'){ toggleLaser(); stop(); return; }
    if (k === 'h' || k === 'H'){ toggleHelp(); stop(); return; }
  }, true);

  /* クリック：段が残っていれば 1 段、無ければ次のスライドへ。リンク・ボタン・文字選択中は進まない。
     タッチ端末では deck-stage.js の左右タップ領域を経由する（左 1/3 は戻る、のまま） */
  window.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const origin = e.composedPath()[0];
    if (origin && origin.getRootNode && origin.getRootNode() === deck.shadowRoot){
      if (origin.classList && origin.classList.contains('tapzone--fwd') && stepForward()){
        e.preventDefault(); e.stopImmediatePropagation();
      }
      return;   /* サムネイル列・操作パネルなど deck-stage.js 自身の UI */
    }
    const el = e.target instanceof Element ? e.target : null;
    if (!el || !el.closest('deck-stage > *') || el.closest(INTERACTIVE)) return;
    /* ドラッグで文字を選んだ後のクリックでは進まない。連打（ダブルクリック）で選ばれた文字は消して進む */
    const sel = window.getSelection ? window.getSelection() : null;
    if (sel && String(sel)){
      if (e.detail > 1) sel.removeAllRanges();
      else return;
    }
    if (!stepForward()) deck.next();
  }, true);

  /* 印刷では全部出し、終わったら今のスライドを最終状態に */
  window.addEventListener('beforeprint', () => slides().forEach(showFinal));

  /* ---------- 全画面（F） ---------- */
  function toggleFullscreen(){
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen || function(){}).call(el);
    }
  }

  /* ---------- レーザーポインター（L） ---------- */
  const laser = document.createElement('div');
  laser.id = 'dx-laser';
  document.body.appendChild(laser);
  let laserOn = false;
  function toggleLaser(){ laserOn = !laserOn; document.body.classList.toggle('dx-laser', laserOn); }
  document.addEventListener('mousemove', (e) => {
    if (!laserOn) return;
    laser.style.left = e.clientX + 'px';
    laser.style.top = e.clientY + 'px';
  });

  /* ---------- 操作ヒント（H） ---------- */
  const help = document.createElement('div');
  help.id = 'dx-help';
  help.textContent = HELP_TEXT;
  document.body.appendChild(help);
  let helpHidden = false;
  try { helpHidden = localStorage.getItem(HELP_KEY) === '1'; } catch (err) {}
  help.classList.toggle('hidden', helpHidden);
  function toggleHelp(){
    helpHidden = !helpHidden;
    help.classList.toggle('hidden', helpHidden);
    try { localStorage.setItem(HELP_KEY, helpHidden ? '1' : '0'); } catch (err) {}
  }
  let idleTimer = null;
  const wake = () => {
    help.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => help.classList.add('idle'), 3000);
  };
  document.addEventListener('mousemove', wake, { passive: true });
  wake();

  /* ---------- 起動 ---------- */
  slides().forEach(s => { expandShorthands(s); showFinal(s); });
  const s0 = current();
  if (s0) playFromStart(s0);
})();
