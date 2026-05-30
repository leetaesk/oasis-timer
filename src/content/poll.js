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

// ── 폴링: 알람 설정 좌석의 취소/연장 감지 ─────────────

async function pollSeats() {
    if (seatAlarmState.size === 0) return;

    const token = getPyxisToken();
    if (!token) return;

    // roomId별로 알람 그룹화
    const roomGroups = new Map(); // roomId -> [{ stateKey, seatCode, alarmInfo }]
    for (const [stateKey, alarmInfo] of seatAlarmState.entries()) {
        const roomId = alarmInfo.roomId;
        if (!roomGroups.has(roomId)) roomGroups.set(roomId, []);
        roomGroups.get(roomId).push({ stateKey, seatCode: alarmInfo.seatCode, alarmInfo });
    }

    for (const [roomId, alarms] of roomGroups.entries()) {
        let seats;
        try {
            const res = await fetch(`/pyxis-api/1/api/rooms/${roomId}/seats`, {
                credentials: "include",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    "Accept-Language": "ko",
                    "Pyxis-Auth-Token": token,
                },
            });
            const data = await res.json();
            if (!data.success) continue;
            seats = data.data?.list || [];
        } catch (_) {
            continue;
        }

        if (!seats.length) continue;

        for (const { stateKey, seatCode, alarmInfo } of alarms) {
            const seat = seats.find((s) => s.code === seatCode);
            const { roomName } = alarmInfo;

            if (!seat || !seat.isOccupied) {
                // 조기 취소 (1, 2, 3번 케이스)
                chrome.runtime.sendMessage({
                    action: "clearSeatAlarm",
                    alarmName: alarmInfo.alarmName,
                });
                chrome.runtime.sendMessage({
                    action: "seatCancelledNotify",
                    seatCode,
                    roomName,
                });
                seatAlarmState.delete(stateKey);
                resetAlarmButton(seatCode);
                showToast(
                    `알람을 설정하신 '${roomName}' ${seatCode} 번 자리가 취소되었어요.`,
                );
            } else {
                // 연장 감지: 새 예상 종료시각이 기존보다 1시간 이상 늦을 때 (4번 케이스)
                const newEndTimestamp = Date.now() + seat.remainingTime * 60 * 1000;
                if (newEndTimestamp > alarmInfo.endTimestamp + 60 * 60 * 1000) {
                    chrome.runtime.sendMessage({
                        action: "clearSeatAlarm",
                        alarmName: alarmInfo.alarmName,
                    });
                    chrome.runtime.sendMessage({
                        action: "seatExtendedNotify",
                        seatCode,
                        roomName,
                    });
                    seatAlarmState.delete(stateKey);
                    resetAlarmButton(seatCode);
                    showToast(
                        `알람을 설정하신 '${roomName}' ${seatCode} 번 자리가 연장되었어요. 알람을 취소할게요.`,
                    );
                }
            }
        }
    }
}

function startPolling() {
    if (pollIntervalId !== null) return;
    pollIntervalId = setInterval(pollSeats, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollIntervalId === null) return;
    clearInterval(pollIntervalId);
    pollIntervalId = null;
}

function findSeatState(seatCode) {
    for (const [, state] of seatTimers.entries()) {
        if (state.originalText === seatCode) return state;
    }
    return null;
}

function resetAlarmButton(seatCode) {
    const state = findSeatState(seatCode);
    if (!state) return;
    const btn = state.btn.querySelector(".oasis-alarm-btn");
    if (!btn) return;
    btn.classList.remove("oasis-alarm-armed");
    btn.title = "종료 시 알림 설정";
}
