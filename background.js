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

function showNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
    priority: 2
  });
}
