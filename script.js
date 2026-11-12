"use strict";
(() => {
  const KEY = "billiards-notebook-v1";
  const R = 0.018; // 台の幅を1、高さを0.5として扱う。
  const colors = ["#fff", "#edc32b", "#2460ad", "#cf353b", "#764492", "#e27c26", "#27815b", "#873d39", "#202827", "#edc32b", "#2460ad", "#cf353b", "#764492", "#e27c26", "#27815b", "#873d39"];
  const $ = id => document.getElementById(id);
  const table = $("table");
  let balls = [], selected = null, active = null, records = [], drag = null, dirty = false;
  // touch-action に加え、球のドラッグ中だけブラウザのタッチスクロールを抑止する。
  // document で受けることで、指が台の外へ移動しても抑止を継続する。
  document.addEventListener("touchmove", e => {
    if (drag && e.cancelable) e.preventDefault();
  }, { passive: false });
  let storageHealthy = true;
  function message(text, error = false) { $("status").textContent = text; $("status").classList.toggle("error", error); }
  function ballLabel(n) { return n === 0 ? "白球" : `${n}番`; }
  function makeBall(n) {
    const el = document.createElement("span");
    el.className = "ball" + (n > 8 ? " striped" : "");
    el.style.setProperty("--color", colors[n]);
    if (n) { const number = document.createElement("span"); number.className = "ball-number"; number.textContent = n; el.append(number); }
    return el;
  }
  function validPosition(x, y, ignore = -1, list = balls) {
    return Number.isFinite(x) && Number.isFinite(y) && x >= R && x <= 1-R && y >= R && y <= .5-R && list.every(b => b.n === ignore || Math.hypot(b.x-x, b.y-y) >= 2*R + .0001);
  }
  function validateRecord(item) {
    if (!item || typeof item.id !== "string" || item.id.length > 100 || typeof item.title !== "string" || item.title.length > 100 || typeof item.memo !== "string" || item.memo.length > 5000 || typeof item.date !== "string" || !Array.isArray(item.balls) || item.balls.length > 16) return false;
    const seen = new Set(), checked = [];
    for (const b of item.balls) {
      if (!b || !Number.isInteger(b.n) || b.n < 0 || b.n > 15 || seen.has(b.n) || !validPosition(b.x, b.y, -1, checked)) return false;
      seen.add(b.n); checked.push(b);
    }
    return true;
  }
  function loadStorage() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length > 1000 || !data.every(validateRecord) || new Set(data.map(r=>r.id)).size !== data.length) throw new Error("invalid");
      records = data;
    } catch (_) {
      storageHealthy = false;
      message("保存データを読み込めませんでした。配置の編集は可能です。保存データの上書きを防ぐため、この画面での保存は停止しています。", true);
    }
  }
  function persist(next) {
    if (!storageHealthy) { message("保存先を読み込めないため保存できません。ブラウザの保存設定・既存データを確認してください。", true); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(next)); records = next; renderRecords(); return true; }
    catch (_) { message("保存できませんでした。保存容量やブラウザの設定を確認してください。現在の配置は画面に残っています。", true); return false; }
  }
  function renderPalette() {
    $("palette").replaceChildren();
    for (let n = 0; n <= 15; n++) {
      const used = balls.some(b => b.n === n), button = document.createElement("button");
      button.type = "button"; button.className = "palette-item" + (selected === n ? " selected" : "") + (used ? " used" : "");
      button.setAttribute("aria-label", `${ballLabel(n)}${used ? "・使用中" : "を選ぶ"}`);
      button.setAttribute("aria-pressed", String(selected === n)); button.disabled = used;
      const caption = document.createElement("span"); caption.textContent = used ? "使用中" : ballLabel(n);
      button.append(makeBall(n), caption);
      button.addEventListener("click", () => { selected = n; active = null; render(); message(`${ballLabel(n)}を選択中。台の置きたい位置をタップしてください。`); });
      $("palette").append(button);
    }
  }
  function placeElement(el, b) { el.style.left = `${b.x*100}%`; el.style.top = `${b.y*200}%`; }
  function render() {
    table.querySelectorAll(".table-ball").forEach(el => el.remove());
    for (const b of balls) {
      const el = makeBall(b.n); el.classList.add("table-ball"); el.classList.toggle("active", b.n === active);
      el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", `${ballLabel(b.n)}。矢印キーで移動、Deleteキーで削除`); el.dataset.number = b.n;
      placeElement(el, b);
      el.addEventListener("pointerdown", e => {
        if (e.button !== 0 || drag) return;
        e.preventDefault(); e.stopPropagation(); active = b.n; selected = null;
        table.querySelectorAll(".table-ball").forEach(node=>node.classList.toggle("active", node === el));
        renderPalette(); $("delete-ball").disabled = false;
        const p = point(e); drag = {id:e.pointerId, ball:b, el, dx:b.x-p.x, dy:b.y-p.y, invalid:false};
        el.setPointerCapture(e.pointerId); el.focus({preventScroll:true}); message(`${ballLabel(b.n)}を選択しました。ドラッグで移動、ボタンで削除できます。`);
      });
      el.addEventListener("pointermove", e => {
        if (!drag || drag.id !== e.pointerId) return;
        if (e.cancelable) e.preventDefault();
        const p=point(e), x=Math.max(R,Math.min(1-R,p.x+drag.dx)), y=Math.max(R,Math.min(.5-R,p.y+drag.dy));
        if (validPosition(x,y,b.n)) { b.x=x;b.y=y;placeElement(el,b);dirty=true;drag.invalid=false;message(`${ballLabel(b.n)}を移動中です。`); }
        else { drag.invalid=true; message("球が重なる位置には移動できません。最後に置けた位置を保っています。",true); }
      }, { passive: false });
      const finish = e => { if (drag && drag.id === e.pointerId) { const invalid=drag.invalid; drag=null; if (!invalid) message(`${ballLabel(b.n)}の位置を設定しました。`); } };
      el.addEventListener("pointerup",finish);el.addEventListener("pointercancel",finish);el.addEventListener("lostpointercapture",finish);
      el.addEventListener("keydown", e => {
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault();active=b.n;removeActive();return; }
        const moves={ArrowLeft:[-.005,0],ArrowRight:[.005,0],ArrowUp:[0,-.005],ArrowDown:[0,.005]};
        if (!moves[e.key]) return; e.preventDefault();const [dx,dy]=moves[e.key];
        if(validPosition(b.x+dx,b.y+dy,b.n)){b.x+=dx;b.y+=dy;placeElement(el,b);dirty=true;}else message("台の外や、球と重なる位置には移動できません。",true);
      });
      table.append(el);
    }
    renderPalette(); $("ball-count").textContent = `${balls.length} / 16 球`; $("delete-ball").disabled = active === null;
  }
  function point(e) { const rect=table.getBoundingClientRect(); const x0=rect.left+table.clientLeft,y0=rect.top+table.clientTop;return {x:(e.clientX-x0)/table.clientWidth,y:(e.clientY-y0)/table.clientHeight*.5}; }
  table.addEventListener("pointerdown", e => {
    if (e.button !== 0 || drag || e.target.closest(".table-ball")) return;
    if(selected === null){message("一覧から配置する球を選んでください。");return;}
    const p=point(e);
    if(!validPosition(p.x,p.y)){message("ここには置けません。台の内側で、ほかの球と重ならない位置を選んでください。",true);return;}
    const n=selected;balls.push({n,x:p.x,y:p.y});selected=null;active=n;dirty=true;render();message(`${ballLabel(n)}を配置しました。続けて一覧から球を選べます。`);
  });
  function removeActive(){if(active===null)return;const n=active;balls=balls.filter(b=>b.n!==n);active=null;dirty=true;render();message(`${ballLabel(n)}を削除しました。`);}
  $("delete-ball").addEventListener("click",removeActive);
  $("clear-balls").addEventListener("click",()=>{if(!balls.length)return;if(!confirm("台の上の球をすべて削除しますか？保存済みの記録は残ります。"))return;balls=[];active=null;dirty=true;render();message("台の上の球をすべて削除しました。");});
  for(const id of ["title","memo"])$(id).addEventListener("input",()=>dirty=true);
  function mayReplace(){return !dirty || confirm("まだ保存していない変更があります。現在の編集内容を破棄しますか？");}
  $("new-layout").addEventListener("click",()=>{if(!mayReplace())return;balls=[];active=null;selected=null;$("title").value="";$("memo").value="";dirty=false;render();message("新しい配置を作成しました。");});
  $("save-form").addEventListener("submit",e=>{
    e.preventDefault();if(records.length>=1000){message("保存件数の上限（1,000件）です。不要な記録を削除してください。",true);return;}
    const record={id:Date.now().toString(36)+Math.random().toString(36).slice(2),title:$("title").value.trim()||"無題の配置",memo:$("memo").value,date:new Date().toISOString(),balls:balls.map(b=>({...b}))};
    if(persist([record,...records])){dirty=false;message("配置とメモを保存しました。");}
  });
  function renderRecords(){
    $("saved-list").replaceChildren();$("saved-count").textContent=`${records.length} 件`;
    if(!records.length){const p=document.createElement("p");p.className="empty";p.textContent="保存した配置がここに並びます。";$("saved-list").append(p);return;}
    for(const record of records){
      const item=document.createElement("article");item.className="saved-item";
      const title=document.createElement("h3");title.textContent=record.title;
      const meta=document.createElement("span");meta.className="saved-meta";const date=new Date(record.date);meta.textContent=`${record.balls.length} 球 · ${Number.isNaN(date.getTime()) ? "日時不明" : date.toLocaleString("ja-JP")}`;
      const memo=document.createElement("p");memo.textContent=record.memo;
      const actions=document.createElement("div");actions.className="saved-actions";
      const load=document.createElement("button");load.textContent="読み込む";load.addEventListener("click",()=>{if(!mayReplace())return;balls=record.balls.map(b=>({...b}));$("title").value=record.title;$("memo").value=record.memo;active=null;selected=null;dirty=false;render();message(`「${record.title}」を読み込みました。`);});
      const remove=document.createElement("button");remove.textContent="削除";remove.className="danger";remove.addEventListener("click",()=>{if(confirm(`「${record.title}」を保存一覧から削除しますか？`))if(persist(records.filter(r=>r.id!==record.id)))message("保存した記録を削除しました。");});
      actions.append(load,remove);item.append(title,meta,memo,actions);$("saved-list").append(item);
    }
  }
  window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
  window.addEventListener("storage", e=>{if(e.key===KEY){storageHealthy=false;message("別のタブで保存データが変更されました。保存を続ける前に、このページを再読み込みしてください。未保存の内容は先に控えてください。",true);}});
  loadStorage();render();renderRecords();
})();
