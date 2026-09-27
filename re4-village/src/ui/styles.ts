export const CSS = /* css */ `
:root {
  --gold: #d8b46a;
  --gold2: #f0d9a0;
  --red: #c8342a;
  --panel: rgba(12, 10, 8, 0.72);
  --line: rgba(216, 180, 106, 0.35);
  --txt: #e8e2d4;
  --dim: #9a9284;
  --font: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", system-ui, sans-serif;
  --serif: "Songti SC", "SimSun", "Noto Serif CJK SC", "Times New Roman", serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; color: var(--txt); font-family: var(--font); user-select: none; }
canvas#game { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; }
#ui { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
#ui .interactive, #ui button, #ui input, #ui select { pointer-events: auto; }
.hidden { display: none !important; }

/* reticle */
#reticle { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
#reticle .dot { position: absolute; left: -2px; top: -2px; width: 4px; height: 4px; border-radius: 50%; background: #fff; box-shadow: 0 0 3px #000; }
#reticle .tick { position: absolute; background: #fff; box-shadow: 0 0 2px #000; }
#reticle .tick.t, #reticle .tick.b { width: 2px; height: 9px; left: -1px; }
#reticle .tick.l, #reticle .tick.r { width: 9px; height: 2px; top: -1px; }
#reticle.enemy .dot, #reticle.enemy .tick { background: #ff4a3a; }
#reticle.focused .dot { width: 6px; height: 6px; left: -3px; top: -3px; }
#hitmark { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; opacity: 0; transition: opacity .12s; }
#hitmark::before, #hitmark::after { content: ''; position: absolute; left: 10px; top: -2px; width: 2px; height: 26px; background: #fff; transform: rotate(45deg); }
#hitmark::after { transform: rotate(-45deg); }
#scope { position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 0 33vh, #000 33.3vh); }
#scope::before { content: ''; position: absolute; left: 50%; top: 17vh; bottom: 17vh; width: 1px; background: rgba(0,0,0,.85); }
#scope::after { content: ''; position: absolute; top: 50%; left: calc(50% - 33vh); right: calc(50% - 33vh); height: 1px; background: rgba(0,0,0,.85); }

/* status panel */
#status { position: absolute; right: 28px; bottom: 26px; width: 290px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
#status .weapon { display: flex; align-items: baseline; gap: 10px; }
#status .wname { font-size: 13px; color: var(--dim); letter-spacing: 1px; }
#status .mag { font-size: 44px; font-weight: 700; line-height: 1; color: #fff; text-shadow: 0 2px 6px #000; font-family: "Arial Narrow", Arial, sans-serif; }
#status .mag.empty { color: var(--red); }
#status .reserve { font-size: 20px; color: var(--dim); font-family: "Arial Narrow", Arial, sans-serif; }
#status .hpwrap { width: 100%; display: flex; align-items: center; gap: 8px; }
#status .hpstate { font-size: 12px; font-weight: 700; letter-spacing: 2px; width: 70px; text-align: right; font-family: Arial, sans-serif; }
#status .hpbar { flex: 1; height: 10px; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.15); position: relative; overflow: hidden; }
#status .hpfill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #3a9a3a, #6ad060); transition: width .15s; }
#status .hplag { position: absolute; left: 0; top: 0; bottom: 0; background: #b83a2a; transition: width .8s .25s; }
#status .knife { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dim); }
#status .kbar { width: 90px; height: 4px; background: rgba(0,0,0,.6); }
#status .kfill { height: 100%; background: #b8bcc0; }
#status .nades { font-size: 12px; color: var(--dim); }
.ecg { width: 100%; height: 26px; }

/* prompt */
#prompt { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; font-size: 18px; text-shadow: 0 2px 4px #000; transition: opacity .1s; }
.key { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 6px; border: 2px solid var(--gold); border-radius: 5px; color: var(--gold2); font-weight: 700; font-family: Arial, sans-serif; background: rgba(0,0,0,.55); font-size: 15px; }
#prompt.melee .key { border-color: #fff; color: #fff; animation: pulse .5s infinite alternate; }
#prompt.melee span.t { color: #fff; font-weight: 700; font-size: 22px; }
@keyframes pulse { from { transform: scale(1); } to { transform: scale(1.12); } }

#toasts { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.toast { font-size: 16px; color: var(--gold2); text-shadow: 0 2px 4px #000, 0 0 12px rgba(0,0,0,.8); animation: toastIn .15s ease-out; }
@keyframes toastIn { from { opacity: 0; transform: translateY(6px); } }
#feed { position: absolute; right: 30px; top: 42%; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.feed { background: var(--panel); border-left: 3px solid var(--gold); padding: 6px 14px; font-size: 14px; animation: toastIn .2s ease-out; }
#pesetas { position: absolute; right: 30px; top: 26px; font-size: 22px; color: var(--gold2); text-shadow: 0 2px 4px #000; transition: opacity .4s; font-family: Arial, sans-serif; }
#pesetas small { font-size: 14px; color: #9ae07a; margin-left: 8px; }
#subtitle { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%); max-width: 70vw; text-align: center; font-size: 20px; line-height: 1.5; text-shadow: 0 2px 4px #000, 0 0 10px #000; }
#areatitle { position: absolute; left: 50px; top: 60px; font-family: var(--serif); font-size: 34px; letter-spacing: 6px; color: #fff; text-shadow: 0 2px 10px #000; transition: opacity 1.2s; opacity: 0; }
#areatitle small { display: block; font-size: 14px; letter-spacing: 3px; color: var(--gold); margin-top: 6px; font-family: var(--font); }
#objective { position: absolute; left: 30px; top: 26px; font-size: 14px; color: var(--txt); text-shadow: 0 1px 3px #000; border-left: 2px solid var(--gold); padding-left: 10px; }
#objective b { color: var(--gold); font-weight: 400; margin-right: 8px; }
#mash { position: absolute; left: 50%; top: 64%; transform: translateX(-50%); text-align: center; }
#mash .bar { width: 260px; height: 8px; background: rgba(0,0,0,.6); border: 1px solid #fff4; margin: 8px auto 0; }
#mash .fill { height: 100%; background: var(--gold); width: 0; }
#mash .label { font-size: 18px; display: flex; gap: 12px; align-items: center; justify-content: center; }
#dmgind { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.dmgarc { position: absolute; left: -90px; top: -90px; width: 180px; height: 180px; border-radius: 50%; border-top: 6px solid rgba(220, 30, 20, .85); animation: arcFade 1.1s forwards; filter: blur(1px); }
@keyframes arcFade { to { opacity: 0; } }
#fps { position: absolute; left: 8px; bottom: 6px; font: 11px monospace; color: #8f8; text-shadow: 0 1px 2px #000; }
#timer { position: absolute; left: 50%; top: 22px; transform: translateX(-50%); font-family: Arial, sans-serif; font-size: 22px; color: var(--gold2); text-shadow: 0 2px 4px #000; }

/* screens */
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; }
.screen.dim { background: rgba(0,0,0,.72); }
.menu { display: flex; flex-direction: column; gap: 6px; min-width: 300px; }
.menu button, .btn { background: transparent; border: none; color: var(--txt); font: 18px var(--font); padding: 10px 26px; text-align: left; cursor: pointer; border-left: 3px solid transparent; letter-spacing: 2px; transition: all .12s; }
.menu button:hover, .menu button.sel, .btn:hover { color: #fff; border-left-color: var(--gold); background: linear-gradient(90deg, rgba(216,180,106,.18), transparent); }
.menu button:disabled { color: #555; cursor: default; }
.menu .desc { font-size: 12px; color: var(--dim); display: block; letter-spacing: 0; margin-top: 3px; }
h1.title { font-family: var(--serif); font-weight: 400; font-size: 64px; letter-spacing: 12px; margin: 0; color: #eee; text-shadow: 0 0 30px rgba(180, 30, 20, .5), 0 4px 20px #000; }
h1.title em { color: var(--red); font-style: normal; }
.subtitle2 { color: var(--gold); letter-spacing: 8px; margin: 12px 0 40px; font-size: 16px; }
.fine { position: absolute; bottom: 18px; font-size: 11px; color: #777; text-align: center; max-width: 80vw; line-height: 1.6; }
#death h1 { font-family: "Times New Roman", var(--serif); font-size: 78px; font-weight: 400; letter-spacing: 10px; color: #b01810; margin: 0 0 40px; text-shadow: 0 0 30px rgba(160,0,0,.6); animation: deathIn 2s ease-out; }
@keyframes deathIn { from { opacity: 0; letter-spacing: 40px; } }
.panel { background: rgba(14,12,10,.92); border: 1px solid var(--line); padding: 26px 34px; min-width: 460px; max-width: 90vw; max-height: 86vh; overflow: auto; }
.panel h2 { margin: 0 0 16px; font-weight: 400; letter-spacing: 4px; color: var(--gold2); font-size: 22px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.06); font-size: 15px; }
.row input[type=range] { width: 180px; }
.row select { background: #111; color: var(--txt); border: 1px solid var(--line); padding: 3px 6px; }
.controls { display: grid; grid-template-columns: auto 1fr; gap: 6px 18px; font-size: 14px; margin-top: 8px; }
.controls .key { height: 24px; min-width: 24px; font-size: 12px; }
.results .big { font-size: 56px; color: var(--gold2); font-family: var(--serif); }

/* attache case */
#case { position: absolute; inset: 0; background: rgba(6,6,6,.9); display: flex; align-items: flex-start; justify-content: center; gap: 30px; padding-top: 5vh; pointer-events: auto; }
.case-grid { position: relative; background: #1b1d1f; border: 3px solid #3a3228; box-shadow: inset 0 0 30px #000, 0 0 40px #000; }
.case-cell { position: absolute; border: 1px solid rgba(255,255,255,.05); }
.case-item { position: absolute; border: 1px solid rgba(255,255,255,.25); background: rgba(80,80,80,.35); cursor: grab; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.case-item:hover { border-color: var(--gold); background: rgba(216,180,106,.18); }
.case-item.sel { border-color: #fff; box-shadow: 0 0 0 2px var(--gold); }
.case-item .cnt { position: absolute; right: 3px; bottom: 1px; font: 700 12px Arial; color: #fff; text-shadow: 0 1px 2px #000; }
.case-item .slot { position: absolute; left: 3px; top: 1px; font: 700 11px Arial; color: var(--gold2); }
.case-item svg { width: 86%; height: 86%; }
.case-ghost { position: absolute; border: 2px dashed #6f6; pointer-events: none; background: rgba(100,255,100,.1); }
.case-ghost.bad { border-color: #f55; background: rgba(255,80,80,.12); }
.case-side { width: 320px; display: flex; flex-direction: column; gap: 12px; }
.case-info { background: var(--panel); border: 1px solid var(--line); padding: 14px; min-height: 120px; font-size: 14px; line-height: 1.6; }
.case-info b { color: var(--gold2); font-size: 16px; font-weight: 400; }
.case-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.case-actions button, .shop button.act { background: rgba(216,180,106,.12); border: 1px solid var(--line); color: var(--txt); padding: 6px 12px; font: 14px var(--font); cursor: pointer; }
.case-actions button:hover, .shop button.act:hover { background: rgba(216,180,106,.3); color: #fff; }
.case-actions button:disabled, .shop button.act:disabled { opacity: .35; cursor: default; }
.valuables { background: var(--panel); border: 1px solid var(--line); padding: 10px 14px; font-size: 13px; max-height: 220px; overflow: auto; }
.valuables div { display: flex; justify-content: space-between; padding: 2px 0; }
.pending { background: rgba(120,40,30,.35); border: 1px solid #a54; padding: 10px; font-size: 13px; }
.case-title { font-size: 13px; color: var(--dim); letter-spacing: 3px; margin-bottom: 6px; }

/* merchant */
.shop { display: flex; gap: 24px; }
.shop .tabs { display: flex; gap: 4px; margin-bottom: 12px; }
.shop .tabs button { background: transparent; border: 1px solid var(--line); color: var(--dim); padding: 6px 16px; font: 15px var(--font); cursor: pointer; }
.shop .tabs button.on { background: rgba(216,180,106,.22); color: #fff; }
.shop .list { width: 520px; max-height: 60vh; overflow: auto; }
.shop .item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.06); font-size: 15px; gap: 12px; }
.shop .item .price { color: var(--gold2); font-family: Arial; min-width: 80px; text-align: right; }
.shop .item .sub { color: var(--dim); font-size: 12px; display: block; }
.merchant-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
.merchant-head .q { font-family: var(--serif); font-size: 26px; color: #9ab0ff; letter-spacing: 2px; }
.merchant-head .money { color: var(--gold2); font-size: 20px; font-family: Arial; }
.lvl { display: inline-flex; gap: 3px; margin-left: 8px; vertical-align: middle; }
.lvl i { width: 10px; height: 10px; border: 1px solid var(--gold); display: inline-block; }
.lvl i.on { background: var(--gold); }
`;
