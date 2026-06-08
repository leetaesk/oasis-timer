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

    const renewOn = await new Promise((resolve) =>
        chrome.storage.local.get("oasis-autorenew", (d) => resolve(!!d["oasis-autorenew"])),
    );

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
      <label class="autorenew-row">
        <span class="autorenew-label">자동연장</span>
        <span class="switch">
          <input type="checkbox" id="autorenew-toggle" ${renewOn ? "checked" : ""}>
          <span class="slider"></span>
        </span>
      </label>
    </div>
  `;

    document.getElementById("autorenew-toggle").addEventListener("change", (e) => {
        chrome.runtime.sendMessage({ action: "setAutoRenew", enabled: e.target.checked });
    });
}

// ── 자동예약 대기 목록 렌더 ───────────────────────────

async function renderAutoReserves() {
    const el = document.getElementById("autoreserve-content");

    const storageData = await new Promise((resolve) =>
        chrome.storage.local.get(null, resolve),
    );

    const entries = Object.entries(storageData).filter(
        ([key, val]) => key.startsWith("oasis-autoreserve-") && val?.seatCode,
    );

    if (entries.length === 0) {
        el.innerHTML = '<div class="empty">대기 중인 자동예약이 없어요.</div>';
        return;
    }

    const html = entries
        .map(
            ([, info]) => `
    <div class="alarm-item">
      <div class="alarm-info">
        <div class="alarm-room">${info.roomName || getRoomName(info.roomId)}</div>
        <div class="alarm-seat">${info.seatCode}번 자리</div>
        <div class="alarm-time">풀리면 자동 예약</div>
      </div>
      <button class="cancel-btn" data-seat="${info.seatCode}" data-room="${info.roomId}">취소</button>
    </div>
  `,
        )
        .join("");

    el.innerHTML = `<div class="alarm-list">${html}</div>`;

    el.querySelectorAll(".cancel-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.textContent = "…";
            await disarmAutoReserve(btn.dataset.seat, btn.dataset.room);
            await renderAutoReserves();
        });
    });
}

// ── 자동예약 취소 ─────────────────────────────────────

function disarmAutoReserve(seatCode, roomId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "disarmAutoReserve", roomId, seatCode },
            resolve,
        );
    });
}
