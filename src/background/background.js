/**
 * Oasis Timer Background (service worker)
 * 알람 스케줄링과 시스템 알림을 관리합니다.
 *
 * importScripts 로 모듈을 순서대로 로드합니다 (worker 전역 스코프 공유).
 *   notifications.js (showNotification) → handlers.js (chrome.* 리스너)
 */

importScripts("notifications.js", "handlers.js");
