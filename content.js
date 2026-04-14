/**
 * Oasis Timer Content Script
 * mat-progress-bar의 aria-valuenow(경과%)를 읽어
 * ikc-seat-code 셀 안에 남은 시간 + 종료 시각을 인라인으로 표시합니다.
 * 예약된 좌석에 알람 버튼을 제공합니다.
 */

const TOTAL_SECONDS = 4 * 60 * 60; // 4시간

const ROOM_NAMES = {
    53: "숭실스퀘어ON(2F)",
    54: "오픈열람실(2F)",
    57: "마루열람실(6F)",
    58: "대학원열람실(6F)",
    59: "리클라이너(5F)",
    60: "숭실멀티라운지(5F)",
};

function getRoomName(roomId) {
    return ROOM_NAMES[String(roomId)] || `열람실 ${roomId}`;
}

// 자리별 타이머 상태: key = mat-progress-bar element
const seatTimers = new Map();
// 알람 설정 상태: key = seatCodeText, value = { alarmName, endTimestamp, roomId, roomName }
const seatAlarmState = new Map();

// 폴링
const POLL_INTERVAL_MS = 60 * 1000;
let pollIntervalId = null;

function getRoomId() {
    return window.location.pathname.match(/reading-rooms\/(\d+)/)?.[1];
}

function getPyxisToken() {
    const match = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith("LOPE_PYXIS3_SSU="));
    if (!match) return null;
    try {
        const raw = match.trim().slice("LOPE_PYXIS3_SSU=".length);
        const obj = JSON.parse(decodeURIComponent(raw));
        return obj.accessToken || null;
    } catch (_) {
        return null;
    }
}

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

async function pollSeats() {
    if (seatAlarmState.size === 0) return;

    const roomId = getRoomId();
    if (!roomId) return;

    const token = getPyxisToken();
    if (!token) return;

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
        if (!data.success) return;
        seats = data.data?.list || [];
    } catch (_) {
        return;
    }

    if (!seats.length) return;

    for (const [seatCode, alarmInfo] of [...seatAlarmState.entries()]) {
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
            seatAlarmState.delete(seatCode);
            resetAlarmButton(seatCode);
            showToast(
                `알람을 설정하신 '${roomName}' ${seatCode} 번 자리가 취소되었어요.`,
            );
        } else {
            // 연장 감지: 새 예상 종료시각이 기존보다 5분 이상 늦을 때 (4번 케이스)
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
                seatAlarmState.delete(seatCode);
                resetAlarmButton(seatCode);
                showToast(
                    `알람을 설정하신 '${roomName}' ${seatCode} 번 자리가 연장되었어요. 알람을 취소할게요.`,
                );
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

const BELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
</svg>`;

// ── 포맷 함수 ─────────────────────────────────────────

function formatRemaining(seconds) {
    if (seconds <= 0) return "예약 종료";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}시간 ${String(m).padStart(2, "0")}분 남음`;
    if (m > 0) return `${m}분 ${String(s).padStart(2, "0")}초 남음`;
    return `${s}초 남음`;
}

function formatEndTime(endTimestamp) {
    const d = new Date(endTimestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `종료 ${h}:${m}`;
}

function getUrgencyState(seconds) {
    if (seconds <= 0) return "expired";
    if (seconds <= 600) return "danger"; // 10분 이내
    if (seconds <= 1800) return "warning"; // 30분 이내
    return "normal";
}

const STATE_CLASSES = [
    "oasis-state-normal",
    "oasis-state-warning",
    "oasis-state-danger",
    "oasis-state-expired",
];

// ── 토스트 ────────────────────────────────────────────

function showToast(message) {
    const existing = document.getElementById("oasis-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "oasis-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add("oasis-toast-visible"));
    });

    setTimeout(() => {
        toast.classList.remove("oasis-toast-visible");
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ── 알람 토글 ─────────────────────────────────────────

function toggleAlarm(seatCodeText, endTimestamp, alarmDiv, roomId) {
    const alarmName = `oasis-seat-${seatCodeText}`;
    const roomName = getRoomName(roomId);

    if (seatAlarmState.has(seatCodeText)) {
        // 알람 취소
        chrome.runtime.sendMessage({ action: "clearSeatAlarm", alarmName });
        seatAlarmState.delete(seatCodeText);
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
        seatAlarmState.set(seatCodeText, {
            alarmName,
            endTimestamp,
            roomId,
            roomName,
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
    if (seatAlarmState.has(originalText)) {
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

// Angular SPA 대응: DOM 변경 및 aria-valuenow 변경 감지
const observer = new MutationObserver(() => scanAll());
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-valuenow"],
});

// 팝업에서 알람 취소 시 버튼 UI 동기화
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'alarmCancelledFromPopup') {
    seatAlarmState.delete(msg.seatCode);
    resetAlarmButton(msg.seatCode);
  }
});

// 스토리지에서 알람 상태 복원 후 초기 실행
chrome.storage.local.get(null, (items) => {
    for (const [key, val] of Object.entries(items)) {
        if (key.startsWith('oasis-seat-') && val?.seatCode) {
            seatAlarmState.set(val.seatCode, {
                alarmName: key,
                endTimestamp: val.endTimestamp,
                roomId: val.roomId,
                roomName: val.roomName,
            });
        }
    }
    setTimeout(scanAll, 500);
    setTimeout(scanAll, 1500);
});

setTimeout(setupMySeatWarning, 2000);
startPolling();
