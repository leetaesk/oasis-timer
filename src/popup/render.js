// ── 내 자리 렌더 ──────────────────────────────────────

async function renderMySeat(token) {
    const el = document.getElementById("my-seat-content");
    let data;
    try {
        data = await apiFetch("/pyxis-api/1/api/seat-charges", token);
    } catch (e) {
        el.innerHTML = `<div class="error">불러오기 실패: ${e.message}</div>`;
        return;
    }
    if (data.code === "success.noRecord" || !data.list || data.list.length === 0) {
        el.innerHTML = '<div class="empty">현재 이용 중인 자리가 없어요.</div>';
        return;
    }

    const c = data.list[0];
    const isTemp = c.state.code === "TEMP_CHARGE";
    const badgeClass = isTemp ? "state-badge temp" : "state-badge";
    const badgeText = isTemp ? "외출중" : "이용중";

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
    const el = document.getElementById("alarms-content");

    const [storageData, activeAlarms] = await Promise.all([
        new Promise((resolve) => chrome.storage.local.get(null, resolve)),
        new Promise((resolve) => chrome.alarms.getAll(resolve)),
    ]);

    const activeNames = new Set(activeAlarms.map((a) => a.name));

    const entries = Object.entries(storageData)
        .filter(
            ([key, val]) =>
                key.startsWith("oasis-seat-") &&
                activeNames.has(key) &&
                val?.seatCode,
        )
        .sort((a, b) => (a[1].endTimestamp || 0) - (b[1].endTimestamp || 0));

    if (entries.length === 0) {
        el.innerHTML = '<div class="empty">설정된 알람이 없어요.</div>';
        return;
    }

    const html = entries
        .map(
            ([alarmName, info]) => `
    <div class="alarm-item">
      <div class="alarm-info">
        <div class="alarm-room">${info.roomName || getRoomName(info.roomId)}</div>
        <div class="alarm-seat">${info.seatCode}번 자리</div>
        <div class="alarm-time">종료 ${formatEndTimeFromTs(info.endTimestamp)}</div>
      </div>
      <button class="cancel-btn" data-alarm="${alarmName}" data-seat="${info.seatCode}" data-room="${info.roomId}">취소</button>
    </div>
  `,
        )
        .join("");

    el.innerHTML = `<div class="alarm-list">${html}</div>`;

    el.querySelectorAll(".cancel-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.textContent = "…";
            await cancelAlarm(btn.dataset.alarm, btn.dataset.seat, btn.dataset.room);
            await renderAlarms();
        });
    });
}

// ── 알람 취소 ─────────────────────────────────────────

function cancelAlarm(alarmName, seatCode, roomId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "cancelAlarmFromPopup", alarmName, seatCode, roomId },
            resolve,
        );
    });
}
