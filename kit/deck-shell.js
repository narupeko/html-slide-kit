/**
 * deck-shell.js — HTML スライドの枠組み（<deck-stage> 要素）
 *
 * (c) 2026 しらとり なるひこ (Naruhiko Shiratori) — MIT License
 *
 * <deck-stage> の直下の要素 1 つが 1 枚のスライドになる。決まった大きさ（既定 1280×720）で作り、
 * 画面に合わせて拡大縮小する（余りは黒帯）。印刷すると 1 枚 1 ページになり、そのまま PDF にできる。
 *
 *   <deck-stage width="1280" height="720">
 *     <section>…</section>
 *     <section>…</section>
 *   </deck-stage>
 *   <script src="kit/deck-shell.js"></script>
 *   <script src="kit/deck-extras.js"></script>   ← 段階送り・レーザーなど（任意）
 *
 * キー：→ PageDown Space＝次／← PageUp＝前／Home・R＝最初／End＝最後
 * タッチ：左右にスワイプで前後
 * URL の #3 で 3 枚目を開く（めくるたびに書き換わる）
 *
 * スクリプトから：deck.index（0 始まり）・deck.length・deck.next()・deck.prev()・deck.goTo(i)
 * めくるたびに slidechange イベント（detail: index, previousIndex, total, slide, previousSlide, reason）
 */
(() => {
  if (customElements.get('deck-stage')) return;

  const shadowCss = `
    :host{ position:fixed; inset:0; display:block; background:#000; overflow:hidden; }
    .canvas{ position:absolute; left:50%; top:50%; transform-origin:0 0; background:#fff; }
    ::slotted(*){ position:absolute !important; inset:0 !important; width:100% !important; height:100% !important;
      box-sizing:border-box !important; overflow:hidden; visibility:hidden; opacity:0; pointer-events:none; }
    ::slotted([data-deck-active]){ visibility:visible; opacity:1; pointer-events:auto; }
    @media print{
      :host{ position:static; background:none; overflow:visible; }
      .canvas{ position:static; transform:none !important; width:auto !important; height:auto !important; }
      ::slotted(*){ position:relative !important; inset:auto !important; visibility:visible !important; opacity:1 !important;
        width:var(--deck-w) !important; height:var(--deck-h) !important; break-after:page; }
    }`;

  class DeckStage extends HTMLElement {
    constructor(){
      super();
      this._index = 0;
      this._ready = false;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${shadowCss}</style><div class="canvas"><slot></slot></div>`;
      this._canvas = root.querySelector('.canvas');
      this._onKey = this._onKey.bind(this);
      this._fit = this._fit.bind(this);
    }
    get _w(){ return parseInt(this.getAttribute('width'), 10) || 1280; }
    get _h(){ return parseInt(this.getAttribute('height'), 10) || 720; }
    get _slides(){ return [...this.children].filter(el => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName)); }

    connectedCallback(){
      /* 印刷のページの大きさは文書側にしか書けない */
      if (!document.getElementById('deck-shell-page')){
        const st = document.createElement('style');
        st.id = 'deck-shell-page';
        st.textContent = `@page{ size:${this._w}px ${this._h}px; margin:0; } @media print{ html,body{ margin:0; background:none; } }`;
        document.head.appendChild(st);
      }
      this.style.setProperty('--deck-w', this._w + 'px');
      this.style.setProperty('--deck-h', this._h + 'px');
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._fit);
      this._touch();
      /* 子要素（スライド）がそろってから始める */
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this._init(), { once: true });
      else this._init();
    }
    disconnectedCallback(){
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._fit);
    }

    _init(){
      this._ready = true;
      this._fit();
      const n = parseInt(location.hash.slice(1), 10);
      this._index = Number.isFinite(n) ? Math.max(0, Math.min(this._slides.length - 1, n - 1)) : 0;
      this._apply(-1, 'init');
      window.addEventListener('hashchange', () => {
        const m = parseInt(location.hash.slice(1), 10);
        if (Number.isFinite(m) && m - 1 !== this._index) this._go(m - 1, 'api');
      });
    }
    _fit(){
      const w = this._w, h = this._h;
      const s = Math.min(window.innerWidth / w, window.innerHeight / h);
      Object.assign(this._canvas.style, { width: w + 'px', height: h + 'px',
        transform: `scale(${s}) translate(-50%, -50%)` });
    }
    _apply(prev, reason){
      const slides = this._slides, i = this._index;
      slides.forEach((s, k) => {
        if (k === i) s.setAttribute('data-deck-active', '');
        else s.removeAttribute('data-deck-active');
      });
      history.replaceState(null, '', '#' + (i + 1));
      this.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, composed: true, detail: {
        index: i, previousIndex: prev, total: slides.length,
        slide: slides[i] || null, previousSlide: prev >= 0 ? slides[prev] || null : null, reason } }));
    }
    _go(i, reason = 'api'){
      const n = this._slides.length;
      if (!n || !this._ready) return;
      const to = Math.max(0, Math.min(n - 1, i));
      if (to === this._index) return;
      const prev = this._index;
      this._index = to;
      this._apply(prev, reason);
    }
    _onKey(e){
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') this._go(this._index + 1, 'keyboard');
      else if (k === 'ArrowLeft' || k === 'PageUp') this._go(this._index - 1, 'keyboard');
      else if (k === 'Home' || k === 'r' || k === 'R') this._go(0, 'keyboard');
      else if (k === 'End') this._go(this._slides.length - 1, 'keyboard');
      else return;
      e.preventDefault();
    }
    _touch(){
      let x0 = null, y0 = null;
      this.addEventListener('touchstart', (e) => { const p = e.touches[0]; x0 = p.clientX; y0 = p.clientY; }, { passive: true });
      this.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const p = e.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) this._go(this._index + (dx < 0 ? 1 : -1), 'tap');
      }, { passive: true });
    }

    get index(){ return this._index; }
    get length(){ return this._slides.length; }
    goTo(i){ this._go(i, 'api'); }
    next(){ this._go(this._index + 1, 'api'); }
    prev(){ this._go(this._index - 1, 'api'); }
    reset(){ this._go(0, 'api'); }
  }

  customElements.define('deck-stage', DeckStage);
})();
