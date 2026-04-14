chrome.runtime.onInstalled.addListener(() => {
    console.log("Oasis Timer installed");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "setSeatAlarm") {
        chrome.alarms.create(msg.alarmName, { when: msg.endTimestamp });
        chrome.storage.local.set({
            [msg.alarmName]: {
                seatCode: msg.seatCode,
                roomId: msg.roomId,
                roomName: msg.roomName,
                endTimestamp: msg.endTimestamp,
            },
        });
    } else if (msg.action === "clearSeatAlarm") {
        chrome.alarms.clear(msg.alarmName);
        chrome.storage.local.remove(msg.alarmName);
    } else if (msg.action === "seatCancelledNotify") {
        showNotification(
            `oasis-cancelled-${msg.seatCode}`,
            "🔔 좌석 취소 알림",
            `알람을 설정하신 ${msg.roomName} ${msg.seatCode} 번 자리가 취소되었어요.`,
        );
    } else if (msg.action === "seatExtendedNotify") {
        showNotification(
            `oasis-extended-${msg.seatCode}`,
            "🔔 좌석 연장 알림",
            `알람을 설정하신 ${msg.roomName} ${msg.seatCode} 번 자리가 연장되었어요. 알람을 취소할게요.`,
        );
    } else if (msg.action === 'setMySeatWarning') {
        chrome.alarms.create('oasis-my-seat-warning', { when: msg.warningTimestamp });
        chrome.storage.local.set({
            'oasis-my-seat-warning': {
                seatCode: msg.seatCode,
                roomName: msg.roomName,
                endTimestamp: msg.endTimestamp,
            }
        });
    } else if (msg.action === 'cancelAlarmFromPopup') {
        chrome.alarms.clear(msg.alarmName);
        chrome.storage.local.remove(msg.alarmName, () => {
            chrome.tabs.query({ url: 'https://oasis.ssu.ac.kr/*' }, tabs => {
                tabs.forEach(tab =>
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'alarmCancelledFromPopup',
                        seatCode: msg.seatCode,
                    })
                );
            });
            sendResponse();
        });
        return true; // 비동기 응답
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'oasis-my-seat-warning') {
        chrome.storage.local.get('oasis-my-seat-warning', (data) => {
            const info = data['oasis-my-seat-warning'];
            const room = info?.roomName ? `'${info.roomName}' ` : '';
            const seat = info?.seatCode ? `${info.seatCode}번 자리 ` : '';
            showNotification(
                'oasis-my-seat-warning',
                '⏰ 이용 시간 알림',
                `${room}${seat}이용시간이 30분 남았어요.`
            );
            chrome.storage.local.remove('oasis-my-seat-warning');
        });
        return;
    }

    if (!alarm.name.startsWith("oasis-seat-")) return;

    chrome.storage.local.get(alarm.name, (data) => {
        const stored = data[alarm.name];
        const seatCode =
            stored?.seatCode || alarm.name.replace("oasis-seat-", "");
        const roomName = stored?.roomName || "";
        const location = roomName ? `'${roomName}' ` : "";
        showNotification(
            alarm.name,
            "🔔 좌석 예약 종료 알림",
            `${location}${seatCode} 번 자리가 곧 비어요!`,
        );
        chrome.storage.local.remove(alarm.name);
    });
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
