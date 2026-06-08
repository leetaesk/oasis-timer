/**
 * Oasis Timer Background (service worker)
 * 시스템 알림과 자동예약 엔진을 관리합니다.
 *
 * importScripts 로 모듈을 순서대로 로드합니다 (worker 전역 스코프 공유).
 *   ../shared/token.js     (parsePyxisToken)
 *   ../shared/changelog.js (CHANGELOG, getChangelogSince)
 *   → notifications.js     (showNotification)
 *   → reserve.js           (자동예약 엔진: tryReserveAll 등)
 *   → handlers.js          (chrome.* 리스너)
 */

importScripts(
    "../shared/token.js",
    "../shared/changelog.js",
    "notifications.js",
    "reserve.js",
    "handlers.js",
);
