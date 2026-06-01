/**
 * Oasis Timer — 열람실 메타데이터 (공유)
 * content / popup / background 어디서나 동일하게 쓰는 단일 소스.
 * 로드 순서상 각 컨텍스트에서 가장 먼저 로드됩니다.
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
