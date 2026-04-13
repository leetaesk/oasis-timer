const TOTAL_MS = 4 * 60 * 60 * 1000; // 4시간

chrome.runtime.onInstalled.addListener(() => {
  console.log('Oasis Timer installed');
});

// 익스텐션 시작 시 알람 복원 (서비스 워커 재시작 대비)
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['startTime', 'running'], (data) => {
    if (data.running && data.startTime) {
      scheduleAlarms(data.startTime);
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'setAlarms') {
    scheduleAlarms(msg.startTime);
  } else if (msg.action === 'clearAlarms') {
    chrome.alarms.clearAll();
  } else if (msg.action === 'setSeatAlarm') {
    chrome.alarms.create(msg.alarmName, { when: msg.endTimestamp });
    chrome.storage.local.set({ [msg.alarmName]: msg.seatCodeText });
  } else if (msg.action === 'clearSeatAlarm') {
    chrome.alarms.clear(msg.alarmName);
    chrome.storage.local.remove(msg.alarmName);
  }
});

function scheduleAlarms(startTime) {
  chrome.alarms.clearAll(() => {
    const endTime = startTime + TOTAL_MS;
    const now = Date.now();

    // 종료 30분 전 알림
    const warn30 = endTime - 30 * 60 * 1000;
    if (warn30 > now) {
      chrome.alarms.create('warn30', { when: warn30 });
    }

    // 종료 10분 전 알림
    const warn10 = endTime - 10 * 60 * 1000;
    if (warn10 > now) {
      chrome.alarms.create('warn10', { when: warn10 });
    }

    // 종료 알림
    if (endTime > now) {
      chrome.alarms.create('expired', { when: endTime });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('oasis-seat-')) {
    chrome.storage.local.get(alarm.name, (data) => {
      const seatCodeText = data[alarm.name] || alarm.name.replace('oasis-seat-', '');
      showNotification(
        alarm.name,
        '🔔 좌석 예약 종료',
        `${seatCodeText} 좌석의 예약 시간이 종료되었습니다.`
      );
      chrome.storage.local.remove(alarm.name);
    });
    return;
  }
  if (alarm.name === 'warn30') {
    showNotification(
      'noti_warn30',
      '도서관 자리 예약 알림',
      '⚠️ 예약 종료까지 30분 남았습니다!'
    );
  } else if (alarm.name === 'warn10') {
    showNotification(
      'noti_warn10',
      '도서관 자리 예약 알림',
      '⚠️ 예약 종료까지 10분 남았습니다! 연장을 고려하세요.'
    );
  } else if (alarm.name === 'expired') {
    showNotification(
      'noti_expired',
      '🔔 도서관 자리 예약 종료',
      '예약 시간(4시간)이 종료되었습니다. 자리를 반납하거나 연장하세요!'
    );
    chrome.storage.local.set({ running: false });
  }
});

function showNotification(id, title, message) {
  // SVG 아이콘은 일부 Chrome 버전에서 지원 안 됨 → data URL 폴백
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 2
  });
}
