/*
 * 화면 제어: 타이머 로직(timer.js), 알림 판정(alerts.js), 설정 저장(settings.js)을 엮는다.
 */
(function () {
  'use strict';

  var V = window.VCD;
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var rootStyle = document.documentElement.style;

  // ---- 요소 ----
  var el = {
    time: $('time'), display: $('display'), pill: $('status-pill'),
    controls: $('controls'), quick: $('quick'), toast: $('toast'), live: $('live'),
    btnMain: $('btn-main'), btnMainLabel: $('btn-main-label'), btnReset: $('btn-reset'),
    btnFull: $('btn-full'), btnFullLabel: $('btn-full-label'), btnSettings: $('btn-settings'),
    customTime: $('custom-time'),
    confirm: $('confirm'), confirmTitle: $('confirm-title'), confirmMsg: $('confirm-msg'),
    confirmOk: $('confirm-ok'), confirmCancel: $('confirm-cancel'),
    settings: $('settings'), form: $('settings-form'),
    preview: $('preview'), previewStart: $('preview-start'), previewStop: $('preview-stop'),
    themeMeta: document.querySelector('meta[name="theme-color"]')
  };

  // ---- 상태 ----
  var store = new V.Store();
  var settings = store.loadSettings();
  var timer = new V.Countdown(settings.durationSec * 1000);
  timer.restore(store.loadTimer());

  var rmQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotionFor(s) {
    return !!(rmQuery && rmQuery.matches) && !s.blinkDespiteReducedMotion;
  }

  function persistTimer() { store.saveTimer(timer.toJSON()); }

  // ---- 언어 ----
  // 주소에 ?lang=ja 처럼 붙이면 그 언어로 열고 기억한다.
  var urlLang = '';
  try { urlLang = new URLSearchParams(location.search).get('lang') || ''; } catch (e) { /* 무시 */ }
  if (urlLang && V.LANGS.some(function (l) { return l.code === urlLang; })) store.saveLang(urlLang);
  var t = V.translator(V.detectLang(store.loadLang(), navigator.languages || [navigator.language]));
  function dur(sec) { return t.duration(sec); }
  function phaseLabel(a) { return a.labelKey ? t('ph_' + a.labelKey) : ''; }

  // ---- 알림(화면 읽기 프로그램 / 토스트) ----
  var liveTimer = 0;
  function announce(msg) {
    clearTimeout(liveTimer);
    el.live.textContent = '';
    liveTimer = setTimeout(function () { el.live.textContent = msg; }, 60);
  }

  var toastTimer = 0;
  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, ms || 4000);
    announce(msg);
  }

  // ---- 큰 숫자 크기 맞춤 ----
  function fitTime() {
    var box = el.display.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var text = el.time.textContent;
    el.time.textContent = text.replace(/\d/g, '0'); // 가장 넓은 경우 기준으로 잰다
    el.time.style.fontSize = '100px';
    var r = el.time.getBoundingClientRect();
    el.time.textContent = text;
    if (!r.width || !r.height) return;
    var scale = Math.min((box.width * 0.96) / r.width, (box.height * 0.94) / r.height);
    el.time.style.fontSize = Math.max(16, Math.floor(100 * scale)) + 'px';
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { fitTime(); }).observe(el.display);
  } else {
    window.addEventListener('resize', fitTime);
  }
  window.addEventListener('orientationchange', function () { setTimeout(fitTime, 250); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTime);

  // ---- 배경/색 적용 (바뀔 때만 DOM을 건드려 애니메이션이 겹치지 않게 한다) ----
  var visualKey = '';
  function applyVisual(a, remainingMs) {
    var key = [a.phase, a.color, a.blink, a.blinkColor, a.periodMs].join('|');
    if (key === visualKey) return;
    visualKey = key;

    rootStyle.setProperty('--bg', a.color);
    rootStyle.setProperty('--fg', a.fg);
    if (el.themeMeta) el.themeMeta.setAttribute('content', a.color);

    body.classList.remove('blinking');
    if (a.blink) {
      rootStyle.setProperty('--blink-b', a.blinkColor);
      rootStyle.setProperty('--blink-period', a.periodMs + 'ms');
      var offset = V.blinkOffsetMs(settings.blinkAlert.atSec, remainingMs, a.periodMs);
      rootStyle.setProperty('--blink-delay', (-offset) + 'ms');
      void body.offsetWidth; // 애니메이션을 새 위상에서 다시 시작
      body.classList.add('blinking');
    }
  }

  // ---- 화면 갱신 ----
  var last = { text: '', status: '', phase: '', len: 0 };
  var tickHandle = 0;

  function render() {
    if (timer.sync()) onFinished();

    var remMs = timer.remaining();
    var sec = Math.ceil(remMs / 1000);
    var text = V.formatTime(sec);
    if (text !== last.text) {
      el.time.textContent = text;
      last.text = text;
      if (text.length !== last.len) { last.len = text.length; fitTime(); }
    }

    var a = V.evaluate({
      status: timer.status, remainingSec: sec, settings: settings,
      reducedMotion: reducedMotionFor(settings)
    });
    applyVisual(a, remMs);
    updateStatusUI(a);

    if (timer.status === 'running' && a.phase !== last.phase && (a.phase === 'color' || a.phase === 'blink')) {
      announce(t('ann_phase', { label: phaseLabel(a), dur: dur(sec) }));
    }
    last.phase = a.phase;
    scheduleTick();
  }

  /** 다음 "초"가 바뀌는 순간 직후에 다시 그린다(실제 남은 시간 기준). */
  function scheduleTick() {
    clearTimeout(tickHandle);
    tickHandle = 0;
    if (timer.status !== 'running') return;
    var rem = timer.remaining();
    var delay = rem > 0 ? ((rem - 1) % 1000) + 1 + 15 : 15;
    tickHandle = setTimeout(render, delay);
  }

  function updateStatusUI(a) {
    var st = timer.status;
    if (st !== last.status) {
      body.classList.remove('st-idle', 'st-running', 'st-paused', 'st-finished');
      body.classList.add('st-' + st);
      last.status = st;
      var label = t({ idle: 'start', running: 'pause', paused: 'resume', finished: 'start' }[st]);
      el.btnMainLabel.textContent = label;
      el.btnMain.disabled = st === 'finished';
      el.btnMain.setAttribute('aria-label', t('keySpace', { label: label }));
      updateQuickChips();
    }
    var pill, ph = phaseLabel(a);
    if (st === 'idle') pill = t('st_idle') + ' · ' + dur(timer.durationMs / 1000);
    else if (st === 'finished') pill = t('ph_end');
    else if (st === 'paused') pill = t('st_paused') + (ph ? ' · ' + ph : '');
    else pill = ph || t('st_running');
    if (el.pill.textContent !== pill) el.pill.textContent = pill;
  }

  function updateQuickChips() {
    var cur = timer.durationMs / 1000;
    Array.prototype.forEach.call(el.quick.querySelectorAll('[data-min]'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.min) * 60 === cur));
    });
  }

  function onFinished() {
    persistTimer();
    announce(t('ph_end'));
    updateWakeLock();
  }

  // ---- 제어 ----
  function mainAction() {
    if (isDialogOpen()) return;
    var st = timer.status;
    if (st === 'idle') {
      if (timer.durationMs <= 0) { toast(t('toast_zero')); return; }
      timer.start();
      wakeNoticeShown = false;
      announce(t('ann_start', { dur: dur(timer.durationMs / 1000) }));
    } else if (st === 'running') {
      if (!timer.pause()) { render(); return; }
      announce(t('ann_pause', { dur: dur(Math.ceil(timer.remaining() / 1000)) }));
    } else if (st === 'paused') {
      timer.resume();
      announce(t('ann_resume'));
    } else {
      return;
    }
    persistTimer();
    visualKey = '';
    render();
    updateWakeLock();
  }

  function resetAction() {
    if (isDialogOpen()) return;
    var doReset = function () {
      timer.reset(settings.durationSec * 1000);
      persistTimer();
      visualKey = '';
      render();
      updateWakeLock();
      announce(t('ann_reset', { dur: dur(settings.durationSec) }));
    };
    if (timer.status === 'running' || timer.status === 'paused') {
      confirmDialog(t('reset_title'), t('reset_msg', { dur: dur(settings.durationSec) }), t('reset_ok'))
        .then(function (ok) { if (ok) doReset(); });
    } else {
      doReset();
    }
  }

  function setDurationFromQuick(min) {
    if (timer.status !== 'idle') return;
    settings.durationSec = min * 60;
    store.saveSettings(settings);
    timer.setDuration(settings.durationSec * 1000);
    persistTimer();
    last.status = ''; // 버튼 표시 갱신
    render();
    announce(t('ann_setDur', { dur: dur(settings.durationSec) }));
  }

  el.btnMain.addEventListener('click', mainAction);
  el.btnReset.addEventListener('click', resetAction);
  el.btnFull.addEventListener('click', togglePresent);
  el.btnSettings.addEventListener('click', function () { openSettings(); });
  el.customTime.addEventListener('click', function () { openSettings('dur-min'); });
  el.quick.addEventListener('click', function (e) {
    var b = e.target.closest('[data-min]');
    if (b) setDurationFromQuick(Number(b.dataset.min));
  });

  // ---- 확인 대화상자 ----
  function showDialog(d) {
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }
  function closeDialog(d, value) {
    if (typeof d.close === 'function') d.close(value);
    else { d.removeAttribute('open'); d.dispatchEvent(new Event('close')); }
  }
  function isDialogOpen() { return el.confirm.open || el.settings.open; }

  function confirmDialog(title, msg, okLabel) {
    if (typeof el.confirm.showModal !== 'function') {
      return Promise.resolve(window.confirm(title + '\n' + msg));
    }
    return new Promise(function (resolve) {
      el.confirmTitle.textContent = title;
      el.confirmMsg.textContent = msg;
      el.confirmOk.textContent = okLabel || t('ok');
      el.confirm.returnValue = '';
      el.confirm.addEventListener('close', function () {
        resolve(el.confirm.returnValue === 'ok');
      }, { once: true });
      showDialog(el.confirm);
      el.confirmCancel.focus();
    });
  }

  // ---- 발표 모드 / 전체화면 ----
  var presenting = false;
  var presentKind = ''; // 'fs' 실제 전체화면, 'pseudo' 브라우저 화면 안에서 크게
  var hideTimer = 0;
  var HIDE_AFTER_MS = 3000;
  var docEl = document.documentElement;

  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsSupported() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
      !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  }

  function setPresenting(on, kind) {
    presenting = on;
    presentKind = on ? kind : '';
    body.classList.toggle('presenting', on);
    el.btnFull.setAttribute('aria-pressed', String(on));
    el.btnFullLabel.textContent = t(on ? 'exitPresent' : 'fullscreen');
    pokeControls();
  }

  function enterPresent() {
    if (fsSupported()) {
      try {
        var p = docEl.requestFullscreen ? docEl.requestFullscreen({ navigationUI: 'hide' }) : docEl.webkitRequestFullscreen();
        setPresenting(true, 'fs');
        if (p && typeof p.then === 'function') {
          p.catch(function () {
            setPresenting(true, 'pseudo');
            toast(t('toast_fsFailed'));
          });
        }
        return;
      } catch (e) { /* 아래 대체 모드로 */ }
    }
    setPresenting(true, 'pseudo');
    toast(t('toast_fsUnsupported'), 5000);
  }

  function exitPresent() {
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      try {
        var p = exit.call(document);
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* 무시 */ }
    }
    setPresenting(false);
  }

  function togglePresent() { if (presenting) exitPresent(); else enterPresent(); }

  function onFsChange() {
    if (!fsElement() && presenting && presentKind === 'fs') setPresenting(false);
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  function pokeControls() {
    body.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    if (presenting) hideTimer = setTimeout(tryHideControls, HIDE_AFTER_MS);
  }
  function hasKeyboardFocusInControls() {
    var a = document.activeElement;
    if (!a || !el.controls.contains(a)) return false;
    try { return a.matches(':focus-visible'); } catch (e) { return true; }
  }
  function tryHideControls() {
    if (!presenting) return;
    if (isDialogOpen() || hasKeyboardFocusInControls()) {
      hideTimer = setTimeout(tryHideControls, HIDE_AFTER_MS);
      return;
    }
    body.classList.add('controls-hidden');
  }
  ['pointermove', 'pointerdown', 'wheel', 'touchstart'].forEach(function (t) {
    document.addEventListener(t, pokeControls, { passive: true });
  });

  // ---- 화면 꺼짐 방지 ----
  var wake = { sentinel: null, pending: false };
  var wakeNoticeShown = false;
  var wakeSupported = 'wakeLock' in navigator;

  function wakeIssue() {
    if (wakeNoticeShown) return;
    wakeNoticeShown = true;
    toast(t('toast_wake'), 6000);
  }

  function updateWakeLock() {
    var want = settings.wakeLock && timer.status === 'running' && !document.hidden;
    if (want && !wake.sentinel && !wake.pending) {
      if (!wakeSupported) { wakeIssue(); return; }
      wake.pending = true;
      navigator.wakeLock.request('screen').then(function (s) {
        wake.pending = false;
        wake.sentinel = s;
        s.addEventListener('release', function () { if (wake.sentinel === s) wake.sentinel = null; });
        // 요청하는 사이 일시정지/종료됐으면 바로 해제
        if (!(settings.wakeLock && timer.status === 'running' && !document.hidden)) updateWakeLock();
      }).catch(function () {
        wake.pending = false;
        if (!document.hidden) wakeIssue();
      });
    } else if (!want && wake.sentinel) {
      var s = wake.sentinel;
      wake.sentinel = null;
      s.release().catch(function () {});
    }
  }

  // ---- 탭 복귀 / 새로고침 복원 ----
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      visualKey = ''; // 점멸 위상을 현재 남은 시간에 다시 맞춘다
      render();
    }
    updateWakeLock();
  });
  window.addEventListener('pageshow', function () { visualKey = ''; render(); });
  window.addEventListener('focus', function () { render(); });
  if (rmQuery) {
    var onRm = function () { visualKey = ''; render(); refreshReducedMotionUI(); };
    if (rmQuery.addEventListener) rmQuery.addEventListener('change', onRm);
    else if (rmQuery.addListener) rmQuery.addListener(onRm);
  }

  // ---- 키보드 ----
  function isEditable(t) {
    if (!t || t === document.body) return false;
    var tag = t.tagName;
    return t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
  document.addEventListener('keydown', function (e) {
    pokeControls();
    if (e.defaultPrevented || e.isComposing) return;
    if (isDialogOpen()) return; // 대화상자는 자체 처리(Esc는 브라우저 기본 동작)
    if (isEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) mainAction();
    } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') {
      e.preventDefault();
      if (!e.repeat) togglePresent();
    } else if (e.key === 'Escape') {
      if (presenting) { e.preventDefault(); exitPresent(); }
    }
  });

  // ======================================================================
  // 설정
  // ======================================================================
  // [색, 색 이름 번역 키]
  var PRESETS = {
    base: [['#141518', 'c_charcoal'], ['#000000', 'c_black'], ['#0d1b2a', 'c_navy'], ['#2b2d31', 'c_darkgray'], ['#13261b', 'c_darkgreen']],
    alert: [['#d32f2f', 'c_red'], ['#b71c1c', 'c_darkred'], ['#ef6c00', 'c_orange'], ['#f9c80e', 'c_yellow'],
      ['#2e7d32', 'c_green'], ['#1565c0', 'c_blue'], ['#6a1b9a', 'c_purple']]
  };

  var f = {
    durMin: $('dur-min'), durSec: $('dur-sec'), durError: $('dur-error'), durPending: $('dur-pending'),
    colorOn: $('color-on'), colorFields: $('color-fields'), colorMin: $('color-min'), colorSec: $('color-sec'),
    colorError: $('color-error'), colorNotes: $('color-notes'),
    blinkOn: $('blink-on'), blinkFields: $('blink-fields'), blinkMin: $('blink-min'), blinkSec: $('blink-sec'),
    blinkError: $('blink-error'), blinkNotes: $('blink-notes'),
    rmBox: $('rm-box'), rmOverride: $('blink-rm-override'),
    wakeOn: $('wake-on'), wakeNote: $('wake-note'), storageNote: $('storage-note'),
    save: $('settings-save'), cancel: $('settings-cancel'), defaults: $('settings-defaults')
  };

  var draft = null;
  var pickers = {};

  // 색상 선택기: 미리 정한 색 + 직접 선택
  function buildPicker(container) {
    var field = container.dataset.field;
    var presets = PRESETS[container.dataset.presets];
    container.setAttribute('role', 'group');
    var buttons = presets.map(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = p[0];
      b.style.setProperty('--check', V.textColorFor(p[0]));
      b.dataset.color = p[0];
      b.dataset.nameKey = p[1];
      container.appendChild(b);
      return b;
    });
    var custom = document.createElement('label');
    custom.className = 'custom-color';
    var input = document.createElement('input');
    input.type = 'color';
    input.className = 'custom-color-input';
    var customText = document.createElement('span');
    customText.className = 'custom-color-text';
    custom.appendChild(input);
    custom.appendChild(customText);
    container.appendChild(custom);

    var picker = {
      value: '#000000',
      set: function (hex) {
        hex = String(hex).toLowerCase();
        picker.value = hex;
        var matched = false;
        buttons.forEach(function (b) {
          var on = b.dataset.color === hex;
          matched = matched || on;
          b.setAttribute('aria-pressed', String(on));
        });
        custom.classList.toggle('active', !matched);
        input.value = hex;
      }
    };
    container.addEventListener('click', function (e) {
      var b = e.target.closest('.swatch');
      if (!b) return;
      picker.set(b.dataset.color);
      onFormChange();
    });
    input.addEventListener('input', function () { picker.set(input.value); onFormChange(); });
    input.addEventListener('change', function () { picker.set(input.value); onFormChange(); });
    pickers[field] = picker;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.color-picker'), buildPicker);

  function splitMinSec(sec) { return { m: Math.floor(sec / 60), s: sec % 60 }; }

  function fillForm(s) {
    var d = splitMinSec(s.durationSec), c = splitMinSec(s.colorAlert.atSec), b = splitMinSec(s.blinkAlert.atSec);
    f.durMin.value = d.m; f.durSec.value = d.s;
    f.colorOn.checked = s.colorAlert.enabled;
    f.colorMin.value = c.m; f.colorSec.value = c.s;
    f.blinkOn.checked = s.blinkAlert.enabled;
    f.blinkMin.value = b.m; f.blinkSec.value = b.s;
    var speed = el.form.querySelector('input[name="blink-speed"][value="' + s.blinkAlert.speed + '"]');
    if (speed) speed.checked = true;
    f.rmOverride.checked = s.blinkDespiteReducedMotion;
    f.wakeOn.checked = s.wakeLock;
    pickers.baseColor.set(s.baseColor);
    pickers['colorAlert.color'].set(s.colorAlert.color);
    pickers['blinkAlert.color'].set(s.blinkAlert.color);
    pickers.endColor.set(s.endColor);
    onFormChange();
  }

  /** 폼 → 설정 초안 + 오류 */
  function readForm() {
    var d = JSON.parse(JSON.stringify(settings));
    var errors = {};
    var dur = V.parseMinSec(f.durMin.value, f.durSec.value);
    if (dur.ok) d.durationSec = dur.sec; else errors.dur = dur.error;

    d.colorAlert.enabled = f.colorOn.checked;
    var c = V.parseMinSec(f.colorMin.value, f.colorSec.value, { alert: true });
    if (c.ok) d.colorAlert.atSec = c.sec; else if (d.colorAlert.enabled) errors.color = c.error;
    d.colorAlert.color = pickers['colorAlert.color'].value;

    d.blinkAlert.enabled = f.blinkOn.checked;
    var b = V.parseMinSec(f.blinkMin.value, f.blinkSec.value, { alert: true });
    if (b.ok) d.blinkAlert.atSec = b.sec; else if (d.blinkAlert.enabled) errors.blink = b.error;
    d.blinkAlert.color = pickers['blinkAlert.color'].value;
    var speed = el.form.querySelector('input[name="blink-speed"]:checked');
    d.blinkAlert.speed = speed ? speed.value : 'slow';
    d.blinkDespiteReducedMotion = f.rmOverride.checked;

    d.baseColor = pickers.baseColor.value;
    d.endColor = pickers.endColor.value;
    d.wakeLock = f.wakeOn.checked;
    return { draft: d, errors: errors };
  }

  function showError(p, inputs, code) {
    var msg = code ? t('err_' + code, { max: V.MAX_MINUTES }) : '';
    p.hidden = !msg;
    p.textContent = msg || '';
    inputs.forEach(function (i) {
      if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    });
  }

  function fillNotes(ul, list) {
    ul.innerHTML = '';
    list.forEach(function (code) {
      var li = document.createElement('li');
      li.textContent = t('note_' + code);
      ul.appendChild(li);
    });
  }

  var lastErrors = {};
  function onFormChange() {
    var r = readForm();
    draft = r.draft;
    lastErrors = r.errors;
    f.colorFields.disabled = !draft.colorAlert.enabled;
    f.blinkFields.disabled = !draft.blinkAlert.enabled;
    showError(f.durError, [f.durMin, f.durSec], r.errors.dur);
    showError(f.colorError, [f.colorMin, f.colorSec], r.errors.color);
    showError(f.blinkError, [f.blinkMin, f.blinkSec], r.errors.blink);

    var notes = r.errors.dur ? { color: [], blink: [] } : V.settingsNotices(draft);
    if (r.errors.color) notes.color = [];
    if (r.errors.blink || r.errors.color) notes.blink = notes.blink.filter(function (code) { return code === 'startNow'; });
    if (r.errors.blink) notes.blink = [];
    fillNotes(f.colorNotes, notes.color);
    fillNotes(f.blinkNotes, notes.blink);

    f.durPending.hidden = !(timer.status !== 'idle' && !r.errors.dur && draft.durationSec * 1000 !== timer.durationMs);

    Array.prototype.forEach.call(el.form.querySelectorAll('[data-set-min]'), function (bt) {
      bt.setAttribute('aria-pressed', String(!r.errors.dur && Number(bt.dataset.setMin) * 60 === draft.durationSec));
    });
  }

  function refreshReducedMotionUI() {
    f.rmBox.hidden = !(rmQuery && rmQuery.matches);
  }

  function openSettings(focusId) {
    if (isDialogOpen()) return;
    if (timer.status === 'running') {
      confirmDialog(t('running_title'), t('running_msg'), t('running_ok')).then(function (ok) {
        if (!ok) return;
        if (timer.status === 'running') mainAction(); // 일시정지
        reallyOpenSettings(focusId);
      });
      return;
    }
    reallyOpenSettings(focusId);
  }

  function reallyOpenSettings(focusId) {
    fillForm(settings);
    refreshReducedMotionUI();
    f.storageNote.hidden = store.persistent;
    showDialog(el.settings);
    var target = focusId ? $(focusId) : null;
    el.settings.querySelector('.settings-body').scrollTop = 0;
    if (target) { target.focus(); if (target.select) target.select(); }
  }

  function saveSettings() {
    var r = readForm();
    var firstBad = r.errors.dur ? f.durMin : r.errors.color ? f.colorMin : r.errors.blink ? f.blinkMin : null;
    if (firstBad) {
      onFormChange();
      firstBad.focus();
      toast(t('toast_checkInputs'));
      return;
    }
    settings = V.normalizeSettings(r.draft);
    store.saveSettings(settings);
    if (timer.status === 'idle') {
      timer.setDuration(settings.durationSec * 1000);
      persistTimer();
    }
    closeDialog(el.settings);
    visualKey = '';
    last.status = '';
    render();
    updateWakeLock();
    toast(t(store.persistent ? 'toast_saved' : 'toast_savedLocal'), 2500);
  }

  el.form.addEventListener('input', function (e) {
    if (e.target.type !== 'color') onFormChange();
  });
  el.form.addEventListener('change', function (e) {
    if (e.target.type !== 'color') onFormChange();
  });
  el.form.addEventListener('submit', function (e) { e.preventDefault(); saveSettings(); });
  f.cancel.addEventListener('click', function () { closeDialog(el.settings); });
  f.defaults.addEventListener('click', function () {
    fillForm(V.defaultSettings());
    toast(t('toast_defaults'), 3000);
  });
  el.form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set-min]');
    if (!b) return;
    f.durMin.value = b.dataset.setMin;
    f.durSec.value = 0;
    onFormChange();
  });
  // Esc: 미리보기 중이면 미리보기만 닫고, 아니면 취소(저장 안 함)
  el.settings.addEventListener('cancel', function (e) {
    if (previewState.active) { e.preventDefault(); stopPreview(); }
  });
  el.settings.addEventListener('close', function () {
    stopPreview(true);
    el.btnSettings.focus();
    pokeControls();
  });
  // 입력창에서 Enter를 눌러도 바로 저장되지 않게(모바일 키보드 '완료' 대비)
  el.form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.preventDefault();
      e.target.blur();
    }
  });

  // ---- 알림 미리보기 (실제 타이머와 완전히 분리) ----
  var previewState = { active: false, timers: [] };
  var pv = {
    bg: el.preview.querySelector('.preview-bg'),
    pill: el.preview.querySelector('.preview-pill'),
    time: el.preview.querySelector('.preview-time'),
    step: el.preview.querySelector('.preview-step')
  };

  function startPreview() {
    var d = readForm().draft;
    var rm = reducedMotionFor(d);
    var steps = [{ pill: t('st_running'), name: t('pv_base'), color: d.baseColor, time: V.formatTime(Math.min(d.durationSec, 5999)), ms: 1500 }];
    if (d.colorAlert.enabled) {
      steps.push({ pill: t('ph_color'), name: t('pv_color', { dur: dur(d.colorAlert.atSec) }),
        color: d.colorAlert.color, time: V.formatTime(d.colorAlert.atSec), ms: 2500 });
    }
    if (d.blinkAlert.enabled) {
      var period = V.BLINK_PERIOD_MS[d.blinkAlert.speed];
      steps.push({ pill: t('ph_blink'), name: t('pv_blink', { dur: dur(d.blinkAlert.atSec) }) + (rm ? t('pv_rm') : ''),
        color: d.blinkAlert.color, dark: V.blinkTone(d.blinkAlert.color), blink: !rm, period: period,
        time: V.formatTime(d.blinkAlert.atSec), ms: Math.max(period * 3, 4000) });
    }
    steps.push({ pill: t('ph_end'), name: t('pv_end'), color: d.endColor, time: '00:00', ms: 2500 });

    stopPreview(true);
    previewState.active = true;
    el.preview.hidden = false;
    el.previewStop.focus();
    var at = 0;
    steps.forEach(function (st, i) {
      previewState.timers.push(setTimeout(function () { showPreviewStep(st, i, steps.length); }, at));
      at += st.ms;
    });
    previewState.timers.push(setTimeout(function () { stopPreview(); }, at));
  }

  function showPreviewStep(st, i, n) {
    var s = el.preview.style;
    s.setProperty('--pv-bg', st.color);
    s.setProperty('--pv-fg', V.textColorFor(st.color));
    el.preview.classList.remove('blinking');
    if (st.blink) {
      s.setProperty('--pv-dark', st.dark);
      s.setProperty('--pv-period', st.period + 'ms');
      void el.preview.offsetWidth;
      el.preview.classList.add('blinking');
    }
    pv.pill.textContent = t('previewPrefix') + ' · ' + st.pill;
    pv.time.textContent = st.time;
    pv.step.textContent = (i + 1) + ' / ' + n + ' · ' + st.name;
  }

  function stopPreview(silent) {
    previewState.timers.forEach(clearTimeout);
    previewState.timers = [];
    var was = previewState.active;
    previewState.active = false;
    el.preview.classList.remove('blinking');
    el.preview.hidden = true;
    if (was && !silent) el.previewStart.focus();
  }

  el.previewStart.addEventListener('click', startPreview);
  el.previewStop.addEventListener('click', function () { stopPreview(); });

  // ---- 언어 적용 (처음 열 때, 언어를 바꿀 때) ----
  var langSelect = $('lang-select');
  V.LANGS.forEach(function (l) {
    var o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.name;
    o.lang = l.code;
    langSelect.appendChild(o);
  });

  function applyLanguage() {
    var lang = t.lang;
    document.documentElement.lang = lang;
    document.title = t('appTitle');
    var meta = function (sel, v) { var m = document.querySelector(sel); if (m) m.setAttribute('content', v); };
    meta('meta[name="description"]', t('appDesc'));
    meta('meta[name="apple-mobile-web-app-title"]', t('appShort'));
    // 홈 화면 앱 이름도 언어에 맞춘다(한국어는 기본 매니페스트)
    var man = document.querySelector('link[rel="manifest"]');
    if (man) man.setAttribute('href', lang === 'ko' ? 'manifest.webmanifest' : 'manifest-' + lang + '.webmanifest');

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-attr]'), function (n) {
      n.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var kv = pair.split(':');
        if (kv.length === 2) n.setAttribute(kv[0].trim(), t(kv[1].trim()));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-min], [data-set-min]'), function (b) {
      b.textContent = t('chipMin', { n: b.getAttribute('data-min') || b.getAttribute('data-set-min') });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (b) {
      var name = t(b.dataset.nameKey);
      b.setAttribute('aria-label', name);
      b.title = name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.custom-color-input'), function (i) {
      i.setAttribute('aria-label', t('customColorAria'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.custom-color-text'), function (s) {
      s.textContent = t('customColor');
    });
    f.wakeNote.textContent = t(wakeSupported ? 'wake_supported' : 'wake_unsupported');
    langSelect.value = lang;

    el.btnFullLabel.textContent = t(presenting ? 'exitPresent' : 'fullscreen');
    last.status = '';   // 버튼·상태 문구를 새 언어로 다시 그린다
    render();
    fitTime();
    if (el.settings.open) onFormChange(); // 오류·안내 문구도 새 언어로
  }

  langSelect.addEventListener('change', function () {
    t = V.translator(langSelect.value);
    store.saveLang(t.lang);
    applyLanguage();
  });

  // ---- 시작 ----
  applyLanguage();
  updateWakeLock();
  if (timer.status === 'running') announce(t('ann_restored'));

  // ---- 서비스 워커 (HTTPS 또는 localhost에서만) ----
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 기능만 빠진다 */ });
    });
  }
})();
