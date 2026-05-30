// ── 알람 토글 ─────────────────────────────────────────

function toggleAlarm(seatCodeText, endTimestamp, alarmDiv, roomId) {
    const stateKey = `${roomId}_${seatCodeText}`;
    const alarmName = `oasis-seat-${roomId}-${seatCodeText}`;
    const roomName = getRoomName(roomId);

    if (seatAlarmState.has(stateKey)) {
        // 알람 취소
        chrome.runtime.sendMessage({ action: "clearSeatAlarm", alarmName });
        seatAlarmState.delete(stateKey);
        alarmDiv.classList.remove("oasis-alarm-armed");
        alarmDiv.title = "종료 시 알림 설정";
        showToast(
            `'${roomName}' ${seatCodeText} 번 자리 알림이 취소되었습니다.`,
        );
    } else {
        // 알람 설정
        chrome.runtime.sendMessage({
            action: "setSeatAlarm",
            alarmName,
            seatCode: seatCodeText,
            roomId,
            roomName,
            endTimestamp,
        });
        seatAlarmState.set(stateKey, {
            alarmName,
            endTimestamp,
            roomId,
            roomName,
            seatCode: seatCodeText,
        });
        alarmDiv.classList.add("oasis-alarm-armed");
        alarmDiv.title = "알림 취소";
        const endStr = formatEndTime(endTimestamp);
        showToast(
            `'${roomName}' ${seatCodeText} 번 자리 — ${endStr} 알림이 설정되었습니다.`,
        );
    }
}

// ── 인라인 주입 ───────────────────────────────────────

function injectInline(progressBar) {
    if (seatTimers.has(progressBar)) return;

    const valuenow = parseFloat(progressBar.getAttribute("aria-valuenow"));
    if (isNaN(valuenow) || valuenow <= 0) return;

    const btn = progressBar.closest("button.ikc-button-seat");
    const seatCodeEl = btn && btn.querySelector(".ikc-seat-code");
    if (!btn || !seatCodeEl) return;

    if (seatCodeEl.querySelector(".oasis-code-num")) return;

    const initialElapsed = Math.round((valuenow / 100) * TOTAL_SECONDS);
    const observedAt = Date.now();
    const endTimestamp = observedAt + (TOTAL_SECONDS - initialElapsed) * 1000;

    const originalText = seatCodeEl.textContent.trim();

    // 인라인 표시로 교체
    seatCodeEl.innerHTML =
        `<span class="oasis-code-num">${originalText}</span>` +
        `<span class="oasis-inline-remaining"></span>` +
        `<span class="oasis-inline-endtime">${formatEndTime(endTimestamp)}</span>`;

    const remainingSpan = seatCodeEl.querySelector(".oasis-inline-remaining");
    btn.classList.add("oasis-occupied");

    // 알람 버튼 추가
    const alarmDiv = document.createElement("div");
    alarmDiv.className = "oasis-alarm-btn";
    alarmDiv.title = "종료 시 알림 설정";
    alarmDiv.innerHTML = BELL_SVG;
    // 이미 알람이 설정된 좌석이면 armed 상태 복원
    const currentRoomId = getRoomId();
    if (seatAlarmState.has(`${currentRoomId}_${originalText}`)) {
        alarmDiv.classList.add("oasis-alarm-armed");
        alarmDiv.title = "알림 취소";
    }
    alarmDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleAlarm(originalText, endTimestamp, alarmDiv, getRoomId());
    });
    btn.appendChild(alarmDiv);

    function tick() {
        const elapsed =
            initialElapsed + Math.floor((Date.now() - observedAt) / 1000);
        const remaining = TOTAL_SECONDS - elapsed;

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
    state.btn.querySelector(".oasis-alarm-btn")?.remove();
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
