// 실행: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { Countdown, formatTime } = require('../js/timer.js');
const { evaluate, settingsNotices, blinkOffsetMs, textColorFor, contrast, blinkTone } = require('../js/alerts.js');
const { defaultSettings, normalizeSettings, parseMinSec, Store } = require('../js/settings.js');
const { LANGS, I18N_DICT, detectLang, translator } = require('../js/i18n.js');

function clock(start = 1_000_000) {
  const c = { t: start, now: () => c.t, add: (ms) => { c.t += ms; } };
  return c;
}

// 테스트용 설정: 20초 카운트다운, 10초에 배경색 변경, 5초에 점멸
function quick(overrides = {}) {
  const s = defaultSettings();
  s.durationSec = 20;
  s.colorAlert.atSec = 10;
  s.blinkAlert.atSec = 5;
  return Object.assign(s, overrides);
}

function phaseAt(s, sec, status = 'running', rm = false) {
  return evaluate({ status, remainingSec: sec, settings: s, reducedMotion: rm });
}

test('시간 표시 형식: 1시간 미만 MM:SS, 이상 HH:MM:SS', () => {
  assert.equal(formatTime(1200), '20:00');
  assert.equal(formatTime(59), '00:59');
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(3600), '01:00:00');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(-5), '00:00');
});

test('기본 카운트다운: 종료 예정 시각 기준으로 계산하고 0초에서 멈춘다', () => {
  const c = clock();
  const t = new Countdown(20_000, c.now);
  assert.equal(t.remainingSec(), 20);
  t.start();
  c.add(300);
  assert.equal(t.remainingSec(), 20); // 올림 표시
  c.add(700);
  assert.equal(t.remainingSec(), 19);
  c.add(18_999);
  assert.equal(t.remainingSec(), 1);
  assert.equal(t.sync(), false);
  c.add(1);
  assert.equal(t.sync(), true);
  assert.equal(t.status, 'finished');
  c.add(5000);
  assert.equal(t.remaining(), 0);
});

test('setInterval 지연과 무관: 한참 뒤에 확인해도 정확하다', () => {
  const c = clock();
  const t = new Countdown(20 * 60_000, c.now);
  t.start();
  c.add(7 * 60_000 + 123);
  assert.equal(t.remaining(), 13 * 60_000 - 123);
});

test('일시정지·이어서 시작: 남은 시간을 정확히 보존', () => {
  const c = clock();
  const t = new Countdown(20_000, c.now);
  t.start();
  c.add(6_400);
  t.pause();
  assert.equal(t.remaining(), 13_600);
  c.add(60_000); // 일시정지 중엔 줄지 않음
  assert.equal(t.remaining(), 13_600);
  t.resume();
  c.add(600);
  assert.equal(t.remaining(), 13_000);
});

test('중복 시작 방지와 잘못된 시간', () => {
  const c = clock();
  const t = new Countdown(0, c.now);
  assert.equal(t.start(), false);
  t.reset(5000);
  assert.equal(t.start(), true);
  assert.equal(t.start(), false);
  assert.equal(t.resume(), false);
});

test('초기화: 최초 설정 시간·대기 상태로', () => {
  const c = clock();
  const t = new Countdown(20_000, c.now);
  t.start(); c.add(5000); t.pause();
  t.reset(20_000);
  assert.equal(t.status, 'idle');
  assert.equal(t.remaining(), 20_000);
});

test('새로고침 복원: 실행 중/일시정지/이미 끝난 경우', () => {
  const c = clock();
  const a = new Countdown(20_000, c.now);
  a.start(); c.add(4000);
  const saved = JSON.parse(JSON.stringify(a.toJSON()));

  c.add(3000);
  const b = new Countdown(1, c.now);
  assert.ok(b.restore(saved));
  assert.equal(b.status, 'running');
  assert.equal(b.remaining(), 13_000);

  c.add(60_000);
  const d = new Countdown(1, c.now);
  d.restore(saved);
  assert.equal(d.status, 'finished'); // 돌아왔을 때 이미 끝났으면 바로 종료

  a.pause();
  const e = new Countdown(1, c.now);
  e.restore(JSON.parse(JSON.stringify(a.toJSON())));
  assert.equal(e.status, 'finished'); // a도 그사이 끝나서 pause 실패 → 저장 상태가 running

  const f = new Countdown(20_000, c.now);
  f.start(); c.add(2500); f.pause();
  const g = new Countdown(1, c.now);
  g.restore(JSON.parse(JSON.stringify(f.toJSON())));
  assert.equal(g.status, 'paused');
  assert.equal(g.remaining(), 17_500);

  const h = new Countdown(9000, c.now);
  assert.equal(h.restore({ garbage: true }), false);
  assert.equal(h.status, 'idle');
});

test('예시 1 — 단계별: 10초 배경색 → 5초 점멸 → 종료', () => {
  const s = quick();
  assert.equal(phaseAt(s, 20).phase, 'none');
  assert.equal(phaseAt(s, 11).phase, 'none');
  assert.equal(phaseAt(s, 10).phase, 'color');
  assert.equal(phaseAt(s, 10).color, s.colorAlert.color);
  assert.equal(phaseAt(s, 6).phase, 'color');
  const b = phaseAt(s, 5);
  assert.equal(b.phase, 'blink');
  assert.equal(b.blink, true);
  assert.equal(b.labelKey, 'blink');
  assert.equal(phaseAt(s, 0, 'finished').phase, 'end');
  assert.equal(phaseAt(s, 0, 'finished').blink, false);
});

test('예시 2 — 같은 시점이면 바로 점멸', () => {
  const s = quick();
  s.colorAlert.atSec = 5; s.blinkAlert.atSec = 5;
  assert.equal(phaseAt(s, 6).phase, 'none');
  assert.equal(phaseAt(s, 5).phase, 'blink');
  assert.ok(settingsNotices(s).blink.includes('sameTime'));
});

test('예시 3 — 배경색 변경만', () => {
  const s = quick();
  s.blinkAlert.enabled = false;
  assert.equal(phaseAt(s, 10).phase, 'color');
  assert.equal(phaseAt(s, 1).phase, 'color');
});

test('예시 4 — 점멸만', () => {
  const s = quick();
  s.colorAlert.enabled = false;
  s.blinkAlert.color = '#1565c0';
  assert.equal(phaseAt(s, 10).phase, 'none');
  const b = phaseAt(s, 5);
  assert.equal(b.phase, 'blink');
  assert.equal(b.color, '#1565c0');
});

test('예시 5 — 알림 없음', () => {
  const s = quick();
  s.colorAlert.enabled = false; s.blinkAlert.enabled = false;
  for (const sec of [20, 10, 5, 1]) {
    const a = phaseAt(s, sec);
    assert.equal(a.phase, 'none');
    assert.equal(a.color, s.baseColor);
  }
});

test('일시정지 중 점멸은 멈추고 점멸 색상으로 고정, 대기는 기본 배경', () => {
  const s = quick();
  const p = phaseAt(s, 3, 'paused');
  assert.equal(p.phase, 'blink');
  assert.equal(p.blink, false);
  assert.equal(p.color, s.blinkAlert.color);
  assert.equal(phaseAt(s, 3, 'idle').phase, 'none');
});

test('동작 줄이기: 점멸 대신 고정 배경 + 문구', () => {
  const s = quick();
  const a = phaseAt(s, 3, 'running', true);
  assert.equal(a.phase, 'blink');
  assert.equal(a.blink, false);
  assert.equal(a.labelKey, 'blink');
});

test('점멸 속도: 느리게 2초, 보통 1.5초', () => {
  const s = quick();
  assert.equal(phaseAt(s, 3).periodMs, 2000);
  s.blinkAlert.speed = 'normal';
  assert.equal(phaseAt(s, 3).periodMs, 1500);
});

test('설정 안내: 점멸이 먼저인 경우, 전체 시간보다 큰 경우', () => {
  const s = quick();
  s.colorAlert.atSec = 5; s.blinkAlert.atSec = 8;
  assert.ok(settingsNotices(s).blink.includes('blinkFirst'));
  assert.equal(phaseAt(s, 8).phase, 'blink');
  s.colorAlert.atSec = 30;
  assert.ok(settingsNotices(s).color.includes('startNow'));
  assert.equal(phaseAt(s, 20).phase, 'color');
});

test('점멸 위상: 이어서 시작해도 남은 시간에 맞춤', () => {
  assert.equal(blinkOffsetMs(5, 5000, 2000), 0);
  assert.equal(blinkOffsetMs(5, 4000, 2000), 1000);
  assert.equal(blinkOffsetMs(5, 2500, 2000), 500);
  assert.equal(blinkOffsetMs(5, 6000, 2000), 0);
});

test('글자색 대비: 어떤 배경이든 4.5:1 이상 확보 (기본 프리셋)', () => {
  const colors = ['#141518', '#000000', '#d32f2f', '#b71c1c', '#ef6c00', '#f9c80e', '#2e7d32', '#1565c0', '#6a1b9a'];
  for (const c of colors) {
    const fg = textColorFor(c);
    assert.ok(contrast(fg, c) >= 4.5, `${c} → ${fg} ${contrast(fg, c).toFixed(2)}`);
    const dark = blinkTone(c);
    assert.ok(contrast(fg, dark) >= 4.5, `blink ${c} → ${dark}`);
    if (c !== "#000000") assert.notEqual(dark, c);
  }
});

test('입력 검증: 0초·음수·소수·문자·초 60 이상은 거부', () => {
  assert.deepEqual(parseMinSec('20', '0'), { ok: true, sec: 1200 });
  assert.deepEqual(parseMinSec('', '20'), { ok: true, sec: 20 });
  assert.equal(parseMinSec('0', '0').error, 'zero');
  assert.equal(parseMinSec('0', '0', { alert: true }).error, 'alertZero');
  assert.equal(parseMinSec('-1', '0').ok, false);
  assert.equal(parseMinSec('1.5', '0').ok, false);
  assert.equal(parseMinSec('abc', '0').error, 'intOnly');
  assert.equal(parseMinSec('1', '60').error, 'secRange');
  assert.equal(parseMinSec('6000', '0').error, 'minMax');
  assert.equal(parseMinSec('', '').error, 'required');
});

test('설정 정규화: 깨진 값은 기본값으로', () => {
  const n = normalizeSettings({ durationSec: -3, baseColor: 'red', blinkAlert: { speed: 'fast', atSec: 0 } });
  const d = defaultSettings();
  assert.equal(n.durationSec, d.durationSec);
  assert.equal(n.baseColor, d.baseColor);
  assert.equal(n.blinkAlert.speed, 'slow');
  assert.equal(n.blinkAlert.atSec, 180);
  assert.equal(d.colorAlert.atSec, 300);
  assert.equal(d.colorAlert.enabled && d.blinkAlert.enabled, true);
});

test('저장소를 쓸 수 없어도 메모리로 동작', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const st = new Store(broken);
  const s = quick();
  st.saveSettings(s);
  assert.equal(st.loadSettings().durationSec, 20);
  assert.equal(st.persistent, false);
  const none = new Store(null);
  assert.equal(none.loadSettings().durationSec, 1200);
});

// ---- 다국어 ----

test('다국어: 4개 언어 모두 같은 키를 가진다', () => {
  assert.deepEqual(LANGS.map((l) => l.code), ['ko', 'ja', 'en', 'vi']);
  const keys = Object.keys(I18N_DICT.ko).sort();
  for (const { code } of LANGS) {
    assert.deepEqual(Object.keys(I18N_DICT[code]).sort(), keys, `${code} 키 불일치`);
  }
});

test('다국어: 화면이 쓰는 코드(알림·오류·안내·색)가 모두 번역되어 있다', () => {
  const codes = [
    ...['color', 'blink', 'end'].map((c) => 'ph_' + c),
    ...['required', 'intOnly', 'secRange', 'minMax', 'zero', 'alertZero'].map((c) => 'err_' + c),
    ...['startNow', 'sameTime', 'blinkFirst'].map((c) => 'note_' + c)
  ];
  for (const { code } of LANGS) {
    const t = translator(code);
    for (const k of codes) assert.notEqual(t(k), k, `${code}.${k}`);
  }
});

test('다국어: 언어 고르기 (저장값 → 브라우저 언어 → 영어)', () => {
  assert.equal(detectLang('ja', ['ko-KR']), 'ja');
  assert.equal(detectLang('', ['vi-VN', 'en']), 'vi');
  assert.equal(detectLang('', ['zh-CN', 'ko']), 'ko');
  assert.equal(detectLang('xx', ['fr-FR']), 'en');
  assert.equal(detectLang('', []), 'en');
});

test('다국어: 시간 읽기와 문구 채우기', () => {
  assert.equal(translator('ko').duration(1200), '20분');
  assert.equal(translator('ko').duration(3930), '1시간 5분 30초');
  assert.equal(translator('ja').duration(3930), '1時間5分30秒');
  assert.equal(translator('en').duration(60), '1 minute');
  assert.equal(translator('en').duration(3661), '1 hour 1 minute 1 second');
  assert.equal(translator('vi').duration(1200), '20 phút');
  assert.equal(translator('en')('chipMin', { n: 5 }), '5 min');
  assert.equal(translator('en')('err_minMax', { max: 5999 }), 'Minutes must be 5999 or less.');
  // 한국어 조사: 받침 없음 → 로, 받침 있음 → 으로
  const ko = translator('ko');
  assert.equal(ko('ann_setDur', { dur: '20초' }), '20초로 설정했습니다.');
  assert.equal(ko('ann_setDur', { dur: '20분' }), '20분으로 설정했습니다.');
  assert.equal(ko('ann_setDur', { dur: '1시간' }), '1시간으로 설정했습니다.');
});
