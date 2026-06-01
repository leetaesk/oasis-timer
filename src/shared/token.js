/**
 * Oasis Timer — pyxis 토큰 파서 (공유)
 *
 * LOPE_PYXIS3_SSU 쿠키는 URL 인코딩된 JSON 이며 accessToken 필드를 담는다.
 * 쿠키 raw 값을 얻는 방법은 컨텍스트마다 다르다:
 *   - content : document.cookie 에서 직접 추출
 *   - popup / background : chrome.cookies.get(...).value
 * 추출한 raw 값을 이 함수에 넘기면 accessToken 을 돌려준다.
 */

function parsePyxisToken(rawValue) {
    if (!rawValue) return null;
    try {
        return JSON.parse(decodeURIComponent(rawValue)).accessToken || null;
    } catch {
        return null;
    }
}
