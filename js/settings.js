/*
 * 설정과 타이머 상태 저장
 * - 브라우저 저장소(localStorage)를 쓰되, 쓸 수 없으면 메모리에만 보관한다.
 * - 저장된 값은 항상 검증·보정한 뒤 사용한다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VCD = Object.assign(root.VCD || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SETTINGS_KEY = 'visual-countdown.settings.v1';
  var TIMER_KEY = 'visual-countdown.timer.v1';
  var MAX_DURATION_SEC = 99 * 3600 + 59 * 60 + 59; // 99:59:59
  var MAX_MINUTES = 5999;

  var DEFAULTS = {
    durationSec: 20 * 60,
    baseColor: '#141518',
    colorAlert: { enabled: true, atSec: 5 * 60, color: '#d32f2f' },
    blinkAlert: { enabled: true, atSec: 3 * 60, color: '#d32f2f', speed: 'slow' },
    endColor: '#b71c1c',
    wakeLock: true,
    blinkDespiteReducedMotion: false
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults() { return clone(DEFAULTS); }

  function isHex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }

  function intIn(v, min, max) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= min && v <= max;
  }

  /** 알 수 없는 값이 섞인 객체를 안전한 설정 객체로 만든다. */
  function normalize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    var out = defaults();
    if (intIn(raw.durationSec, 1, MAX_DURATION_SEC)) out.durationSec = raw.durationSec;
    if (isHex(raw.baseColor)) out.baseColor = raw.baseColor.toLowerCase();
    if (isHex(raw.endColor)) out.endColor = raw.endColor.toLowerCase();
    if (typeof raw.wakeLock === 'boolean') out.wakeLock = raw.wakeLock;
    if (typeof raw.blinkDespiteReducedMotion === 'boolean') {
      out.blinkDespiteReducedMotion = raw.blinkDespiteReducedMotion;
    }
    ['colorAlert', 'blinkAlert'].forEach(function (k) {
      var r = raw[k];
      if (!r || typeof r !== 'object') return;
      if (typeof r.enabled === 'boolean') out[k].enabled = r.enabled;
      if (intIn(r.atSec, 1, MAX_DURATION_SEC)) out[k].atSec = r.atSec;
      if (isHex(r.color)) out[k].color = r.color.toLowerCase();
    });
    if (raw.blinkAlert && (raw.blinkAlert.speed === 'slow' || raw.blinkAlert.speed === 'normal')) {
      out.blinkAlert.speed = raw.blinkAlert.speed;
    }
    return out;
  }

  /**
   * 분·초 입력값을 검사한다.
   * @returns {{ok:true, sec:number}|{ok:false, error:string}}
   */
  function parseMinSec(minText, secText, opts) {
    opts = opts || {};
    var mt = String(minText == null ? '' : minText).trim();
    var st = String(secText == null ? '' : secText).trim();
    if (mt === '' && st === '') return { ok: false, error: '시간을 입력해 주세요.' };
    if (mt === '') mt = '0';
    if (st === '') st = '0';
    if (!/^\d+$/.test(mt) || !/^\d+$/.test(st)) {
      return { ok: false, error: '0 이상의 정수만 입력할 수 있습니다.' };
    }
    var m = parseInt(mt, 10), s = parseInt(st, 10);
    if (s > 59) return { ok: false, error: '초는 0~59 사이로 입력해 주세요.' };
    if (m > MAX_MINUTES) return { ok: false, error: '분은 ' + MAX_MINUTES + ' 이하로 입력해 주세요.' };
    var sec = m * 60 + s;
    if (sec <= 0) {
      return { ok: false, error: opts.zeroError || '0초보다 큰 시간을 입력해 주세요.' };
    }
    return { ok: true, sec: sec };
  }

  // ---- 저장소 ----

  function probeStorage() {
    try {
      var ls = (typeof window !== 'undefined' && window.localStorage) || null;
      if (!ls) return null;
      var k = '__vcd_probe__';
      ls.setItem(k, '1');
      ls.removeItem(k);
      return ls;
    } catch (e) {
      return null;
    }
  }

  /** localStorage를 감싸고, 못 쓰면 메모리에만 저장한다. */
  function Store(backend) {
    this.backend = backend === undefined ? probeStorage() : backend;
    this.memory = {};
    this.persistent = !!this.backend;
  }

  Store.prototype.get = function (key) {
    var text = null;
    if (this.backend) {
      try { text = this.backend.getItem(key); } catch (e) { this.persistent = false; }
    }
    if (text == null && Object.prototype.hasOwnProperty.call(this.memory, key)) text = this.memory[key];
    if (text == null) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  };

  Store.prototype.set = function (key, value) {
    var text = JSON.stringify(value);
    this.memory[key] = text;
    if (this.backend) {
      try { this.backend.setItem(key, text); } catch (e) { this.persistent = false; }
    }
  };

  Store.prototype.loadSettings = function () { return normalize(this.get(SETTINGS_KEY)); };
  Store.prototype.saveSettings = function (s) { this.set(SETTINGS_KEY, normalize(s)); };
  Store.prototype.loadTimer = function () { return this.get(TIMER_KEY); };
  Store.prototype.saveTimer = function (state) { this.set(TIMER_KEY, state); };

  return {
    DEFAULT_SETTINGS: DEFAULTS,
    MAX_MINUTES: MAX_MINUTES,
    defaultSettings: defaults,
    normalizeSettings: normalize,
    parseMinSec: parseMinSec,
    Store: Store
  };
});
