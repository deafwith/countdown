/*
 * 다국어 문구
 * - 언어를 추가하려면 LANGS에 한 줄, DICT에 같은 키를 가진 블록 하나, DURATION에 함수 하나를 넣는다.
 * - 빠진 키는 영어 → 한국어 순으로 대신 쓴다.
 * - 문구 안의 {이름}은 t(key, {이름: 값})으로 채운다. 함수로 된 문구는 그 결과를 쓴다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VCD = Object.assign(root.VCD || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANGS = [
    { code: 'ko', name: '한국어' },
    { code: 'ja', name: '日本語' },
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Tiếng Việt' }
  ];
  var FALLBACK = 'en';

  /** "20초" + 로, "20분" + 으로 처럼 받침에 맞는 조사 */
  function withRo(word) {
    var code = word.charCodeAt(word.length - 1) - 0xac00;
    var jong = code >= 0 && code <= 11171 ? code % 28 : 0;
    return word + (jong === 0 || jong === 8 ? '로' : '으로');
  }

  function hms(sec) {
    sec = Math.max(0, Math.floor(sec));
    return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
  }

  /** 초 → 읽기용 시간 ("20분", "1 hour 5 minutes" …) */
  var DURATION = {
    ko: function (sec) {
      var t = hms(sec), p = [];
      if (t.h) p.push(t.h + '시간');
      if (t.m) p.push(t.m + '분');
      if (t.s || !p.length) p.push(t.s + '초');
      return p.join(' ');
    },
    ja: function (sec) {
      var t = hms(sec), p = [];
      if (t.h) p.push(t.h + '時間');
      if (t.m) p.push(t.m + '分');
      if (t.s || !p.length) p.push(t.s + '秒');
      return p.join('');
    },
    en: function (sec) {
      var t = hms(sec), p = [];
      function u(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
      if (t.h) p.push(u(t.h, 'hour', 'hours'));
      if (t.m) p.push(u(t.m, 'minute', 'minutes'));
      if (t.s || !p.length) p.push(u(t.s, 'second', 'seconds'));
      return p.join(' ');
    },
    vi: function (sec) {
      var t = hms(sec), p = [];
      if (t.h) p.push(t.h + ' giờ');
      if (t.m) p.push(t.m + ' phút');
      if (t.s || !p.length) p.push(t.s + ' giây');
      return p.join(' ');
    }
  };

  var DICT = {
    // ------------------------------------------------------------------ 한국어
    ko: {
      appTitle: '시각 알림 카운트다운',
      appShort: '카운트다운',
      appDesc: '남은 시간을 큰 숫자와 배경색·점멸로 보여주는 카운트다운',
      timerAria: '남은 시간',
      quickAria: '빠른 시간 선택',
      controlsAria: '타이머 제어',
      customTime: '직접 입력',
      chipMin: '{n}분',
      start: '시작', pause: '일시정지', resume: '이어서 시작', reset: '초기화',
      fullscreen: '전체화면', exitPresent: '발표 모드 종료', settings: '설정',
      keySpace: '{label} (스페이스 키)',
      st_idle: '대기', st_running: '진행 중', st_paused: '일시정지',
      ph_color: '마무리 시간', ph_blink: '종료 임박', ph_end: '시간 종료',
      ann_phase: '{label}. {dur} 남았습니다.',
      ann_start: '카운트다운 시작. {dur}',
      ann_pause: '일시정지. {dur} 남음',
      ann_resume: '이어서 시작',
      ann_reset: '초기화. {dur} 대기 중',
      ann_setDur: function (p) { return withRo(p.dur) + ' 설정했습니다.'; },
      ann_restored: '진행 중인 카운트다운을 복원했습니다.',
      toast_zero: '0초보다 큰 시간을 설정해 주세요.',
      toast_fsFailed: '전체화면을 열 수 없어 브라우저 화면 안에서 크게 보여줍니다. Esc 키나 ‘발표 모드 종료’로 닫을 수 있습니다.',
      toast_fsUnsupported: '이 브라우저는 전체화면을 지원하지 않아 화면 안에서 크게 보여줍니다. Esc 키나 ‘발표 모드 종료’로 닫을 수 있습니다.',
      toast_wake: '화면 꺼짐 방지를 사용할 수 없습니다. 필요하면 기기의 자동 잠금(화면 꺼짐) 시간을 늘려 주세요.',
      toast_checkInputs: '입력값을 확인해 주세요.',
      toast_saved: '설정을 저장했습니다.',
      toast_savedLocal: '설정을 적용했습니다. (이 브라우저에는 저장되지 않습니다)',
      toast_defaults: '기본값으로 되돌렸습니다. 저장해야 적용됩니다.',
      confirm_title: '확인', cancel: '취소', ok: '확인',
      reset_title: '초기화할까요?',
      reset_msg: function (p) { return '진행 중인 시간이 사라지고 설정한 ' + withRo(p.dur) + ' 돌아갑니다.'; },
      reset_ok: '초기화',
      running_title: '타이머가 실행 중입니다',
      running_msg: '설정을 바꾸려면 먼저 일시정지해야 합니다. 일시정지하고 설정을 열까요?',
      running_ok: '일시정지하고 열기',
      settingsTitle: '설정',
      langLabel: '언어',
      storageNote: '이 브라우저에서는 설정을 저장할 수 없어 현재 화면을 닫기 전까지만 적용됩니다.',
      h_duration: '1. 카운트다운 시간',
      unitMin: '분', unitSec: '초', remaining: '남은 시간', unitSecOrLess: '초 이하',
      err_required: '시간을 입력해 주세요.',
      err_intOnly: '0 이상의 정수만 입력할 수 있습니다.',
      err_secRange: '초는 0~59 사이로 입력해 주세요.',
      err_minMax: '분은 {max} 이하로 입력해 주세요.',
      err_zero: '0초보다 큰 시간을 입력해 주세요.',
      err_alertZero: '1초 이상으로 입력해 주세요. 0초는 종료 시점이라 알림이 보이지 않습니다.',
      durPending: '진행 중인 카운트다운에는 바로 적용되지 않습니다. 초기화하면 새 시간이 적용됩니다.',
      h_base: '2. 기본 배경색',
      h_color: '3. 배경색 변경 알림',
      use: '사용',
      thresholdLegend: '남은 시간 기준',
      colorColor: '변경 색상',
      h_blink: '4. 배경 점멸 알림',
      blinkColor: '점멸 색상',
      blinkSpeed: '점멸 속도',
      speedSlow: '느리게 (2초 주기)',
      speedNormal: '보통 (1.5초 주기)',
      rmNote: '기기에 ‘동작 줄이기’가 켜져 있어, 점멸 대신 점멸 색상의 고정 배경과 ‘종료 임박’ 문구로 알립니다.',
      rmOverride: '그래도 점멸 사용',
      note_startNow: '시작과 동시에 이 알림이 적용됩니다.',
      note_sameTime: '배경색 변경과 시점이 같아 그 시점에 바로 점멸합니다.',
      note_blinkFirst: '점멸 시점이 배경색 변경보다 먼저입니다. 점멸이 우선하므로 배경색 변경은 보이지 않습니다.',
      h_end: '5. 종료 배경색',
      h_wake: '6. 화면 꺼짐 방지',
      wakeOn: '실행 중 화면 꺼짐 방지 사용',
      wake_supported: '이 브라우저는 화면 꺼짐 방지 기능을 제공합니다. 다만 기기의 절전·배터리 설정에 따라 동작하지 않을 수 있습니다.',
      wake_unsupported: '이 브라우저에서는 화면 꺼짐 방지 기능을 사용할 수 없습니다. 발표 중 화면이 꺼지지 않도록 기기의 자동 잠금(화면 꺼짐) 시간을 늘려 주세요.',
      h_preview: '7. 알림 미리보기',
      previewDesc: '저장하지 않은 지금 설정으로 기본 배경 → 배경색 변경 → 점멸 → 시간 종료 화면을 몇 초씩 보여줍니다. 실제 타이머 시간은 바뀌지 않습니다.',
      previewStart: '미리보기 시작',
      previewStop: '미리보기 종료',
      previewPrefix: '미리보기',
      pv_base: '기본 배경',
      pv_color: '배경색 변경 (남은 시간 {dur} 이하)',
      pv_blink: '배경 점멸 (남은 시간 {dur} 이하)',
      pv_rm: ' · 동작 줄이기로 고정 표시',
      pv_end: '종료 화면',
      defaults: '기본값 복원',
      save: '저장',
      c_charcoal: '차콜', c_black: '검정', c_navy: '짙은 남색', c_darkgray: '짙은 회색', c_darkgreen: '짙은 녹색',
      c_red: '빨강', c_darkred: '진한 빨강', c_orange: '주황', c_yellow: '노랑',
      c_green: '초록', c_blue: '파랑', c_purple: '보라',
      customColor: '직접 선택',
      customColorAria: '직접 색 선택'
    },

    // ------------------------------------------------------------------ 日本語
    ja: {
      appTitle: '視覚アラート カウントダウン',
      appShort: 'カウントダウン',
      appDesc: '残り時間を大きな数字と背景色・点滅で知らせるカウントダウン',
      timerAria: '残り時間',
      quickAria: 'クイック時間選択',
      controlsAria: 'タイマー操作',
      customTime: '時間を入力',
      chipMin: '{n}分',
      start: '開始', pause: '一時停止', resume: '再開', reset: 'リセット',
      fullscreen: '全画面', exitPresent: '発表モード終了', settings: '設定',
      keySpace: '{label}（スペースキー）',
      st_idle: '待機中', st_running: '進行中', st_paused: '一時停止中',
      ph_color: 'まとめの時間', ph_blink: '終了間近', ph_end: '時間終了',
      ann_phase: '{label}。残り{dur}です。',
      ann_start: 'カウントダウン開始。{dur}',
      ann_pause: '一時停止。残り{dur}',
      ann_resume: '再開しました',
      ann_reset: 'リセットしました。{dur}で待機中',
      ann_setDur: '{dur}に設定しました。',
      ann_restored: '進行中のカウントダウンを復元しました。',
      toast_zero: '0秒より長い時間を設定してください。',
      toast_fsFailed: '全画面にできないため、ブラウザの画面内で大きく表示します。Escキーか「発表モード終了」で閉じられます。',
      toast_fsUnsupported: 'このブラウザは全画面に対応していないため、画面内で大きく表示します。Escキーか「発表モード終了」で閉じられます。',
      toast_wake: '画面のスリープ防止を使用できません。必要に応じて、端末の自動ロック（画面オフ）までの時間を延ばしてください。',
      toast_checkInputs: '入力内容を確認してください。',
      toast_saved: '設定を保存しました。',
      toast_savedLocal: '設定を適用しました。（このブラウザには保存されません）',
      toast_defaults: '初期設定に戻しました。保存すると適用されます。',
      confirm_title: '確認', cancel: 'キャンセル', ok: 'OK',
      reset_title: 'リセットしますか？',
      reset_msg: '進行中の時間は消え、設定した{dur}に戻ります。',
      reset_ok: 'リセット',
      running_title: 'タイマーが動作中です',
      running_msg: '設定を変更するには、先に一時停止する必要があります。一時停止して設定を開きますか？',
      running_ok: '一時停止して開く',
      settingsTitle: '設定',
      langLabel: '言語',
      storageNote: 'このブラウザでは設定を保存できないため、この画面を閉じるまでのみ適用されます。',
      h_duration: '1. カウントダウン時間',
      unitMin: '分', unitSec: '秒', remaining: '残り', unitSecOrLess: '秒以下',
      err_required: '時間を入力してください。',
      err_intOnly: '0以上の整数のみ入力できます。',
      err_secRange: '秒は0〜59で入力してください。',
      err_minMax: '分は{max}以下で入力してください。',
      err_zero: '0秒より長い時間を入力してください。',
      err_alertZero: '1秒以上で入力してください。0秒は終了時点のため、アラートが表示されません。',
      durPending: '進行中のカウントダウンにはすぐには適用されません。リセットすると新しい時間が適用されます。',
      h_base: '2. 基本の背景色',
      h_color: '3. 背景色変更アラート',
      use: '使用する',
      thresholdLegend: '残り時間の基準',
      colorColor: '変更後の色',
      h_blink: '4. 背景点滅アラート',
      blinkColor: '点滅色',
      blinkSpeed: '点滅速度',
      speedSlow: 'ゆっくり（2秒周期）',
      speedNormal: '標準（1.5秒周期）',
      rmNote: '端末で「視差効果を減らす／動きを減らす」がオンのため、点滅の代わりに点滅色の固定背景と「終了間近」の表示でお知らせします。',
      rmOverride: 'それでも点滅を使う',
      note_startNow: '開始と同時にこのアラートが適用されます。',
      note_sameTime: '背景色変更と同じタイミングのため、その時点ですぐに点滅します。',
      note_blinkFirst: '点滅のタイミングが背景色変更より早く設定されています。点滅が優先されるため、背景色変更は表示されません。',
      h_end: '5. 終了時の背景色',
      h_wake: '6. 画面スリープ防止',
      wakeOn: '動作中は画面のスリープを防止する',
      wake_supported: 'このブラウザは画面スリープ防止機能に対応しています。ただし、端末の省電力・バッテリー設定によっては動作しない場合があります。',
      wake_unsupported: 'このブラウザでは画面スリープ防止機能を使用できません。発表中に画面が消えないよう、端末の自動ロック（画面オフ）までの時間を延ばしてください。',
      h_preview: '7. アラートのプレビュー',
      previewDesc: '保存前の現在の設定で、基本の背景 → 背景色変更 → 点滅 → 時間終了の画面を数秒ずつ表示します。実際のタイマーの時間は変わりません。',
      previewStart: 'プレビュー開始',
      previewStop: 'プレビュー終了',
      previewPrefix: 'プレビュー',
      pv_base: '基本の背景',
      pv_color: '背景色変更（残り{dur}以下）',
      pv_blink: '背景点滅（残り{dur}以下）',
      pv_rm: '・動きを減らす設定のため固定表示',
      pv_end: '終了画面',
      defaults: '初期設定に戻す',
      save: '保存',
      c_charcoal: 'チャコール', c_black: '黒', c_navy: 'ダークネイビー', c_darkgray: 'ダークグレー', c_darkgreen: 'ダークグリーン',
      c_red: '赤', c_darkred: '濃い赤', c_orange: 'オレンジ', c_yellow: '黄',
      c_green: '緑', c_blue: '青', c_purple: '紫',
      customColor: '色を選ぶ',
      customColorAria: '色を自由に選ぶ'
    },

    // ------------------------------------------------------------------ English
    en: {
      appTitle: 'Visual Alert Countdown',
      appShort: 'Countdown',
      appDesc: 'A countdown that shows the time left in big numbers, with background color changes and blinking.',
      timerAria: 'Time remaining',
      quickAria: 'Quick time presets',
      controlsAria: 'Timer controls',
      customTime: 'Custom',
      chipMin: '{n} min',
      start: 'Start', pause: 'Pause', resume: 'Resume', reset: 'Reset',
      fullscreen: 'Full screen', exitPresent: 'Exit presentation', settings: 'Settings',
      keySpace: '{label} (Space key)',
      st_idle: 'Ready', st_running: 'Running', st_paused: 'Paused',
      ph_color: 'Wrap up', ph_blink: 'Almost time', ph_end: 'Time’s up',
      ann_phase: '{label}. {dur} remaining.',
      ann_start: 'Countdown started. {dur}',
      ann_pause: 'Paused. {dur} remaining',
      ann_resume: 'Resumed',
      ann_reset: 'Reset. Ready at {dur}',
      ann_setDur: 'Set to {dur}.',
      ann_restored: 'Restored the running countdown.',
      toast_zero: 'Please set a time longer than 0 seconds.',
      toast_fsFailed: 'Full screen couldn’t be opened, so the timer is enlarged inside the browser window. Press Esc or “Exit presentation” to close it.',
      toast_fsUnsupported: 'This browser doesn’t support full screen, so the timer is enlarged inside the window. Press Esc or “Exit presentation” to close it.',
      toast_wake: 'Keeping the screen on isn’t available. If needed, increase your device’s auto-lock (screen timeout) time.',
      toast_checkInputs: 'Please check your entries.',
      toast_saved: 'Settings saved.',
      toast_savedLocal: 'Settings applied. (They can’t be saved in this browser.)',
      toast_defaults: 'Defaults restored. Save to apply them.',
      confirm_title: 'Confirm', cancel: 'Cancel', ok: 'OK',
      reset_title: 'Reset the timer?',
      reset_msg: 'The time in progress will be lost and the timer will go back to {dur}.',
      reset_ok: 'Reset',
      running_title: 'The timer is running',
      running_msg: 'To change settings, pause the timer first. Pause and open settings?',
      running_ok: 'Pause and open',
      settingsTitle: 'Settings',
      langLabel: 'Language',
      storageNote: 'Settings can’t be saved in this browser, so they only apply until you close this page.',
      h_duration: '1. Countdown time',
      unitMin: 'min', unitSec: 'sec', remaining: 'Remaining', unitSecOrLess: 'sec or less',
      err_required: 'Please enter a time.',
      err_intOnly: 'Only whole numbers 0 or greater are allowed.',
      err_secRange: 'Seconds must be between 0 and 59.',
      err_minMax: 'Minutes must be {max} or less.',
      err_zero: 'Please enter a time longer than 0 seconds.',
      err_alertZero: 'Please enter at least 1 second. At 0 seconds the time is already up, so the alert would never show.',
      durPending: 'This won’t change the countdown in progress. The new time applies after you reset.',
      h_base: '2. Default background color',
      h_color: '3. Background color alert',
      use: 'On',
      thresholdLegend: 'When the time left is',
      colorColor: 'Change to',
      h_blink: '4. Blinking background alert',
      blinkColor: 'Blink color',
      blinkSpeed: 'Blink speed',
      speedSlow: 'Slow (2-second cycle)',
      speedNormal: 'Normal (1.5-second cycle)',
      rmNote: '“Reduce motion” is on for this device, so instead of blinking, the alert uses a steady background in the blink color plus the “Almost time” label.',
      rmOverride: 'Blink anyway',
      note_startNow: 'This alert will apply as soon as the countdown starts.',
      note_sameTime: 'This is the same time as the color change, so the background starts blinking right away.',
      note_blinkFirst: 'Blinking is set to start before the color change. Blinking takes priority, so the color change won’t be shown.',
      h_end: '5. Time’s-up background color',
      h_wake: '6. Keep screen on',
      wakeOn: 'Keep the screen on while running',
      wake_supported: 'This browser can keep the screen on, but it may not work depending on your device’s power or battery settings.',
      wake_unsupported: 'This browser can’t keep the screen on. Increase your device’s auto-lock (screen timeout) time so the screen doesn’t turn off during your talk.',
      h_preview: '7. Alert preview',
      previewDesc: 'Shows the default background → color change → blinking → time’s-up screens for a few seconds each, using the current unsaved settings. The real timer isn’t affected.',
      previewStart: 'Start preview',
      previewStop: 'End preview',
      previewPrefix: 'Preview',
      pv_base: 'Default background',
      pv_color: 'Color change ({dur} or less left)',
      pv_blink: 'Blinking ({dur} or less left)',
      pv_rm: ' · steady because Reduce motion is on',
      pv_end: 'Time’s-up screen',
      defaults: 'Restore defaults',
      save: 'Save',
      c_charcoal: 'Charcoal', c_black: 'Black', c_navy: 'Dark navy', c_darkgray: 'Dark gray', c_darkgreen: 'Dark green',
      c_red: 'Red', c_darkred: 'Dark red', c_orange: 'Orange', c_yellow: 'Yellow',
      c_green: 'Green', c_blue: 'Blue', c_purple: 'Purple',
      customColor: 'Custom',
      customColorAria: 'Choose a custom color'
    },

    // ------------------------------------------------------------------ Tiếng Việt
    vi: {
      appTitle: 'Đếm ngược cảnh báo trực quan',
      appShort: 'Đếm ngược',
      appDesc: 'Đồng hồ đếm ngược hiển thị thời gian còn lại bằng số lớn, kèm đổi màu nền và nhấp nháy.',
      timerAria: 'Thời gian còn lại',
      quickAria: 'Chọn nhanh thời gian',
      controlsAria: 'Điều khiển đồng hồ',
      customTime: 'Tự nhập',
      chipMin: '{n} phút',
      start: 'Bắt đầu', pause: 'Tạm dừng', resume: 'Tiếp tục', reset: 'Đặt lại',
      fullscreen: 'Toàn màn hình', exitPresent: 'Thoát trình chiếu', settings: 'Cài đặt',
      keySpace: '{label} (phím Space)',
      st_idle: 'Sẵn sàng', st_running: 'Đang chạy', st_paused: 'Đã tạm dừng',
      ph_color: 'Chuẩn bị kết thúc', ph_blink: 'Sắp hết giờ', ph_end: 'Hết giờ',
      ann_phase: '{label}. Còn {dur}.',
      ann_start: 'Bắt đầu đếm ngược. {dur}',
      ann_pause: 'Đã tạm dừng. Còn {dur}',
      ann_resume: 'Tiếp tục',
      ann_reset: 'Đã đặt lại. Chờ ở {dur}',
      ann_setDur: 'Đã đặt {dur}.',
      ann_restored: 'Đã khôi phục bộ đếm ngược đang chạy.',
      toast_zero: 'Vui lòng đặt thời gian lớn hơn 0 giây.',
      toast_fsFailed: 'Không thể mở toàn màn hình nên đồng hồ được phóng to trong cửa sổ trình duyệt. Nhấn Esc hoặc “Thoát trình chiếu” để đóng.',
      toast_fsUnsupported: 'Trình duyệt này không hỗ trợ toàn màn hình nên đồng hồ được phóng to trong cửa sổ. Nhấn Esc hoặc “Thoát trình chiếu” để đóng.',
      toast_wake: 'Không thể giữ màn hình luôn sáng. Nếu cần, hãy tăng thời gian tự khóa (tắt màn hình) của thiết bị.',
      toast_checkInputs: 'Vui lòng kiểm tra giá trị đã nhập.',
      toast_saved: 'Đã lưu cài đặt.',
      toast_savedLocal: 'Đã áp dụng cài đặt. (Trình duyệt này không lưu được)',
      toast_defaults: 'Đã khôi phục mặc định. Bấm Lưu để áp dụng.',
      confirm_title: 'Xác nhận', cancel: 'Hủy', ok: 'OK',
      reset_title: 'Đặt lại đồng hồ?',
      reset_msg: 'Thời gian đang chạy sẽ mất và đồng hồ quay về {dur} đã đặt.',
      reset_ok: 'Đặt lại',
      running_title: 'Đồng hồ đang chạy',
      running_msg: 'Để thay đổi cài đặt, bạn cần tạm dừng trước. Tạm dừng và mở cài đặt?',
      running_ok: 'Tạm dừng và mở',
      settingsTitle: 'Cài đặt',
      langLabel: 'Ngôn ngữ',
      storageNote: 'Trình duyệt này không lưu được cài đặt, nên cài đặt chỉ áp dụng cho đến khi bạn đóng trang.',
      h_duration: '1. Thời gian đếm ngược',
      unitMin: 'phút', unitSec: 'giây', remaining: 'Còn lại', unitSecOrLess: 'giây trở xuống',
      err_required: 'Vui lòng nhập thời gian.',
      err_intOnly: 'Chỉ được nhập số nguyên từ 0 trở lên.',
      err_secRange: 'Giây phải từ 0 đến 59.',
      err_minMax: 'Phút phải nhỏ hơn hoặc bằng {max}.',
      err_zero: 'Vui lòng nhập thời gian lớn hơn 0 giây.',
      err_alertZero: 'Vui lòng nhập ít nhất 1 giây. Ở 0 giây đã hết giờ nên cảnh báo sẽ không hiện.',
      durPending: 'Không áp dụng ngay cho bộ đếm đang chạy. Thời gian mới sẽ áp dụng sau khi đặt lại.',
      h_base: '2. Màu nền mặc định',
      h_color: '3. Cảnh báo đổi màu nền',
      use: 'Bật',
      thresholdLegend: 'Mốc thời gian còn lại',
      colorColor: 'Đổi sang màu',
      h_blink: '4. Cảnh báo nền nhấp nháy',
      blinkColor: 'Màu nhấp nháy',
      blinkSpeed: 'Tốc độ nhấp nháy',
      speedSlow: 'Chậm (chu kỳ 2 giây)',
      speedNormal: 'Bình thường (chu kỳ 1,5 giây)',
      rmNote: 'Thiết bị đang bật “Giảm chuyển động”, nên thay vì nhấp nháy, cảnh báo sẽ dùng nền cố định màu nhấp nháy kèm chữ “Sắp hết giờ”.',
      rmOverride: 'Vẫn dùng nhấp nháy',
      note_startNow: 'Cảnh báo này sẽ áp dụng ngay khi bắt đầu.',
      note_sameTime: 'Trùng mốc với cảnh báo đổi màu nên nền sẽ nhấp nháy ngay tại mốc đó.',
      note_blinkFirst: 'Mốc nhấp nháy đến trước mốc đổi màu. Nhấp nháy được ưu tiên nên sẽ không thấy đổi màu nền.',
      h_end: '5. Màu nền khi hết giờ',
      h_wake: '6. Giữ màn hình luôn sáng',
      wakeOn: 'Giữ màn hình sáng khi đang chạy',
      wake_supported: 'Trình duyệt này hỗ trợ giữ màn hình sáng, nhưng có thể không hoạt động tùy cài đặt nguồn hoặc pin của thiết bị.',
      wake_unsupported: 'Trình duyệt này không giữ được màn hình sáng. Hãy tăng thời gian tự khóa (tắt màn hình) của thiết bị để màn hình không tắt khi đang trình bày.',
      h_preview: '7. Xem trước cảnh báo',
      previewDesc: 'Dùng cài đặt hiện tại (chưa lưu) để lần lượt hiển thị nền mặc định → đổi màu → nhấp nháy → hết giờ, mỗi bước vài giây. Đồng hồ thật không bị ảnh hưởng.',
      previewStart: 'Bắt đầu xem trước',
      previewStop: 'Kết thúc xem trước',
      previewPrefix: 'Xem trước',
      pv_base: 'Nền mặc định',
      pv_color: 'Đổi màu nền (còn {dur} trở xuống)',
      pv_blink: 'Nền nhấp nháy (còn {dur} trở xuống)',
      pv_rm: ' · cố định do Giảm chuyển động',
      pv_end: 'Màn hình hết giờ',
      defaults: 'Khôi phục mặc định',
      save: 'Lưu',
      c_charcoal: 'Than chì', c_black: 'Đen', c_navy: 'Xanh navy đậm', c_darkgray: 'Xám đậm', c_darkgreen: 'Xanh lá đậm',
      c_red: 'Đỏ', c_darkred: 'Đỏ đậm', c_orange: 'Cam', c_yellow: 'Vàng',
      c_green: 'Xanh lá', c_blue: 'Xanh dương', c_purple: 'Tím',
      customColor: 'Tự chọn',
      customColorAria: 'Tự chọn màu'
    }
  };

  function isSupported(code) {
    return LANGS.some(function (l) { return l.code === code; });
  }

  /** 저장된 언어 → 브라우저 언어 → 영어 순으로 고른다. */
  function detectLang(saved, navLangs) {
    if (isSupported(saved)) return saved;
    var list = navLangs || [];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i] || '').toLowerCase().split('-')[0];
      if (isSupported(base)) return base;
    }
    return FALLBACK;
  }

  function translator(lang) {
    var code = isSupported(lang) ? lang : FALLBACK;
    var t = function (key, params) {
      var v = DICT[code][key];
      if (v === undefined) v = DICT[FALLBACK][key];
      if (v === undefined) v = DICT.ko[key];
      if (v === undefined) return key;
      if (typeof v === 'function') return v(params || {});
      return params ? v.replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] !== undefined ? String(params[k]) : m;
      }) : v;
    };
    t.lang = code;
    t.duration = DURATION[code] || DURATION[FALLBACK];
    return t;
  }

  return { LANGS: LANGS, I18N_DICT: DICT, detectLang: detectLang, translator: translator };
});
