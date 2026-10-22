/*
 * 카운트다운 로직
 * - 남은 시간은 "종료 예정 시각 - 현재 시각"으로 계산한다(틱 횟수를 세지 않음).
 * - 상태: idle(대기) / running(실행 중) / paused(일시정지) / finished(시간 종료)
 * - 현재 시각은 now()로 주입받아 테스트할 수 있게 했다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VCD = Object.assign(root.VCD || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['idle', 'running', 'paused', 'finished'];

  function Countdown(durationMs, now) {
    this.now = now || function () { return Date.now(); };
    this.durationMs = Math.max(0, Math.round(durationMs));
    this.status = 'idle';
    this.endAt = 0;                 // running일 때만 의미가 있다
    this.remainingMs = this.durationMs; // idle / paused / finished일 때의 남은 시간
  }

  Countdown.prototype.remaining = function () {
    if (this.status === 'running') return Math.max(0, this.endAt - this.now());
    return this.remainingMs;
  };

  /** 화면에 보여줄 남은 초(올림). 20초 타이머는 시작 직후 20, 끝나면 0. */
  Countdown.prototype.remainingSec = function () {
    return Math.ceil(this.remaining() / 1000);
  };

  /** 실행 중 종료 시각이 지났으면 finished로 바꾼다. 상태가 바뀌었으면 true. */
  Countdown.prototype.sync = function () {
    if (this.status === 'running' && this.endAt - this.now() <= 0) {
      this.status = 'finished';
      this.remainingMs = 0;
      this.endAt = 0;
      return true;
    }
    return false;
  };

  Countdown.prototype.start = function () {
    if (this.status !== 'idle' || this.durationMs <= 0) return false;
    this.remainingMs = this.durationMs;
    this.endAt = this.now() + this.durationMs;
    this.status = 'running';
    return true;
  };

  Countdown.prototype.pause = function () {
    if (this.status !== 'running') return false;
    if (this.sync()) return false;
    this.remainingMs = Math.max(0, this.endAt - this.now());
    this.endAt = 0;
    this.status = 'paused';
    return true;
  };

  Countdown.prototype.resume = function () {
    if (this.status !== 'paused') return false;
    if (this.remainingMs <= 0) {
      this.status = 'finished';
      return true;
    }
    this.endAt = this.now() + this.remainingMs;
    this.status = 'running';
    return true;
  };

  /** 대기 상태로 돌아간다. durationMs를 주면 그 시간으로 다시 설정한다. */
  Countdown.prototype.reset = function (durationMs) {
    if (typeof durationMs === 'number') this.durationMs = Math.max(0, Math.round(durationMs));
    this.status = 'idle';
    this.endAt = 0;
    this.remainingMs = this.durationMs;
  };

  /** 대기 상태에서만 시간을 바꾼다. */
  Countdown.prototype.setDuration = function (durationMs) {
    if (this.status !== 'idle') return false;
    this.reset(durationMs);
    return true;
  };

  Countdown.prototype.toJSON = function () {
    return {
      v: 1,
      status: this.status,
      durationMs: this.durationMs,
      endAt: this.endAt,
      remainingMs: this.remainingMs
    };
  };

  /** 저장된 상태를 복원한다. 잘못된 값이면 대기 상태로 둔다. */
  Countdown.prototype.restore = function (data) {
    if (!data || data.v !== 1 || STATUSES.indexOf(data.status) < 0) return false;
    var dur = Number(data.durationMs);
    if (!isFinite(dur) || dur <= 0) return false;
    this.durationMs = Math.round(dur);
    if (data.status === 'running') {
      var endAt = Number(data.endAt);
      if (!isFinite(endAt) || endAt <= 0) return false;
      this.status = 'running';
      this.endAt = endAt;
      this.remainingMs = this.durationMs;
      this.sync(); // 그사이 끝났으면 바로 종료 상태
    } else if (data.status === 'paused') {
      var rem = Number(data.remainingMs);
      if (!isFinite(rem) || rem < 0) return false;
      this.status = rem > 0 ? 'paused' : 'finished';
      this.endAt = 0;
      this.remainingMs = Math.min(Math.round(rem), this.durationMs);
    } else if (data.status === 'finished') {
      this.status = 'finished';
      this.endAt = 0;
      this.remainingMs = 0;
    } else {
      this.reset();
    }
    return true;
  };

  /** 초 → 표시 문자열. 1시간 미만 MM:SS, 1시간 이상 HH:MM:SS */
  function formatTime(totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return h > 0 ? p(h) + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
  }

  /** 초 → "20분", "1시간 5분 30초" 같은 읽기용 문자열 */
  function describeDuration(totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var parts = [];
    if (h) parts.push(h + '시간');
    if (m) parts.push(m + '분');
    if (s || !parts.length) parts.push(s + '초');
    return parts.join(' ');
  }

  return { Countdown: Countdown, formatTime: formatTime, describeDuration: describeDuration };
});
