// ── 이벤트 리스너 ─────────────────────────────────────
// (POLL_ALARM, RESERVE_PREFIX, tryReserveAll, getReserveTargets,
//  syncPollAlarm 은 reserve.js 에서 정의됨)

// 업데이트 공지는 content script 가 버전 비교로 처리한다(changelog-modal.js).

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
