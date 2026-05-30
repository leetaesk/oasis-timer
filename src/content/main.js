// ── 초기화 / 이벤트 바인딩 ────────────────────────────

// Angular SPA 대응: DOM 변경 및 aria-valuenow 변경 감지
const observer = new MutationObserver(() => scanAll());
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-valuenow"],
});

// 팝업에서 알람 취소 시 버튼 UI 동기화
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'alarmCancelledFromPopup') {
    const stateKey = `${msg.roomId}_${msg.seatCode}`;
    seatAlarmState.delete(stateKey);
    resetAlarmButton(msg.seatCode);
  }
});

// 스토리지에서 알람 상태 복원 후 초기 실행
chrome.storage.local.get(null, (items) => {
    for (const [key, val] of Object.entries(items)) {
        if (key.startsWith('oasis-seat-') && val?.seatCode && val?.roomId) {
            const stateKey = `${val.roomId}_${val.seatCode}`;
            seatAlarmState.set(stateKey, {
                alarmName: key,
                endTimestamp: val.endTimestamp,
                roomId: val.roomId,
                roomName: val.roomName,
                seatCode: val.seatCode,
            });
        }
    }
    setTimeout(scanAll, 500);
    setTimeout(scanAll, 1500);
});

setTimeout(setupMySeatWarning, 2000);
startPolling();
