// ── 초기화 / 이벤트 바인딩 ────────────────────────────

// Angular/jQuery 재렌더 대응: DOM·aria-valuenow 변경 감지.
// 재렌더 폭풍에 scanAll 이 수백 번 동기 실행되지 않도록 rAF 로 디바운스.
let scanScheduled = false;
function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
        scanScheduled = false;
        scanAll();
    });
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-valuenow"],
});

// service worker → content: 자동예약 결과 동기화
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "autoReserveResolved") {
        // 예약 성공 → 모든 대상 해제 (자리 1개 확보 완료)
        seatAutoReserveState.clear();
        resetAllReserveButtons();
        showToast(`자동예약 완료! '${msg.roomName || ""}' ${msg.seatCode || ""}번 자리를 잡았어요.`);
    } else if (msg.action === "autoReserveDisarmed") {
        const stateKey = `${msg.roomId}_${msg.seatCode}`;
        seatAutoReserveState.delete(stateKey);
        resetReserveButton(msg.seatCode);
    }
});

// 스토리지에서 자동예약 상태 복원 후 초기 실행
chrome.storage.local.get(null, (items) => {
    for (const [key, val] of Object.entries(items)) {
        if (key.startsWith("oasis-autoreserve-") && val?.seatCode && val?.roomId) {
            const stateKey = `${val.roomId}_${val.seatCode}`;
            seatAutoReserveState.set(stateKey, {
                roomId: val.roomId,
                roomName: val.roomName,
                seatCode: val.seatCode,
            });
        }
    }
    // 좌석 데이터가 늦게 로딩되는 경우 대비, 초기 스캔을 여러 번 보강
    setTimeout(scanAll, 500);
    setTimeout(scanAll, 1500);
    setTimeout(scanAll, 3000);
});

setTimeout(setupMySeatWarning, 2000);
startPolling();
