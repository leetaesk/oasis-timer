const ROOM_NAMES = {
  '53': '숭실스퀘어ON(2F)',
  '54': '오픈열람실(2F)',
  '57': '마루열람실(6F)',
  '58': '대학원열람실(6F)',
  '59': '리클라이너(5F)',
  '60': '숭실멀티라운지(5F)',
};

function getRoomName(roomId) {
  return ROOM_NAMES[String(roomId)] || `열람실 ${roomId}`;
}

// ── 인증 ──────────────────────────────────────────────

function getPyxisToken() {
  return new Promise(resolve => {
    chrome.cookies.get({ url: 'https://oasis.ssu.ac.kr', name: 'LOPE_PYXIS3_SSU' }, cookie => {
      if (!cookie) { resolve(null); return; }
      try {
        const obj = JSON.parse(decodeURIComponent(cookie.value));
        resolve(obj.accessToken || null);
      } catch { resolve(null); }
    });
  });
}

async function apiFetch(path, token) {
  try {
    const res = await fetch(`https://oasis.ssu.ac.kr${path}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ko',
        'Pyxis-Auth-Token': token,
      },
    });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch { return null; }
}

// ── 포맷 ──────────────────────────────────────────────

function formatEndTimeFromStr(str) {
  // "2026-04-14 21:19:00" → "21:19"
  return str?.split(' ')?.[1]?.slice(0, 5) ?? str;
}

function formatEndTimeFromTs(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRemaining(minutes) {
  if (minutes <= 0) return '종료됨';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

// ── 내 자리 렌더 ──────────────────────────────────────

async function renderMySeat(token) {
  const el = document.getElementById('my-seat-content');
  const data = await apiFetch('/pyxis-api/1/api/seat-charges', token);

  if (!data) {
    el.innerHTML = '<div class="error">불러오기 실패</div>';
    return;
  }
  if (data.totalCount === 0) {
    el.innerHTML = '<div class="empty">현재 이용 중인 자리가 없어요.</div>';
    return;
  }

  const c = data.list[0];
  const isTemp = c.state.code === 'TEMP_CHARGE';
  const badgeClass = isTemp ? 'state-badge temp' : 'state-badge';
  const badgeText = isTemp ? '외출중' : '이용중';

  el.innerHTML = `
    <div class="my-seat-card">
      <div class="my-seat-room">${c.room.name}</div>
      <div class="my-seat-main">
        ${c.seat.code}번 자리
        <span class="${badgeClass}">${badgeText}</span>
      </div>
      <div class="my-seat-sub">
        <span class="remaining">${formatRemaining(c.remainingTime)}</span>
        &nbsp;·&nbsp;종료 ${formatEndTimeFromStr(c.endTime)}
      </div>
    </div>
  `;
}

// ── 알람 목록 렌더 ────────────────────────────────────

async function renderAlarms() {
  const el = document.getElementById('alarms-content');

  const [storageData, activeAlarms] = await Promise.all([
    new Promise(resolve => chrome.storage.local.get(null, resolve)),
    new Promise(resolve => chrome.alarms.getAll(resolve)),
  ]);

  const activeNames = new Set(activeAlarms.map(a => a.name));

  const entries = Object.entries(storageData)
    .filter(([key, val]) =>
      key.startsWith('oasis-seat-') &&
      activeNames.has(key) &&
      val?.seatCode
    )
    .sort((a, b) => (a[1].endTimestamp || 0) - (b[1].endTimestamp || 0));

  if (entries.length === 0) {
    el.innerHTML = '<div class="empty">설정된 알람이 없어요.</div>';
    return;
  }

  const html = entries.map(([alarmName, info]) => `
    <div class="alarm-item">
      <div class="alarm-info">
        <div class="alarm-room">${info.roomName || getRoomName(info.roomId)}</div>
        <div class="alarm-seat">${info.seatCode}번 자리</div>
        <div class="alarm-time">종료 ${formatEndTimeFromTs(info.endTimestamp)}</div>
      </div>
      <button class="cancel-btn" data-alarm="${alarmName}" data-seat="${info.seatCode}">취소</button>
    </div>
  `).join('');

  el.innerHTML = `<div class="alarm-list">${html}</div>`;

  el.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      await cancelAlarm(btn.dataset.alarm, btn.dataset.seat);
      await renderAlarms();
    });
  });
}

// ── 알람 취소 ─────────────────────────────────────────

function cancelAlarm(alarmName, seatCode) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'cancelAlarmFromPopup', alarmName, seatCode },
      resolve
    );
  });
}

// ── 이벤트 ────────────────────────────────────────────

document.getElementById('open-reservations').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://oasis.ssu.ac.kr/mylibrary/seat/reservations' });
});

// ── 초기 렌더 ─────────────────────────────────────────

(async () => {
  const token = await getPyxisToken();
  if (!token) {
    document.getElementById('my-seat-content').innerHTML =
      '<div class="error">로그인이 필요해요.</div>';
    document.getElementById('alarms-content').innerHTML =
      '<div class="error">로그인이 필요해요.</div>';
    return;
  }
  await Promise.all([renderMySeat(token), renderAlarms()]);
})();
