/*
 * 남은 시간 알림 판정
 * 우선순위: 시간 종료 → 점멸 → 배경색 변경 → 기본 배경
 * 화면(DOM)과 무관한 순수 함수만 둔다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VCD = Object.assign(root.VCD || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BLINK_PERIOD_MS = { slow: 2000, normal: 1500 };
  var LABELS = { none: '', color: '마무리 시간', blink: '종료 임박', end: '시간 종료' };

  /**
   * @param {object} p
   * @param {'idle'|'running'|'paused'|'finished'} p.status
   * @param {number} p.remainingSec  화면에 보이는 남은 초
   * @param {object} p.settings
   * @param {boolean} p.reducedMotion 동작 줄이기로 점멸을 쓰지 않을 때 true
   */
  function evaluate(p) {
    var s = p.settings;
    var r = {
      phase: 'none',
      color: s.baseColor,
      blink: false,       // 실제로 점멸 애니메이션을 돌릴지
      blinkColor: null,
      periodMs: 0,
      label: LABELS.none,
      fg: '#ffffff'
    };
    r.fg = textColorFor(r.color);
    if (p.status === 'idle') return r;

    if (p.status === 'finished') {
      r.phase = 'end';
      r.color = s.endColor;
      r.label = LABELS.end;
      r.fg = textColorFor(r.color);
      return r;
    }

    var sec = p.remainingSec;
    if (s.blinkAlert.enabled && sec <= s.blinkAlert.atSec) {
      r.phase = 'blink';
      r.color = s.blinkAlert.color;
      r.blinkColor = blinkTone(s.blinkAlert.color);
      r.periodMs = BLINK_PERIOD_MS[s.blinkAlert.speed] || BLINK_PERIOD_MS.slow;
      // 일시정지 중이거나 동작 줄이기면 점멸 색상으로 고정
      r.blink = p.status === 'running' && !p.reducedMotion;
      r.label = LABELS.blink;
    } else if (s.colorAlert.enabled && sec <= s.colorAlert.atSec) {
      r.phase = 'color';
      r.color = s.colorAlert.color;
      r.label = LABELS.color;
    }
    r.fg = textColorFor(r.color);
    return r;
  }

  /** 점멸 애니메이션 위상(ms). 이어서 시작해도 남은 시간에 맞는 위치에서 다시 돈다. */
  function blinkOffsetMs(blinkAtSec, remainingMs, periodMs) {
    var elapsed = blinkAtSec * 1000 - remainingMs;
    if (!(periodMs > 0) || elapsed <= 0) return 0;
    return elapsed % periodMs;
  }

  /** 설정 화면에 보여줄 안내/경고 목록 */
  function settingsNotices(s) {
    var n = { color: [], blink: [] };
    var dur = s.durationSec;
    if (s.colorAlert.enabled && s.colorAlert.atSec >= dur) {
      n.color.push('시작과 동시에 이 알림이 적용됩니다.');
    }
    if (s.blinkAlert.enabled && s.blinkAlert.atSec >= dur) {
      n.blink.push('시작과 동시에 이 알림이 적용됩니다.');
    }
    if (s.colorAlert.enabled && s.blinkAlert.enabled) {
      if (s.blinkAlert.atSec === s.colorAlert.atSec) {
        n.blink.push('배경색 변경과 시점이 같아 그 시점에 바로 점멸합니다.');
      } else if (s.blinkAlert.atSec > s.colorAlert.atSec) {
        n.blink.push('점멸 시점이 배경색 변경보다 먼저입니다. 점멸이 우선하므로 배경색 변경은 보이지 않습니다.');
      }
    }
    return n;
  }

  // ---- 색상 도우미 ----

  function parseHex(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (c) {
      var h = Math.max(0, Math.min(255, Math.round(c))).toString(16);
      return h.length < 2 ? '0' + h : h;
    }).join('');
  }

  /** 점멸 시 함께 쓰는 어두운 톤 */
  function darken(hex, factor) {
    var rgb = parseHex(hex);
    if (!rgb) return '#000000';
    var f = typeof factor === 'number' ? factor : 0.5;
    return toHex(rgb.map(function (c) { return c * f; }));
  }

  /**
   * 점멸의 어두운 톤. 글자색은 원래 색 기준으로 정하고(흰색/검정),
   * 검정 글자를 쓰는 밝은 색(노랑·주황 등)은 어두운 톤에서도 글자가 읽히도록
   * 대비 4.5:1이 유지되는 만큼만 어둡게 한다.
   */
  function blinkTone(hex) {
    if (textColorFor(hex) === '#ffffff') return darken(hex, 0.5);
    for (var f = 0.5; f < 0.96; f += 0.02) {
      var d = darken(hex, f);
      if (contrast('#000000', d) >= 4.5) return d;
    }
    return darken(hex, 0.96);
  }

  function luminance(hex) {
    var rgb = parseHex(hex) || [0, 0, 0];
    var a = rgb.map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * 주어진 배경색(들) 위에서 가장 잘 읽히는 글자색(흰색/검정)을 고른다.
   * 점멸이면 두 배경 모두에서의 최소 대비가 큰 쪽을 고른다.
   */
  function textColorFor(bgs) {
    var list = Array.isArray(bgs) ? bgs : [bgs];
    var light = '#ffffff', dark = '#000000';
    function minC(fg) {
      return Math.min.apply(null, list.map(function (bg) { return contrast(fg, bg); }));
    }
    return minC(light) >= minC(dark) ? light : dark;
  }

  return {
    evaluate: evaluate,
    blinkOffsetMs: blinkOffsetMs,
    settingsNotices: settingsNotices,
    darken: darken,
    blinkTone: blinkTone,
    contrast: contrast,
    textColorFor: textColorFor,
    parseHex: parseHex,
    BLINK_PERIOD_MS: BLINK_PERIOD_MS,
    ALERT_LABELS: LABELS
  };
});
