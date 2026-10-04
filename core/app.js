/* core/app.js —— 总台
   把 world/acts/*.js 交上来的拍，一拍一拍递到你面前。
   换量程时整页的颜色一起换；换母题时整片场换一套语法。
   这里的规矩：场只负责画，字只归这里，声只在被允许之后才出现。 */
window.UA = window.UA || {};
(function (UA) {
  'use strict';

  var L = UA.lex.t;
  var GLITCH_CH = '々〆〤〻ゞ゠ゝゑゐゔ☆◆◇■□▲△▼▽※→←↑↓∴≡≪≫⊙⊿█▓▒░';

  /* 无头测试用：把所有等待压到最短，内容一个字都一样 */
  var FAST = false;
  try { FAST = !!window.UA_FAST; } catch (e) { FAST = false; }
  function wait(ms) { return FAST ? Math.min(8, ms) : ms; }

  var FLOW = [];
  var ENDINGS = [];
  var idx = 0, queue = [];
  var waiting = false, typing = false, busy = false, stageBound = false;
  var typer = null, typed = '', typeEl = null, glitchAmt = 0, curTilt = .3;
  var lastKey = false;   /* 上一句是不是关键句。关键句不连着来。 */
  var idleBeat = 0, modalOpen = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function calm() { return UA.bus.state.prefs.calm; }
  /* 静一点只放行两样：缓慢扩散的环，和一切停住。
     其余的（过冲 / 撕裂 / 色散 / 抖动 / 全屏翻转 / 扫掠）一律不进渲染。
     矢量场那边另有一份同样的白名单，见 core/field.js 的 CALM_OK。 */
  var CALM_OK = { ring: 1, still: 1 };
  function doFx(kind, opts) { if (calm() && !CALM_OK[kind]) return; UA.field.fx(kind, opts); }
  function bell(k) { UA.audio.bell(k, calm()); }

  /* ---- 光敏提示：推门之前，先把这一片会怎么亮讲清楚 ---- */
  var WARN_TEXT = [
    '这一段重建会亮出下面这几样。它们是这一段的模样，并非装饰：',
    '· 单次的全屏过冲——一下，很快，过后不重复',
    '· 横向错位的细带——缓慢滑动',
    '· 红蓝分岔的色散边——出现在高反差处',
    '· 一次全屏的明暗翻转',
    '· 大面积的渐变、光晕与缓慢移动的几何，整屏铺开'
  ];
  var WARN_TAIL = [
    '倘若看官对闪烁光敏感，抑或有过光敏性癫痫、偏头痛、眩晕的旧账，请先按「收掉闪烁」。',
    '「收掉闪烁」会收掉过冲、色散、撕裂、抖动与翻转，只留缓慢的色与形。',
    '它是一枚永久开关，随时能关。内容一颗字都不会因它而改。'
  ];
  function warning() {
    var st = $('stage');
    st.innerHTML =
      '<div class="warn">' +
      '<div class="wk">' + esc(L('warn.kicker')) + '</div>' +
      '<h2 class="wt">' + esc(L('warn.title')) + '</h2>' +
      '<div class="wb">' + WARN_TEXT.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' +
      '<div class="wb dim">' + WARN_TAIL.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' +
      '<div class="wbtns">' +
      '<button class="gbtn" id="wCalm">' + esc(L('warn.calm')) + '</button>' +
      '<button class="gbtn ghost" id="wOk">' + esc(L('warn.ok')) + '</button>' +
      '</div>' +
      '</div>';
    $('wCalm').onclick = function () {
      UA.bus.setPref('calm', true);
      UA.bus.setPref('warned', true);
      document.body.classList.add('calm');
      applyCalm();
      cover();
    };
    $('wOk').onclick = function () {
      UA.bus.setPref('warned', true);
      cover();
    };
  }

  /* ---- 大章：上篇 / 中篇 / 下篇。这一档换的不是一卷，是一整套记账方式 ---- */
  function partCard(p, after) {
    busy = true;
    var veil = $('veil'), c = $('card');
    veil.style.transition = 'opacity 1.4s ease';
    veil.style.opacity = '1';
    setTimeout(function () {
      setWorld(p.world);
      UA.field.setMotif(p.shot, p.jit || 0);
      doFx('sweep', { amp: 0.9, dur: 1.8 });
      UA.field.fx('ring', { amp: 0.5, reach: 1.7, dur: 2.4 });
      if ($('stage')) $('stage').setAttribute('data-part', p.id || '');
      c.innerHTML =
        '<div class="pnum">' + esc(p.n || '') + '</div>' +
        '<div class="ptitle">' + esc(p.t || '') + '</div>' +
        '<div class="psub">' + esc(p.sub || '') + '</div>' +
        '<div class="pmood">' + esc(p.mood || '') + '</div>' +
        '<span class="prule"></span>';
      c.classList.add('on', 'part');
      bell('end');
      setTimeout(function () {
        c.classList.remove('on', 'part');
        veil.style.opacity = '0';
        setTimeout(function () {
          veil.style.transition = 'opacity 1s ease';
          busy = false;
          c.innerHTML = '';
          if (after) after(); else step();
        }, wait(1100));
      }, wait(calm() ? 5600 : 4000));
    }, wait(1400));
  }

  /* ---- 第一大章 / 第二大章。这一档换的不是一卷，也不是一篇，
          是这一段从今往后按什么记账。所以它比篇更重：
          幕布压两层，扫掠放两道，编号竖着排在名字左边，
          底下一对横线朝两边各自拉出去。 ---- */
  function chapterCard(ch, after) {
    busy = true;
    var veil = $('veil'), c = $('card');
    veil.style.transition = 'opacity 2.2s ease';
    veil.style.opacity = '1';
    setTimeout(function () {
      setWorld(ch.world);
      UA.field.setMotif(ch.shot, ch.jit || 0);
      doFx('sweep', { amp: 1.05, dur: 2.6 });
      UA.field.fx('ring', { amp: 0.6, reach: 2.2, dur: 3.2 });
      if (calm()) UA.field.fx('ring', { amp: 0.4, reach: 1.6, dur: 3.6 });
      if ($('stage')) $('stage').setAttribute('data-chapter', ch.id || '');
      c.innerHTML =
        '<div class="cnums">' + esc(ch.n || '').split('').map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
        '<div class="cbody">' +
        '<div class="ctitle">' + esc(ch.t || '') + '</div>' +
        '<div class="csub">' + esc(ch.sub || '') + '</div>' +
        '<div class="cmood">' + esc(ch.mood || '') + '</div>' +
        (ch.tail ? '<div class="ctail">' + esc(ch.tail) + '</div>' : '') +
        '</div>' +
        '<span class="crule a"></span><span class="crule b"></span>';
      c.classList.add('on', 'chapter');
      bell('end');
      setTimeout(function () {
        /* 名字先被擦掉，幕布再收。顺序反了，这一段就不像一次换章。 */
        doFx('sweep', { amp: 0.8, dur: 1.6 });
        setTimeout(function () {
          c.classList.remove('on', 'chapter');
          veil.style.opacity = '0';
          setTimeout(function () {
            veil.style.transition = 'opacity 1s ease';
            busy = false;
            c.innerHTML = '';
            if (after) after(); else step();
          }, wait(1200));
        }, wait(700));
      }, wait(calm() ? 8600 : 6200));
    }, wait(2000));
  }

  /* ---- 存档：出去一趟，再回来 ---- */
  function exportSave() {
    var t = UA.bus.dump();
    var name = 'aliasing-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.json';
    var ok = false;
    try {
      var b = new Blob([t], { type: 'application/json' });
      var u = (window.URL || window.webkitURL).createObjectURL(b);
      var a = document.createElement('a');
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); (window.URL || window.webkitURL).revokeObjectURL(u); }, 400);
      ok = true;
    } catch (e) { ok = false; }
    try { if (navigator.clipboard) navigator.clipboard.writeText(UA.bus.encode()); } catch (e) { }
    whisper(ok ? L('save.exported') : L('save.copied'));
    return t;
  }

  function openImport() {
    modalOpen = true;
    var st = $('stage');
    var old = $('veil');
    var m = document.createElement('div');
    m.id = 'modal';
    m.innerHTML =
      '<div class="mbox">' +
      '<h3>' + esc(L('save.title')) + '</h3>' +
      '<p class="dim">' + esc(L('save.hint')) + '</p>' +
      '<label class="filepick"><input type="file" id="fIn" accept=".json,.txt,application/json"><span>' + esc(L('save.file')) + '</span></label>' +
      '<textarea id="fTxt" placeholder="' + esc(L('save.paste')) + '"></textarea>' +
      '<div class="mbtns">' +
      '<button class="gbtn" id="fOk">' + esc(L('save.read')) + '</button>' +
      '<button class="gbtn ghost" id="fNo">' + esc(L('save.cancel')) + '</button>' +
      '</div></div>';
    st.appendChild(m);
    function close() { modalOpen = false; if (m.parentNode) m.parentNode.removeChild(m); }
    function apply(txt) {
      var r = UA.bus.restore(txt);
      if (!r.ok) { whisper(r.why); return; }
      close();
      document.body.classList.toggle('calm', !!UA.bus.state.prefs.calm);
      applyCalm();
      UA.audio.setEnabled(!!UA.bus.state.prefs.sound);
      whisper(L('save.loaded'));
      start(false);
    }
    $('fNo').onclick = close;
    $('fOk').onclick = function () { apply($('fTxt').value); };
    $('fIn').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { apply(String(rd.result || '')); };
      rd.readAsText(f, 'utf-8');
    };
  }

  /* ---- 封面 ---- */

  function cover() {
    var st = $('stage');
    var has = UA.bus.state.i > 0;
    st.innerHTML =
      '<div class="cover">' +
      '<div class="cover-kicker">' + esc(L('app.sub')) + '</div>' +
      '<h1 class="cover-title">' + esc(L('app.title')) + '</h1>' +
      '<div class="cover-proto">' + esc(L('app.protocol')) + '</div>' +
      '<p class="cover-line">' + esc(L('app.cover')) + '</p>' +
      '<div class="cover-btns">' +
      (has ? '<button class="gbtn" id="bCont">' + esc(L('app.cont')) + '</button>' : '') +
      '<button class="gbtn" id="bGo">' + esc(L('app.begin')) + '</button>' +
      '<button class="gbtn ghost" id="bRe">' + esc(L('app.restart')) + '</button>' +
      '</div>' +
      '<div class="saverow">' +
      '<button class="sbtn" id="bDump">' + esc(L('save.export')) + '</button>' +
      '<button class="sbtn" id="bLoad">' + esc(L('save.import')) + '</button>' +
      '<button class="sbtn" id="bWarn">' + esc(L('warn.kicker')) + '</button>' +
      '</div>' +
      '<p class="cover-hint">' + esc(L('app.hint')) + '<br>' + esc(L('app.hint2')) + '<br>' + esc(L('app.hint3')) + '</p>' +
      '<div class="note">' +
      '<div class="nk">' + esc(L('note.kicker')) + '</div>' +
      '<p>' + esc(L('note.l1')) + '</p>' +
      '<p>' + esc(L('note.l2')) + '</p>' +
      '<p>' + esc(L('note.l3')) + '</p>' +
      '<div class="ns">' + esc(L('note.sign')) + '</div>' +
      '<div class="nm">' + esc(L('note.motto')) + '<br>' + esc(L('note.motto2')) + '</div>' +
      '</div>' +
      '</div>';
    $('bGo').onclick = function () { start(true); };
    if ($('bCont')) $('bCont').onclick = function () { start(false); };
    $('bRe').onclick = function () { UA.bus.wipe(); idx = 0; queue = []; start(true); };
    $('bDump').onclick = function (e) { e.stopPropagation(); exportSave(); };
    $('bLoad').onclick = function (e) { e.stopPropagation(); openImport(); };
    $('bWarn').onclick = function (e) { e.stopPropagation(); warning(); };
    bell('soft');
  }

  function build() {
    FLOW = [];
    ENDINGS = [];
    var acts = UA.acts || [];
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      for (var j = 0; j < a.length; j++) FLOW.push(a[j]);
    }
    ENDINGS = UA.endings || [];
  }

  function start(fresh) {
    if (fresh) UA.bus.wipe();
    build();
    idx = Math.min(UA.bus.state.i, FLOW.length - 1);
    while (FLOW[idx] && FLOW[idx].cover) idx++;
    queue = [];
    $('stage').innerHTML =
      '<div id="scene"></div>' +
      '<div id="veil"></div>' +
      '<div id="card"></div>' +
      '<div id="hud"><div id="depth"></div><div id="hair"><i></i></div></div>' +
      '<div id="whisper"></div>' +
      '<div id="text"><div id="log"></div><div id="slot"></div></div>';
    UA.field.mount($('scene'));
    UA.field.setBits(UA.bus.state.bits || 8);
    setWorld(UA.bus.state.world || 'interval');
    UA.field.setMotif(UA.bus.state.motif || 'verge', UA.bus.state.jit | 0);
    bindStage();
    paintDepth();
    busy = true;
    $('veil').style.opacity = '0';
    setTimeout(function () { busy = false; playFlow(); }, wait(360));
  }

  /* ---- 输入 ---- */

  function bindStage() {
    if (stageBound) return;
    stageBound = true;
    window.addEventListener('wheel', function (e) {
      UA.field.wheel(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    $('scene').addEventListener('pointerdown', function (e) {
      UA.field.click(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
      UA.bus.state.bits = UA.field.bits;
      UA.bus.save();
      paintDepth();
      UA.audio.setDepth(UA.field.bits);
      if (UA.field.bits <= 3) whisper('它比方才粗。方才便是那样看它的。');
    });
    window.addEventListener('keydown', function (e) {
      if (modalOpen) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
    });
    $('stage').addEventListener('click', function (e) {
      if (modalOpen) return;
      if (e.target.closest('button,input,a,textarea,.warn,.mbox')) return;
      advance();
    });
    var c = $('btnCalm'), s = $('btnSound'), d = $('btnSave');
    if (c) c.onclick = toggleCalm;
    if (s) s.onclick = toggleSound;
    if (d) d.onclick = exportSave;
    /* 闲置：不看它之际，它自行长回一点。这是此处唯一的善意。 */
    setInterval(function () {
      if (busy) return;
      var b = UA.field.bits;
      if (b !== UA.bus.state.bits) {
        UA.bus.state.bits = b; UA.bus.save(); paintDepth(); UA.audio.setDepth(b);
        if (UA.field.idle > 6 && idleBeat++ % 3 === 0) whisper('不看它之际，它自行长回一点。');
      }
    }, 1200);
  }

  /* 指针环挂在窗口上，不在舞台里：封面、提示、正文，它一直都在。
     它同时把指针交给场——场拿它当光源。 */
  function bindGlobal() {
    if (bindGlobal.on) return;
    bindGlobal.on = true;
    function move(x, y, hot) {
      if (UA.field.moveTo) UA.field.moveTo(x, y);
      var r = $('ring');
      if (!r) return;
      r.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      r.classList.toggle('hot', !!hot);
    }
    window.addEventListener('mousemove', function (e) {
      move(e.clientX, e.clientY, e.target && e.target.closest && e.target.closest('button,input,a'));
    });
    window.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches.length) return;
      move(e.touches[0].clientX, e.touches[0].clientY, false);
    }, { passive: true });
  }

  /* 静只做两件事：把身体挂上记号（CSS 里那些动的东西就停了），
     把故障与呼吸归零。内容一个字都不动。 */
  function applyCalm() {
    document.body.classList.toggle('calm', calm());
    if (calm()) { UA.field.setGlitch(0); UA.field.setBreathe(0); }
    if (UA.field.setStill) UA.field.setStill(calm());
    paintGlitch();
    var b = $('btnCalm');
    if (b) b.classList.toggle('on', calm());
  }
  function toggleCalm() {
    UA.bus.setPref('calm', !calm());
    applyCalm();
  }
  function toggleSound() {
    var v = !UA.bus.state.prefs.sound;
    UA.bus.setPref('sound', v);
    UA.audio.setEnabled(v);
    if (v) UA.audio.setDepth(UA.field.bits);
    var b = $('btnSound'); if (b) b.classList.toggle('on', v);
  }

  /* ---- 读数：采样深度用八格表示，不给数字 ---- */
  /* ---- 排印档：换一卷，换的不止是颜色，字也得换一副脾气 ----
     每一档给出四个数：字距 · 字重 · 行高 · 基准倾角。
     倾角不是装饰。它是「这一卷说话时的姿势」。 */
  var TYPE_BY_WORLD = {
    interval:  { ls: .060, wt: 380, lh: 2.05, tilt: .30 },
    dither:    { ls: .085, wt: 400, lh: 2.15, tilt: .55 },
    moire:     { ls: .045, wt: 420, lh: 2.00, tilt: .18 },
    ringing:   { ls: .100, wt: 430, lh: 2.20, tilt: .45 },
    quantize:  { ls: .040, wt: 360, lh: 2.10, tilt: .12 },
    clip:      { ls: .120, wt: 560, lh: 1.95, tilt: .70 },
    guard:     { ls: .140, wt: 340, lh: 2.35, tilt: .10 },
    rebuild:   { ls: .055, wt: 400, lh: 2.05, tilt: .25 },
    invert:    { ls: .070, wt: 500, lh: 2.00, tilt: -.35 },
    alias:     { ls: .050, wt: 450, lh: 2.10, tilt: .40 },
    silence:   { ls: .180, wt: 300, lh: 2.45, tilt: .06 },
    fullscale: { ls: .030, wt: 600, lh: 1.90, tilt: .15 },
    prism:     { ls: .090, wt: 420, lh: 2.10, tilt: .60 },
    hush:      { ls: .160, wt: 320, lh: 2.40, tilt: .08 },
    eclipse:   { ls: .110, wt: 520, lh: 2.00, tilt: -.20 },
    residue:   { ls: .065, wt: 380, lh: 2.15, tilt: .28 },
    imaging:   { ls: .075, wt: 430, lh: 2.05, tilt: -.45 },
    convolve:  { ls: .050, wt: 400, lh: 2.20, tilt: .50 }
  };
  function paintType(id) {
    var t = TYPE_BY_WORLD[id] || TYPE_BY_WORLD.interval;
    var st = document.documentElement.style;
    st.setProperty('--ls', t.ls + 'em');
    st.setProperty('--wt', t.wt);
    st.setProperty('--lh', t.lh);
    st.setProperty('--tilt', t.tilt);
    curTilt = t.tilt;
  }
  /* 换量程一律走这一个门：颜色与排印一起换。分两处写迟早会漏一处。 */
  function setWorld(id) {
    UA.palette.set(id);
    paintType(id);
    /* 矢量场的每一个色都是从当前量程的 ramp 上现采的。
       换了量程不重画，画面上留着的就是上一卷的颜色。 */
    if (UA.field.build) UA.field.build();
  }

  /* 故障量：既喂给场，也挂到身上，让字跟着错位 */
  function paintGlitch() {
    var g = calm() ? 0 : glitchAmt;
    document.documentElement.style.setProperty('--gl', String(g));
    document.body.classList.toggle('glitching', g > 0.22);
  }

  function paintDepth() {
    var d = $('depth');
    if (!d) return;
    var b = UA.field.bits, h = '';
    for (var i = 1; i <= 8; i++) h += '<i class="' + (i <= b ? 'on' : '') + '"></i>';
    d.innerHTML = h;
    d.title = L('app.depth');
    var hair = $('hair');
    if (hair && FLOW.length) hair.firstChild.style.width = Math.round(idx / FLOW.length * 100) + '%';
  }

  function whisper(txt) {
    var w = $('whisper');
    if (!w) return;
    w.textContent = txt;
    w.classList.add('on');
    setTimeout(function () { w.classList.remove('on'); }, 4200);
  }

  /* ---- 推进 ---- */

  function advance() {
    if (busy) return;
    if (typing) { finishTyping(); return; }
    if (!waiting) return;
    waiting = false;
    bell('step');
    step();
  }

  function step() {
    if (queue.length) { play(queue.shift()); return; }
    idx += 1;
    playFlow();
  }

  function playFlow() {
    var b = FLOW[idx];
    if (!b) { ending(); return; }
    UA.bus.state.i = idx;
    UA.bus.save();
    paintDepth();
    play(b);
  }

  function play(b) {
    if (b == null) { busy = false; return; }
    if (b.cover) { cover(); return; }
    if (b.final) { finale(b.final); return; }
    if (b.chapter) { chapterCard(b.chapter, function () { step(); }); return; }
    if (b.part) { partCard(b.part, function () { step(); }); return; }
    if (b.title) { card(b.title, function () { step(); }); return; }
    if (b.world) { setWorld(b.world); UA.bus.state.world = b.world; UA.bus.save(); step(); return; }
    if (b.shot) { var s = b.shot; UA.field.setMotif(s[0], s[1] == null ? 0 : s[1]); UA.bus.state.motif = s[0]; UA.bus.state.jit = s[1] | 0; UA.bus.save(); step(); return; }
    if (b.fx) { for (var i = 0; i < b.fx.length; i++) doFx(b.fx[i][0], b.fx[i][1]); step(); return; }
    if (b.bits != null) { UA.field.setBits(b.bits); UA.bus.state.bits = UA.field.bits; UA.bus.save(); paintDepth(); UA.audio.setDepth(UA.field.bits); step(); return; }
    if (b.glitch != null) { glitchAmt = calm() ? 0 : b.glitch; UA.field.setGlitch(glitchAmt); paintGlitch(); step(); return; }
    if (b.breathe != null) { UA.field.setBreathe(calm() ? 0 : b.breathe); step(); return; }
    if (b.wait) { busy = true; setTimeout(function () { busy = false; step(); }, wait(b.wait)); return; }
    if (b.ending) { ending(); return; }
    if (b.choice) { choices(b.choice); return; }
    if (b.input) { askName(); return; }
    if (b.s) { speak(b); return; }
    step();
  }

  /* ---- 一句话 ---- */

  var VOICE_NAME = { n: '', y: '这位', m: '摩尔纹', sys: '场' };

  /* 小字走专用的窗：摩尔纹一格，场一格。
     字越小越需要一个能托住它的东西，不然它会被场吃掉。 */
  function speak(b) {
    var log = $('log');
    var div = document.createElement('div');
    var boxed = (b.s === 'm' || b.s === 'sys');
    var plain = String(b.t || '').replace(/[\s，。、；：？！「」『』（）—…·,.;:?!()"']/g, '');

    /* 短句推亮一格：像有人拿手指按住这一行。
       连着两句都推，就没有「被按住」的感觉。 */
    var isKey = !boxed && !lastKey && plain.length > 0 && plain.length <= 10;
    lastKey = isKey;

    div.className = 'ln ' + (boxed ? 'box ' : '') + b.s + (isKey ? ' key' : '');

    /* 每一行给一点微差：倾角与缩进，幅度由当前量程那一档定。
       同一卷里不许有两行贴得一模一样。 */
    var rr = Math.random();
    div.style.setProperty('--tl', (curTilt * (rr * 2 - 1)).toFixed(3) + 'deg');
    div.style.setProperty('--ind', (boxed ? 0 : Math.round(rr * 13)) + 'px');

    /* 这一句在讲什么，先交给场。
       场据此把对应的那一层推上去——于是背景与文字对上了。 */
    if (UA.field.cue) UA.field.cue(b.t, b.s);

    log.appendChild(div);
    while (log.children.length > 5) log.removeChild(log.firstChild);
    var kids = log.children;
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('old', i < kids.length - 1);
    if (boxed) {
      div.innerHTML =
        '<span class="tag">' + esc(VOICE_NAME[b.s]) + '</span>' +
        '<span class="txt"></span>' +
        '<span class="tick a"></span><span class="tick b"></span><span class="tick c"></span><span class="tick d"></span>' +
        '<span class="rail"></span>';
      typeInto(div.querySelector('.txt'), b.t, b.s);
    } else {
      typeInto(div, b.t, b.s);
    }
  }

  /* 一句话并非「打」出来的，是一个字一个字「落」下来的。
     每落一个字，它自己先亮一下、再稳住；落完留下一个会闪的记号，
     表示「到这儿了，往下按」。 */
  function typeInto(el, text, sp) {
    typed = text; typeEl = el;
    el.innerHTML = '';
    el.classList.remove('done');
    var body = document.createElement('span'); body.className = 'lb';
    el.appendChild(body);
    var caret = document.createElement('i'); caret.className = 'caret';
    el.appendChild(caret);

    typing = true; waiting = false;
    var speed = sp === 'sys' ? 26 : (sp === 'm' ? 40 : 52);
    if (calm()) speed *= 1.7;
    if (FAST) speed = 1;
    var g = glitchAmt;
    var i = 0;
    if (typer) clearInterval(typer);
    typer = setInterval(function () {
      if (i >= text.length) {
        clearInterval(typer); typer = null; typing = false; waiting = true;
        el.classList.add('done');
        return;
      }
      body.appendChild(glyph(text.charAt(i), i));
      i++;
      if (g > 0.15 && Math.random() < g * 0.05) {
        var bad = document.createElement('i');
        bad.className = 'ch bad';
        bad.textContent = GLITCH_CH[Math.floor(Math.random() * GLITCH_CH.length)];
        body.appendChild(bad);
        setTimeout(function () { if (bad.parentNode) bad.parentNode.removeChild(bad); }, 90);
      }
    }, speed);
  }

  /* 一个字的高低与歪斜由一个确定式给出：同一句每次落下来都长一个样。 */
  function glyph(ch, idx) {
    var e = document.createElement('i');
    e.className = 'ch';
    var k = Math.sin((idx + 1) * 12.9898 + (ch.charCodeAt(0) || 63)) * 0.5;
    e.style.setProperty('--dy', (k * 2.1).toFixed(2) + 'px');
    e.style.setProperty('--gr', (k * 0.65).toFixed(2) + 'deg');
    e.textContent = ch;
    return e;
  }

  function finishTyping() {
    if (typer) { clearInterval(typer); typer = null; }
    typing = false; waiting = true;
    if (!typeEl) return;
    glyphize(typeEl, typed);
    typeEl.classList.add('done');
  }

  /* 把一句话按字摊开。超过六十字的整句不摊——逐字元素一多，滚字会拖。
     摊完在末尾挂一枚记号，记号在那儿闪，等看官往下按。 */
  var SPLIT_MAX = 60;
  function glyphize(el, text) {
    var sfx = String(text == null ? (el.textContent || '') : text);
    el.innerHTML = '';
    var body = document.createElement('span'); body.className = 'lb';
    if (sfx.length >= 2 && sfx.length <= SPLIT_MAX) {
      for (var i = 0; i < sfx.length; i++) body.appendChild(glyph(sfx.charAt(i), i));
    } else {
      body.textContent = sfx;
    }
    el.appendChild(body);
    var caret = document.createElement('i'); caret.className = 'caret';
    el.appendChild(caret);
    return el;
  }

  /* ---- 选择 ---- */

  function choices(list) {
    waiting = false; busy = false;
    var slot = $('slot');
    slot.innerHTML = '<div class="choices">' + list.map(function (o, i) {
      return '<button class="cbtn" data-i="' + i + '"><span class="mark">' + '◆◇▲■△'[i % 5] + '</span>' + esc(o.t) + '</button>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(slot.querySelectorAll('.cbtn'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var o = list[parseInt(b.getAttribute('data-i'), 10)];
        slot.innerHTML = '';
        if (o.fx) UA.bus.fx(o.fx);
        if (o.world) { setWorld(o.world); UA.bus.state.world = o.world; }
        if (o.shot) { UA.field.setMotif(o.shot[0], o.shot[1] || 0); UA.bus.state.motif = o.shot[0]; UA.bus.state.jit = o.shot[1] | 0; }
        if (o.fxlist) for (var i = 0; i < o.fxlist.length; i++) doFx(o.fxlist[i][0], o.fxlist[i][1]);
        if (o.bits != null) { UA.field.setBits(o.bits); UA.bus.state.bits = UA.field.bits; paintDepth(); UA.audio.setDepth(UA.field.bits); }
        queue = (o.reply || []).slice();
        bell('open');
        busy = true;
        setTimeout(function () { busy = false; step(); }, wait(280));
      };
    });
  }

  /* ---- 命名 ---- */

  function askName() {
    waiting = false; busy = false;
    var slot = $('slot');
    slot.innerHTML =
      '<div class="namer">' +
      '<input type="text" id="w" maxlength="10" placeholder="' + esc(L('app.input.ph')) + '" autocomplete="off">' +
      '<button class="cbtn" id="wok"><span class="mark">◆</span>' + esc(L('app.input.ok')) + '</button>' +
      '</div>';
    var inp = $('w');
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 220);
    function go() {
      var v = (inp.value || '').trim();
      if (!v) { inp.classList.add('shake'); setTimeout(function () { inp.classList.remove('shake'); }, 420); return; }
      UA.bus.state.word = v; UA.bus.save();
      slot.innerHTML = '';
      bell('open');
      busy = true;
      setTimeout(function () { busy = false; step(); }, wait(320));
    }
    $('wok').onclick = function (e) { e.stopPropagation(); go(); };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
      e.stopPropagation();
    });
  }

  /* ---- 卡片与换幕 ---- */

  function card(t, after) {
    busy = true;
    var veil = $('veil'), c = $('card');
    veil.style.opacity = '1';
    setTimeout(function () {
      c.innerHTML =
        '<div class="cnum">' + esc(t.n || '') + '</div>' +
        '<div class="ctitle">' + esc(t.t || '') + '</div>' +
        '<div class="csub">' + esc(t.sub || '') + '</div>' +
        (t.mood ? '<div class="cmood">' + esc(t.mood) + '</div>' : '');
      c.classList.add('on');
      bell('hush');
      setTimeout(function () {
        c.classList.remove('on');
        veil.style.opacity = '0';
        setTimeout(function () {
          busy = false;
          c.innerHTML = '';
          if (after) after(); else step();
        }, wait(1000));
      }, wait(calm() ? 3400 : 2400));
    }, wait(900));
  }

  /* ---- 终局 ---- */

  function ensureStage() {
    if ($('veil') && $('card') && $('depth') && $('scene')) return;
    $('stage').innerHTML =
      '<div id="scene"></div><div id="veil"></div><div id="card"></div>' +
      '<div id="hud"><div id="depth"></div><div id="hair"><i></i></div></div>' +
      '<div id="whisper"></div><div id="text"><div id="log"></div><div id="slot"></div></div>';
    UA.field.mount($('cv'));
    bindStage();
    paintDepth();
  }

  function ending() {
    busy = true;
    ensureStage();
    var s = UA.bus.state;
    var pick = ENDINGS[ENDINGS.length - 1];
    for (var i = 0; i < ENDINGS.length; i++) if (ENDINGS[i].when(s)) { pick = ENDINGS[i]; break; }
    s.seen[pick.id] = true;
    s.i = FLOW.length;
    UA.bus.save();
    var veil = $('veil'), c = $('card');
    veil.style.opacity = '1';
    setTimeout(function () {
      setWorld(pick.world);
      UA.field.setMotif(pick.shot, pick.jit || 0);
      doFx('flash', { amt: 0.6, dur: 1.2 });
      c.innerHTML = '<div class="cnum">' + esc(L('app.ending')) + '</div>' +
        '<div class="ctitle">' + esc(pick.name) + '</div>' +
        '<div class="csub">' + esc(pick.sub) + '</div>';
      c.classList.add('on');
      bell('end');
      setTimeout(function () {
        c.classList.remove('on');
        veil.style.opacity = '0';
        queue = pick.lines.slice().concat([{ final: pick }]);
        setTimeout(function () { busy = false; step(); }, wait(1100));
      }, wait(2600));
    }, wait(900));
  }

  function finale(pick) {
    busy = true;
    var s = UA.bus.state;
    function row(k, v, n) { return '<div class="srow"><b>' + esc(k) + '</b><span>' + v + '</span><i>' + n + '</i></div>'; }
    $('stage').innerHTML =
      '<div class="cover end">' +
      '<div class="cover-kicker">' + esc(pick.sub) + '</div>' +
      '<h1 class="cover-title">' + esc(pick.name) + '</h1>' +
      '<div class="tally">' +
      row(L('app.anchor'), s.cai, '') +
      row(L('app.leak'), s.lou, '') +
      row(L('app.alias'), s.die, '') +
      '</div>' +
      '<p class="cover-line">' + esc(s.word ? '留下的那个词是「' + s.word + '」。它如今归此处。' : '这一趟一个词都没落下。') + '</p>' +
      '<div class="cover-btns"><button class="gbtn" id="bAgain">' + esc(L('app.again')) + '</button></div>' +
      '<p class="cover-hint">采样深度 ' + s.bits + ' · ' + esc(L('app.foot')) + '</p>' +
      '</div>';
    $('bAgain').onclick = function () { UA.bus.wipe(); idx = 0; queue = []; start(true); };
    busy = false;
  }

  /* ---- 启动 ---- */

  function init() {
    UA.bus.load();
    setWorld(UA.bus.state.world || 'interval');
    document.body.classList.toggle('calm', !!UA.bus.state.prefs.calm);
    if (UA.bus.state.prefs.sound) UA.audio.setEnabled(true);
    bindGlobal();
    /* 第一次进门先过光敏这一道。看过之后不再拦。 */
    if (!UA.bus.state.prefs.warned) warning(); else cover();
    var c = $('btnCalm'), sn = $('btnSound'), sv = $('btnSave');
    if (c) { c.onclick = toggleCalm; c.classList.toggle('on', calm()); }
    if (sn) { sn.onclick = toggleSound; sn.classList.toggle('on', !!UA.bus.state.prefs.sound); }
    if (sv) sv.onclick = exportSave;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  UA.app = {
    get i() { return idx; },
    get busy() { return busy; },
    get flow() { return FLOW; },
    get endings() { return ENDINGS; },
    start: start, cover: cover, warning: warning, partCard: partCard, chapterCard: chapterCard, advance: advance, step: step,
    setWorld: setWorld, paintType: paintType, paintGlitch: paintGlitch, glyphize: glyphize,
    exportSave: exportSave, openImport: openImport, setCue: function (t, v) { return UA.field.cue(t, v); },
    ending: ending, finale: finale, build: build, whisper: whisper,
    get glitch() { return glitchAmt; },
    setGlitch: function (v) { glitchAmt = v; }
  };
})(window.UA);
