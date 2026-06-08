// ── 자동예약 토글 ─────────────────────────────────────

function toggleAutoReserve(seatCodeText, reserveDiv, roomId) {
    const stateKey = `${roomId}_${seatCodeText}`;
    const roomName = getRoomName(roomId);

    if (seatAutoReserveState.has(stateKey)) {
        // 자동예약 해제
        chrome.runtime.sendMessage({
            action: "disarmAutoReserve",
            roomId,
            seatCode: seatCodeText,
        });
        seatAutoReserveState.delete(stateKey);
        reserveDiv.classList.remove("oasis-reserve-armed");
        reserveDiv.title = "이 자리 자동예약";
        showToast(`${roomName} ${seatCodeText}번 좌석 자동예약 해제.`);
    } else {
        // 자동예약 설정
        chrome.runtime.sendMessage({
            action: "armAutoReserve",
            roomId,
            roomName,
            seatCode: seatCodeText,
        });
        seatAutoReserveState.set(stateKey, { roomId, roomName, seatCode: seatCodeText });
        reserveDiv.classList.add("oasis-reserve-armed");
        reserveDiv.title = "자동예약 해제";
        showToast(`${roomName} ${seatCodeText}번 좌석 자동예약 설정. 자리가 비면 예약함.`);
    }
}

// ── 인라인 주입 ───────────────────────────────────────

function injectInline(progressBar) {
    const valuenow = parseFloat(progressBar.getAttribute("aria-valuenow"));
    if (isNaN(valuenow) || valuenow <= 0) return;

    const btn = progressBar.closest("button.ikc-button-seat");
    const seatCodeEl = btn && btn.querySelector(".ikc-seat-code");
    if (!btn || !seatCodeEl) return;

    // 우리 주입이 DOM에 아직 살아있으면 정상 — 그대로 둔다.
    if (seatCodeEl.querySelector(".oasis-code-num")) return;

    // 여기 도달 = 미주입 상태. progressBar 가 예전에 등록돼 있다면
    // Angular/jQuery 재렌더로 주입이 날아간 것 → 옛 타이머를 정리하고 재주입.
    const prev = seatTimers.get(progressBar);
    if (prev) {
        clearInterval(prev.timerId);
        seatTimers.delete(progressBar);
    }

    const totalSeconds = getRoomTotalSeconds(getRoomId());
    const initialElapsed = Math.round((valuenow / 100) * totalSeconds);
    const observedAt = Date.now();
    const endTimestamp = observedAt + (totalSeconds - initialElapsed) * 1000;

    const originalText = seatCodeEl.textContent.trim();

    // 인라인 표시로 교체
    seatCodeEl.innerHTML =
        `<span class="oasis-code-num">${originalText}</span>` +
        `<span class="oasis-inline-remaining"></span>` +
        `<span class="oasis-inline-endtime">${formatEndTime(endTimestamp)}</span>`;

    const remainingSpan = seatCodeEl.querySelector(".oasis-inline-remaining");
    btn.classList.add("oasis-occupied");

    // 자동예약 버튼 추가
    const reserveDiv = document.createElement("div");
    reserveDiv.className = "oasis-reserve-btn";
    reserveDiv.title = "이 자리 자동예약";
    reserveDiv.innerHTML = RESERVE_SVG;
    // 이미 자동예약이 설정된 좌석이면 armed 상태 복원
    const currentRoomId = getRoomId();
    if (seatAutoReserveState.has(`${currentRoomId}_${originalText}`)) {
        reserveDiv.classList.add("oasis-reserve-armed");
        reserveDiv.title = "자동예약 해제";
    }
    reserveDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleAutoReserve(originalText, reserveDiv, getRoomId());
    });
    btn.appendChild(reserveDiv);

    function tick() {
        const elapsed =
            initialElapsed + Math.floor((Date.now() - observedAt) / 1000);
        const remaining = totalSeconds - elapsed;

        remainingSpan.textContent = formatRemaining(remaining);

        btn.classList.remove(...STATE_CLASSES);
        btn.classList.add("oasis-state-" + getUrgencyState(remaining));

        if (remaining <= 0) {
            clearInterval(timerId);
            seatTimers.delete(progressBar);
        }
    }

    tick();
    const timerId = setInterval(tick, 1000);
    seatTimers.set(progressBar, { timerId, originalText, seatCodeEl, btn });
}

function removeInline(progressBar) {
    const state = seatTimers.get(progressBar);
    if (!state) return;
    clearInterval(state.timerId);
    state.seatCodeEl.textContent = state.originalText;
    state.btn.classList.remove("oasis-occupied", ...STATE_CLASSES);
    state.btn.querySelector(".oasis-reserve-btn")?.remove();
    seatTimers.delete(progressBar);
}

// ── 전체 스캔 ─────────────────────────────────────────

function scanAll() {
    document
        .querySelectorAll("mat-progress-bar[aria-valuenow]")
        .forEach((bar) => {
            const valuenow = parseFloat(bar.getAttribute("aria-valuenow"));
            if (isNaN(valuenow) || valuenow <= 0) {
                removeInline(bar);
            } else {
                injectInline(bar);
            }
        });
}
