/**
 * Oasis Timer Popup
 * 확장 아이콘 팝업 — 내 자리 현황과 자동예약 대기 목록을 표시합니다.
 *
 * ── 모듈 구성 (popup.html 의 <script> 순서대로 로드, 스코프 공유) ──
 *   shared/rooms.js → shared/token.js
 *   → api.js → format.js → render.js → main.js
 *
 * 열람실 메타(getRoomName)는 shared/rooms.js, 토큰 파서(parsePyxisToken)는
 * shared/token.js 에 정의되어 있다.
 */

// ── 인증 ──────────────────────────────────────────────

function getPyxisToken() {
    return new Promise((resolve) => {
        chrome.cookies.get(
            { url: "https://oasis.ssu.ac.kr", name: "LOPE_PYXIS3_SSU" },
            (cookie) => resolve(parsePyxisToken(cookie?.value)), // shared/token.js
        );
    });
}

async function apiFetch(path, token) {
    const res = await fetch(`https://oasis.ssu.ac.kr${path}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Accept-Language": "ko",
            "Pyxis-Auth-Token": token,
        },
    });
    const data = await res.json();
    if (!data.success)
        throw new Error(data.code || data.message || JSON.stringify(data));
    return data.data ?? { totalCount: 0, list: [] };
}
