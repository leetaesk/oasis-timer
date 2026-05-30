// ── 시스템 알림 ───────────────────────────────────────

function showNotification(id, title, message) {
    chrome.notifications.create(id, {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title,
        message,
        priority: 2,
        requireInteraction: true,
    });
}
