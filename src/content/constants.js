/**
 * Oasis Timer Content Script
 * mat-progress-bar의 aria-valuenow(경과%)를 읽어
 * ikc-seat-code 셀 안에 남은 시간 + 종료 시각을 인라인으로 표시합니다.
 * 예약된 좌석에 알람 버튼을 제공합니다.
 *
 * ── 모듈 구성 (manifest.json 의 content_scripts.js 순서대로 로드, 스코프 공유) ──
 *   constants.js → format.js → auth.js → toast.js → poll.js → seat-ui.js → main.js
 */

const TOTAL_SECONDS = 4 * 60 * 60; // 4시간

const ROOM_NAMES = {
    53: "숭실스퀘어ON(2F)",
    54: "오픈열람실(2F)",
    57: "마루열람실(6F)",
    58: "대학원열람실(6F)",
    59: "리클라이너(5F)",
    60: "숭실멀티라운지(5F)",
};

function getRoomName(roomId) {
    return ROOM_NAMES[String(roomId)] || `열람실 ${roomId}`;
}

// 자리별 타이머 상태: key = mat-progress-bar element
const seatTimers = new Map();
// 알람 설정 상태: key = stateKey(`${roomId}_${seatCode}`), value = { alarmName, endTimestamp, roomId, roomName, seatCode }
const seatAlarmState = new Map();

// 폴링
const POLL_INTERVAL_MS = 60 * 1000;
let pollIntervalId = null;

const BELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
</svg>`;

const STATE_CLASSES = [
    "oasis-state-normal",
    "oasis-state-warning",
    "oasis-state-danger",
    "oasis-state-expired",
];
