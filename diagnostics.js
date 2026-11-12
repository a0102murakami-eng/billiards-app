"use strict";
// スクロール調査専用。既存の球操作・保存処理を変更しない独立した監視コード。
(() => {
  const table = document.getElementById("table");
  if (!table) return;
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", "スマホ操作の診断");
  // 固定表示・固定サイズにして、診断表示によるページの高さ変化を避ける。
  // 表示部分はタッチを透過させ、台の操作や通常のスクロールを妨げない。
  panel.style.cssText = "position:fixed;bottom:8px;right:8px;width:min(370px,calc(100% - 16px));height:230px;z-index:10000;box-sizing:border-box;padding:10px;background:rgba(15,32,28,.94);color:#fff;border:1px solid #9db9a9;border-radius:8px;pointer-events:none;font:11px/1.5 monospace;contain:layout paint;";
  const heading = document.createElement("div");
  heading.textContent = "操作診断 v1（表示部分はタッチ透過）";
  const reset = document.createElement("button");
  reset.type = "button"; reset.textContent = "記録クリア";
  reset.style.cssText = "pointer-events:auto;float:right;min-height:26px;padding:3px 6px;font-size:10px;";
  const output = document.createElement("pre");
  output.style.cssText = "margin:7px 0 0;font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;";
  panel.append(reset, heading, output); document.body.append(panel);
  let counts, pointerId = null, originY = window.scrollY, lastY = window.scrollY;
  let downY = window.scrollY, gesture = false, maxDelta = 0, css = "球に触れるとCSSを確認します";
  let logs = [], frame = null;
  const started = performance.now();
  const round = value => Math.round(value * 10) / 10;
  function note(text) {
    logs.unshift(`${((performance.now()-started)/1000).toFixed(1)}秒 ${text}`);
    logs.length = Math.min(logs.length, 5);
    schedule();
  }
  function schedule() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; draw(); });
  }
  function draw() {
    output.textContent = `球down:${counts.down} move:${counts.move} cancel:${counts.cancel} up:${counts.up}\n` +
      `球touchstart:${counts.touch} / 操作中:${pointerId === null ? "いいえ" : "はい"}\n` +
      `scroll回数:${counts.scroll} Y:${round(lastY)}px 差:${round(lastY-originY)}px\n` +
      `直近の球操作からの最大Y変化:${round(maxDelta)}px\n${css}\n` + logs.join("\n");
  }
  function clear() {
    counts = {down:0,move:0,cancel:0,up:0,touch:0,scroll:0};
    originY = lastY = downY = window.scrollY; maxDelta = 0; gesture = false;
    // 記録クリアは、アプリのドラッグ状態には干渉しない。
    pointerId = null; logs = []; css = "球に触れるとCSSを確認します"; schedule();
  }
  reset.addEventListener("click", clear);
  const options = {capture:true, passive:true};
  function ballAt(event) { return event.target instanceof Element ? event.target.closest("#table .table-ball") : null; }
  // captureで監視し、既存処理のstopPropagationより先に受け取る。
  document.addEventListener("pointerdown", event => {
    if (panel.contains(event.target)) return;
    const ball = ballAt(event);
    if (!ball) { gesture = false; note(`down:球以外 (${event.target.id || event.target.tagName})`); return; }
    counts.down++; pointerId = event.pointerId; gesture = true;
    downY = window.scrollY; maxDelta = 0;
    css = `touch-action 球:${getComputedStyle(ball).touchAction} 台:${getComputedStyle(table).touchAction}`;
    note(`pointerdown 球${ball.dataset.number} ${event.pointerType} button:${event.button}`);
  }, options);
  document.addEventListener("pointermove", event => {
    if (event.pointerId !== pointerId) return;
    counts.move++; schedule();
  }, options);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    document.addEventListener(type, event => {
      if (event.pointerId !== pointerId) return;
      if (type === "pointerup") counts.up++;
      if (type === "pointercancel") counts.cancel++;
      note(`${type} move累計:${counts.move} Y:${round(window.scrollY)}px`);
      pointerId = null;
      // cancel後に始まるスクロールも、次の操作まで同じ球操作に関連づける。
    }, options);
  }
  document.addEventListener("touchstart", event => {
    if (panel.contains(event.target)) return;
    if (ballAt(event)) { counts.touch++; note("touchstart:球"); }
  }, options);
  document.addEventListener("touchmove", event => {
    if (!gesture) return;
    // 既存のdocumentリスナーより後で、preventDefaultの実行結果を読む。
    if (counts.move === 0 || !event.cancelable || !event.defaultPrevented) {
      note(`touchmove cancelable:${event.cancelable} 抑止済:${event.defaultPrevented}`);
    }
  }, {passive:true});
  window.addEventListener("scroll", () => {
    counts.scroll++; lastY = window.scrollY;
    if (gesture) maxDelta = Math.max(maxDelta, Math.abs(lastY-downY));
    note(`scroll Y:${round(lastY)} 球操作関連:${gesture ? "はい" : "いいえ"}`);
  }, {passive:true});
  clear(); note("診断開始。記録クリア後、球を上下に動かしてください。");
})();
