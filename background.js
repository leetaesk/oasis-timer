chrome.runtime.onInstalled.addListener(() => {
  console.log('Oasis Timer installed');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'setSeatAlarm') {
    chrome.alarms.create(msg.alarmName, { when: msg.endTimestamp });
    chrome.storage.local.set({ [msg.alarmName]: msg.seatCodeText });
  } else if (msg.action === 'clearSeatAlarm') {
    chrome.alarms.clear(msg.alarmName);
    chrome.storage.local.remove(msg.alarmName);
  } else if (msg.action === 'seatCancelledNotify') {
    showNotification(
      `oasis-cancelled-${msg.seatCode}`,
      '좌석 취소 알림',
      `알람을 설정하신 ${msg.seatCode} 자리가 취소되었어요.`
    );
  } else if (msg.action === 'seatExtendedNotify') {
    showNotification(
      `oasis-extended-${msg.seatCode}`,
      '좌석 연장 알림',
      `알람을 설정하신 ${msg.seatCode} 자리가 연장되었어요. 알람을 취소할게요.`
    );
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('oasis-seat-')) return;

  chrome.storage.local.get(alarm.name, (data) => {
    const seatCodeText = data[alarm.name] || alarm.name.replace('oasis-seat-', '');
    showNotification(
      alarm.name,
      '🔔 좌석 예약 종료',
      `${seatCodeText} 좌석의 예약 시간이 종료되었습니다.`
    );
    chrome.storage.local.remove(alarm.name);
  });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.query({ url: 'https://oasis.ssu.ac.kr/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: 'https://oasis.ssu.ac.kr/library-services/smuf/reading-rooms' });
    }
  });
});

function showNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 2
  });
}
