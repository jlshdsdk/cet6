/* CET-6 自学网站 · 全站脚本：点词查询 / 生词收藏 / 进度 / 播放器 / 译文开关 */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };

  /* ---------- 主题切换（5 套配色，localStorage 记忆；须在首次绘制前应用） ---------- */
  var THEMES = [
    { id: '',        name: '藏青 · 默认', c: '#1f3a5f' },
    { id: 'emerald', name: '墨绿',        c: '#1e5c46' },
    { id: 'wine',    name: '绛红',        c: '#8c2f39' },
    { id: 'amber',   name: '琥珀',        c: '#8a5a14' },
    { id: 'violet',  name: '青紫',        c: '#54479c' }
  ];
  var THEME_KEY = 'cet6_theme';
  function savedTheme() { try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; } }
  function applyTheme(id) {
    if (id) document.documentElement.setAttribute('data-theme', id);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(savedTheme());
  function initThemer() {
    var bar = $('.topbar');
    if (!bar || $('#themerBtn')) return;
    var cur = savedTheme();
    var btn = document.createElement('button');
    btn.id = 'themerBtn'; btn.className = 'themer'; btn.title = '切换主题色'; btn.textContent = '🎨';
    bar.appendChild(btn);
    var popEl = document.createElement('div');
    popEl.id = 'themepop'; popEl.className = 'themepop';
    popEl.innerHTML = THEMES.map(function (t) {
      return '<button class="trow' + (t.id === cur ? ' on' : '') + '" data-theme-id="' + t.id + '">' +
        '<span class="dot" style="background:' + t.c + '"></span>' +
        '<span class="tname">' + t.name + '</span><span class="tick">✓</span></button>';
    }).join('');
    document.body.appendChild(popEl);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var opening = !popEl.classList.contains('open');
      popEl.classList.toggle('open', opening);
      if (!opening) return;
      var r = btn.getBoundingClientRect();
      popEl.style.top = (r.bottom + 6) + 'px';
      popEl.style.left = 'auto';
      popEl.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    });
    popEl.addEventListener('click', function (e) {
      var row = e.target.closest('.trow');
      if (!row) return;
      var id = row.getAttribute('data-theme-id');
      applyTheme(id);
      try { localStorage.setItem(THEME_KEY, id); } catch (err) {}
      popEl.querySelectorAll('.trow').forEach(function (x) { x.classList.toggle('on', x === row); });
      popEl.classList.remove('open');
    });
    document.addEventListener('pointerdown', function (e) {
      if (popEl.classList.contains('open') && !popEl.contains(e.target) && !btn.contains(e.target)) popEl.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') popEl.classList.remove('open'); });
  }
  initThemer();

  /* ---------- localStorage 封装 ---------- */
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var VOCAB_KEY = 'cet6_vocab', PROG_KEY = 'cet6_progress', AUDIO_KEY = 'cet6_audio_state';

  /* ---------- 词典（懒加载 + 内存缓存 + 简单词形还原） ---------- */
  var dictCache = {};
  function loadLetter(letter, cb) {
    if (dictCache[letter] !== undefined) { cb(dictCache[letter]); return; }
    var x = new XMLHttpRequest();
    x.open('GET', (window.DICT_BASE || '') + 'dict/' + letter + '.json', true);
    x.onload = function () {
      try { dictCache[letter] = JSON.parse(x.responseText); } catch (e) { dictCache[letter] = null; }
      cb(dictCache[letter]);
    };
    x.onerror = function () { cb(null); };  // 失败不缓存，下次点击可重试
    x.send();
  }
  function stems(w) {
    var out = [w], lower = w.toLowerCase();
    if (lower !== w) out.push(lower);
    var push = function (s) { if (s.length >= 3 && out.indexOf(s) < 0) out.push(s); };
    if (/ies$/.test(lower)) push(lower.slice(0, -3) + 'y');
    if (/es$/.test(lower)) push(lower.slice(0, -2));
    if (/s$/.test(lower)) push(lower.slice(0, -1));
    if (/ied$/.test(lower)) push(lower.slice(0, -3) + 'y');
    if (/ed$/.test(lower)) {
      push(lower.slice(0, -2)); push(lower.slice(0, -1));
      var stem2 = lower.slice(0, -2);
      if (/(.)\1$/.test(stem2) && stem2.length > 3) push(stem2.slice(0, -1));  // stopped→stop
    }
    if (/ing$/.test(lower)) {
      push(lower.slice(0, -3));
      if (lower.length > 5) push(lower.slice(0, -3) + 'e');
      var stem3 = lower.slice(0, -3);
      if (/(.)\1$/.test(stem3) && stem3.length > 3) push(stem3.slice(0, -1));  // running→run
    }
    if (/ly$/.test(lower)) push(lower.slice(0, -2));
    return out;
  }
  function lookup(word, cb) {
    var cands = stems(word);
    var letters = [];
    cands.forEach(function (c) { var l = c[0].toLowerCase(); if (letters.indexOf(l) < 0) letters.push(l); });
    var pending = letters.length, result = null;
    letters.forEach(function (l) {
      loadLetter(l, function (d) {
        if (!result && d) {
          for (var i = 0; i < cands.length; i++) {
            var hit = d[cands[i]];
            if (hit) { result = { word: cands[i], ph: hit[0] || '', t: hit[1] || '' }; break; }
          }
        }
        if (--pending === 0) cb(result);
      });
    });
  }

  /* ---------- 生词本 ---------- */
  function getVocab() { return lsGet(VOCAB_KEY, {}); }
  function starWord(entry, source) {
    var v = getVocab();
    if (v[entry.word]) { delete v[entry.word]; lsSet(VOCAB_KEY, v); toast('已移除 ' + entry.word); }
    else {
      v[entry.word] = { p: entry.ph || '', t: entry.t || '', s: source || '', ts: Date.now() };
      lsSet(VOCAB_KEY, v); toast('已收藏 ' + entry.word);
    }
    return !!v[entry.word];
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 1600);
  }

  /* ---------- 点词查询弹窗 ---------- */
  var pop = null;
  function ensurePop() {
    if (pop) return;
    pop = document.createElement('div'); pop.id = 'wordpop';
    pop.innerHTML = '<div><span class="w"></span><span class="ph"></span></div><div class="t"></div>' +
      '<button class="btn small star"></button><div class="src hint"></div>';
    document.body.appendChild(pop);
    document.addEventListener('pointerdown', function (e) {
      if (pop.style.display === 'block' && !pop.contains(e.target)) hidePop();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePop(); });
  }
  function hidePop() { if (pop) pop.style.display = 'none'; }
  function wordAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || !el.closest || !el.closest('.en, .q, .opts')) return null;
    var range = null, node = null, offset = 0;
    if (document.caretRangeFromPoint) { range = document.caretRangeFromPoint(x, y); }
    else if (document.caretPositionFromPoint) {
      var cp = document.caretPositionFromPoint(x, y);
      if (cp) { node = cp.offsetNode; offset = cp.offset; range = document.createRange(); range.setStart(node, offset); }
    }
    if (!range) return null;
    node = range.startContainer; offset = range.startOffset;
    if (node.nodeType !== 3) return null;
    var text = node.nodeValue;
    var L = offset; var R = offset;
    var isW = function (c) { return /[A-Za-z'-]/.test(c); };
    while (L > 0 && isW(text[L - 1])) L--;
    while (R < text.length && isW(text[R])) R++;
    var w = text.slice(L, R).replace(/^[-']+|[-']+$/g, '');
    return /^[A-Za-z]{2,}$/.test(w) ? w : null;
  }
  document.addEventListener('click', function (e) {
    var w = wordAt(e.clientX, e.clientY);
    if (!w) return;
    e.preventDefault();
    ensurePop();
    var src = document.body.getAttribute('data-source') || '';
    pop.style.display = 'block';
    $('.w', pop).textContent = '…';
    $('.ph', pop).textContent = ''; $('.t', pop).textContent = '查询中…';
    $('.src', pop).textContent = ''; $('.star', pop).style.visibility = 'hidden';
    var px = Math.max(10, Math.min(e.clientX, window.innerWidth - 340)), py = e.clientY + 14;
    if (py + 180 > window.innerHeight) py = Math.max(10, e.clientY - 190);
    pop.style.left = px + 'px'; pop.style.top = py + 'px';
    lookup(w, function (r) {
      if (!r) { $('.w', pop).textContent = w; $('.t', pop).textContent = '词典未收录（可能是专有名词）'; return; }
      var inVocab = !!getVocab()[r.word];
      $('.w', pop).textContent = r.word;
      $('.ph', pop).textContent = r.ph ? '/' + r.ph + '/' : '';
      $('.t', pop).textContent = r.t || '（无释义）';
      $('.src', pop).textContent = src ? '来源：' + src : '';
      var b = $('.star', pop);
      b.style.visibility = 'visible';
      b.textContent = inVocab ? '★ 移除生词' : '☆ 加入生词';
      b.onclick = function () {
        var now = starWord({ word: r.word, ph: r.ph, t: r.t }, src);
        b.textContent = now ? '★ 移除生词' : '☆ 加入生词';
      };
    });
  });

  /* ---------- 进度 ---------- */
  var PROG_LABELS = ['未开始', '做题中', '已核对'];
  window.cet6 = {
    cycleProgress: function (id, btn) {
      var p = lsGet(PROG_KEY, {});
      p[id] = ((p[id] || 0) + 1) % 3;
      lsSet(PROG_KEY, p);
      btn.textContent = '进度：' + PROG_LABELS[p[id]];
      btn.classList.toggle('primary', p[id] === 2);
    },
    initProgressBtn: function () {
      var b = $('#progBtn');
      if (!b) return;
      var id = document.body.getAttribute('data-id') || '';
      var p = lsGet(PROG_KEY, {});
      b.textContent = '进度：' + PROG_LABELS[p[id] || 0];
      b.classList.toggle('primary', (p[id] || 0) === 2);
      b.onclick = function () { window.cet6.cycleProgress(id, b); };
    },
    progressSummary: function (ids) {
      var p = lsGet(PROG_KEY, {}), done = 0, doing = 0;
      ids.forEach(function (i) { if (p[i] === 2) done++; else if (p[i] === 1) doing++; });
      return { total: ids.length, done: done, doing: doing };
    }
  };

  /* ---------- 播放器 ---------- */
  var audioEl = null;
  window.cet6.play = function (src, title) {
    var box = $('#player');
    if (!box) {
      box = document.createElement('div'); box.id = 'player';
      box.innerHTML = '<div class="row"><span class="title"></span><audio controls preload="none"></audio>' +
        '<select><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option>' +
        '<option value="1.5">1.5×</option><option value="2">2×</option></select>' +
        '<button class="close" title="关闭">✕</button></div>';
      document.body.appendChild(box);
      audioEl = $('audio', box);
      var sel = $('select', box);
      sel.onchange = function () { audioEl.playbackRate = parseFloat(sel.value); };
      $('.close', box).onclick = function () { audioEl.pause(); box.style.display = 'none'; };
      audioEl.addEventListener('timeupdate', function () {
        var now = Date.now();
        if (now - (audioEl._lastSave || 0) < 1500) return;
        audioEl._lastSave = now;
        var st = lsGet(AUDIO_KEY, {});
        if (audioEl.currentTime > 5) { st.current = audioEl.currentTime; lsSet(AUDIO_KEY, st); }
      });
      audioEl.addEventListener('ended', function () {
        var st = lsGet(AUDIO_KEY, {});
        if (st.src === audioEl.getAttribute('src')) { st.current = 0; lsSet(AUDIO_KEY, st); }
      });
      audioEl.addEventListener('pause', function () {
        // 手动拖到片尾未触发 ended 的兜底：接近结尾视为已听完
        if (audioEl.duration && audioEl.currentTime >= audioEl.duration - 3) {
          var st = lsGet(AUDIO_KEY, {});
          if (st.src === audioEl.getAttribute('src')) { st.current = 0; lsSet(AUDIO_KEY, st); }
        }
      });
    }
    box.style.display = 'block';
    $('.title', box).textContent = title || '';
    audioEl.onerror = function () {
      toast('音频加载失败，请检查网络后重试');
    };
    var st = lsGet(AUDIO_KEY, {});
    if (st.src === src && st.current > 5) {
      audioEl.src = src;
      audioEl.addEventListener('loadedmetadata', function once() {
        audioEl.removeEventListener('loadedmetadata', once);
        try { audioEl.currentTime = st.current; } catch (e) {}
      });
    } else {
      audioEl.src = src;
      lsSet(AUDIO_KEY, { src: src, current: 0 });
    }
    audioEl.play().catch(function () {
      toast('播放被浏览器拦截，请再点一次播放键');
    });
  };

  /* ---------- 译文开关 ---------- */
  window.cet6.initZhToggle = function () {
    var b = $('#zhBtn');
    if (!b) return;
    var off = localStorage.getItem('cet6_zh_off') === '1';
    document.body.classList.toggle('hide-zh', off);
    b.textContent = off ? '显示译文' : '隐藏译文';
    b.onclick = function () {
      var nowOff = !document.body.classList.contains('hide-zh');
      document.body.classList.toggle('hide-zh', nowOff);
      localStorage.setItem('cet6_zh_off', nowOff ? '1' : '0');
      b.textContent = nowOff ? '显示译文' : '隐藏译文';
    };
  };

  /* ---------- 生词导入导出 ---------- */
  window.cet6.exportVocab = function () {
    var v = getVocab();
    var blob = new Blob([JSON.stringify(v, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cet6-生词本-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('已导出 ' + Object.keys(v).length + ' 个生词');
  };
  window.cet6.importVocab = function (file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var inc = JSON.parse(fr.result), v = getVocab(), n = 0;
        Object.keys(inc).forEach(function (k) { if (!v[k]) { v[k] = inc[k]; n++; } });
        lsSet(VOCAB_KEY, v);
        toast('导入 ' + n + ' 个生词，即将刷新…');
        setTimeout(function () { location.reload(); }, 800);
      } catch (e) { toast('文件格式错误'); }
    };
    fr.readAsText(file);
  };
  window.cet6.removeVocab = function (w) { var v = getVocab(); delete v[w]; lsSet(VOCAB_KEY, v); };

  /* ---------- 题型标签栏 ---------- */
  window.cet6.initTabs = function () {
    var bar = $('#partTabs');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.tabbtn');
      if (!b) return;
      if (b.id === 'allBtn') {
        var on = document.body.classList.toggle('show-all');
        b.textContent = on ? '分栏模式' : '连续模式';
        return;
      }
      document.body.classList.remove('show-all');
      $('#allBtn').textContent = '连续模式';
      document.querySelectorAll('.tabbtn').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      document.querySelectorAll('section.part').forEach(function (s) { s.classList.remove('active'); });
      var sec = $('#part-' + b.getAttribute('data-part'));
      if (sec) { sec.classList.add('active'); window.scrollTo({ top: 0 }); }
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.cet6.initProgressBtn();
    window.cet6.initZhToggle();
    window.cet6.initTabs();
    // 播放按钮（生成页 data-audio 委托）
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-audio]');
      if (b) window.cet6.play(b.getAttribute('data-audio'), b.getAttribute('data-title') || '');
    });
  });
})();
