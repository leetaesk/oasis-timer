/**
 * Oasis Timer Content Script
 * mat-progress-bar의 aria-valuenow(경과%)를 읽어
 * ikc-seat-code 셀 안에 남은 시간 + 종료 시각을 인라인으로 표시합니다.
 * 점유 중인 좌석에 "자동예약" 버튼을 제공합니다.
 *
 * ── 모듈 구성 (manifest.json 의 content_scripts.js 순서대로 로드, 스코프 공유) ──
 *   constants.js → format.js → auth.js → toast.js → poll.js → seat-ui.js → main.js
 */

const TOTAL_SECONDS = 4 * 60 * 60; // 기본 이용시간 (4시간)

const ROOM_NAMES = {
    53: "숭실스퀘어ON(2F)",
    54: "오픈열람실(2F)",
    57: "마루열람실(6F)",
    58: "대학원열람실(6F)",
    59: "리클라이너(5F)",
    60: "숭실멀티라운지(5F)",
};

// 열람실별 총 이용시간(초). 미지정 시 TOTAL_SECONDS(4시간) 적용.
const ROOM_TOTAL_SECONDS = {
    59: 1 * 60 * 60, // 리클라이너: 1시간
};

function getRoomName(roomId) {
    return ROOM_NAMES[String(roomId)] || `열람실 ${roomId}`;
}

function getRoomTotalSeconds(roomId) {
    return ROOM_TOTAL_SECONDS[String(roomId)] || TOTAL_SECONDS;
}

// 자리별 타이머 상태: key = mat-progress-bar element
const seatTimers = new Map();
// 자동예약 대상 상태: key = stateKey(`${roomId}_${seatCode}`), value = { roomId, roomName, seatCode }
const seatAutoReserveState = new Map();

// 폴링 (탭이 열려 있을 때 SW에 자동예약 시도를 ping)
const POLL_INTERVAL_MS = 15 * 1000;
let pollIntervalId = null;

// 자동예약 버튼 아이콘 (캘린더 + 체크)
const RESERVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
  <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2zM10.6 17.4l-3.1-3.1 1.4-1.4 1.7 1.7 4-4 1.4 1.4-5.4 5.4z"/>
</svg>`;

const STATE_CLASSES = [
    "oasis-state-normal",
    "oasis-state-warning",
    "oasis-state-danger",
    "oasis-state-expired",
];
