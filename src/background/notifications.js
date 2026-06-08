// ── 시스템 알림 ───────────────────────────────────────

function showNotification(id, title, message) {
    // MV3 service worker 에는 document base URL 이 없어 상대경로 iconUrl 이
    // 해석되지 않고 알림 생성이 조용히 실패한다 → 절대 URL 로 변환.
    const iconUrl = chrome.runtime.getURL("icons/icon48.png");
    chrome.notifications.create(
        id,
        {
            type: "basic",
            iconUrl,
            title,
            message,
            priority: 2,
            requireInteraction: true,
        },
        () => {
            if (chrome.runtime.lastError) {
                console.log("[oasis] 알림 생성 실패:", chrome.runtime.lastError.message);
            }
        },
    );
}
