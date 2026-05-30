/**
 * Oasis Timer Popup
 * 확장 아이콘 팝업 — 내 자리 현황과 설정된 알람 목록을 표시합니다.
 *
 * ── 모듈 구성 (popup.html 의 <script> 순서대로 로드, 스코프 공유) ──
 *   constants.js → api.js → format.js → render.js → main.js
 */

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
