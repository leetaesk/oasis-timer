// ── 이벤트 리스너 ─────────────────────────────────────
// (POLL_ALARM, RESERVE_PREFIX, tryReserveAll, getReserveTargets,
//  syncPollAlarm 은 reserve.js 에서 정의됨)

chrome.runtime.onInstalled.addListener((details) => {
    // 확장이 새 버전으로 업데이트되면, 이전 버전 이후 ~ 현재 버전까지의
    // 모든 공지를 누적해 보여주기 위해 (from, to] 범위를 저장한다.
    // 예: 1.0.2 → 2.0.2 업데이트 시 2.0.0/2.0.1/2.0.2 공지를 모두 표시.
    // content script 가 oasis 페이지에서 풀스크린 모달로 보여주고 닫으면 지운다.
    if (details.reason === "update") {
        const to = chrome.runtime.getManifest().version;
        const from = details.previousVersion || null;
        if (getChangelogSince(from, to).length > 0) {
            chrome.storage.local.set({ [CHANGELOG_STORAGE_KEY]: { from, to } });
        }
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "armAutoReserve") {
        // 자동예약 대상 등록 + 폴링 시작 + 즉시 1회 시도
        const key = `${RESERVE_PREFIX}${msg.roomId}-${msg.seatCode}`;
        chrome.storage.local.set(
            {
                [key]: {
                    roomId: msg.roomId,
                    roomName: msg.roomName,
                    seatCode: msg.seatCode,
                },
            },
            () => {
                chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
                tryReserveAll();
            },
        );
    } else if (msg.action === "disarmAutoReserve") {
        const key = `${RESERVE_PREFIX}${msg.roomId}-${msg.seatCode}`;
        chrome.storage.local.remove(key, () => {
            syncPollAlarm().finally(() => sendResponse && sendResponse());
        });
        return true; // 비동기 응답
    } else if (msg.action === "setAutoRenew") {
        // 자동연장 on/off 토글
        if (msg.enabled) {
            chrome.storage.local.set({ [AUTORENEW_KEY]: true }, () => {
                chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
                tryRenew();
            });
        } else {
            chrome.storage.local.remove(AUTORENEW_KEY, () => {
                syncPollAlarm().finally(() => sendResponse && sendResponse());
            });
            return true; // 비동기 응답
        }
    } else if (msg.action === "tryAutoReserve") {
        // content script(탭)의 주기적 ping → 예약·연장 모두 점검
        tryReserveAll();
        tryRenew();
    } else if (msg.action === "setMySeatWarning") {
        chrome.alarms.create("oasis-my-seat-warning", { when: msg.warningTimestamp });
        chrome.storage.local.set({
            "oasis-my-seat-warning": {
                seatCode: msg.seatCode,
                roomName: msg.roomName,
                endTimestamp: msg.endTimestamp,
            },
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POLL_ALARM) {
        tryReserveAll();
        tryRenew();
        return;
    }

    if (alarm.name === "oasis-my-seat-warning") {
        chrome.storage.local.get("oasis-my-seat-warning", (data) => {
            const info = data["oasis-my-seat-warning"];
            const room = info?.roomName ? `'${info.roomName}' ` : "";
            const seat = info?.seatCode ? `${info.seatCode}번 자리 ` : "";
            showNotification(
                "oasis-my-seat-warning",
                "이용 시간 알림",
                `${room}${seat}이용 종료 30분 전.`,
            );
            chrome.storage.local.remove("oasis-my-seat-warning");
        });
        return;
    }
});

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
    chrome.tabs.query({ url: "https://oasis.ssu.ac.kr/*" }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { active: true });
            chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
            chrome.tabs.create({
                url: "https://oasis.ssu.ac.kr/library-services/smuf/reading-rooms",
            });
        }
    });
});
