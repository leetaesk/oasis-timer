// ── 내 자리 종료 30분 전 알림 ─────────────────────────

async function setupMySeatWarning() {
  const token = getPyxisToken();
  if (!token) return;

  let charge = null;
  try {
    const res = await fetch('/pyxis-api/1/api/seat-charges', {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Accept-Language': 'ko', 'Pyxis-Auth-Token': token },
    });
    const data = await res.json();
    if (!data.success || data.data.totalCount === 0) return;
    charge = data.data.list[0];
  } catch (_) {
    return;
  }

  // "2026-04-14 21:19:00" → timestamp
  const endTimestamp = new Date(charge.endTime.replace(' ', 'T')).getTime();
  const warningTimestamp = endTimestamp - 30 * 60 * 1000;

  if (warningTimestamp <= Date.now()) return; // 이미 30분 이하 남음

  chrome.runtime.sendMessage({
    action: 'setMySeatWarning',
    warningTimestamp,
    endTimestamp,
    seatCode: charge.seat.code,
    roomName: charge.room.name,
  });
}

// ── 자동예약 폴링 (탭 열림 시) ────────────────────────
// 실제 예약 판단/실행은 service worker(reserve.js)가 담당.
// content script 는 자동예약 대상이 있을 때 SW 에 시도를 ping 한다.

function pingAutoReserve() {
    if (seatAutoReserveState.size === 0) return;
    chrome.runtime.sendMessage({ action: "tryAutoReserve" });
}

function startPolling() {
    if (pollIntervalId !== null) return;
    pollIntervalId = setInterval(pingAutoReserve, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollIntervalId === null) return;
    clearInterval(pollIntervalId);
    pollIntervalId = null;
}

// ── 자동예약 버튼 UI 동기화 ───────────────────────────

function findSeatState(seatCode) {
    for (const [, state] of seatTimers.entries()) {
        if (state.originalText === seatCode) return state;
    }
    return null;
}

function resetReserveButton(seatCode) {
    const state = findSeatState(seatCode);
    if (!state) return;
    const btn = state.btn.querySelector(".oasis-reserve-btn");
    if (!btn) return;
    btn.classList.remove("oasis-reserve-armed");
    btn.title = "이 자리 자동예약";
}

function resetAllReserveButtons() {
    document.querySelectorAll(".oasis-reserve-btn.oasis-reserve-armed").forEach((btn) => {
        btn.classList.remove("oasis-reserve-armed");
        btn.title = "이 자리 자동예약";
    });
}
