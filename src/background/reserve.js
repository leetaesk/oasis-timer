/**
 * Oasis Timer — 자동예약 엔진 (service worker)
 *
 * 자동예약 대상 좌석을 감시하다가, 좌석이 풀리고(=isOccupied false)
 * 내가 보유한 자리가 없을 때 좌석을 예약(POST seat-charges)합니다.
 *
 * 예약 POST는 반드시 이 곳(service worker)에서만 실행됩니다.
 * content script(탭)와 chrome.alarms(백그라운드)가 동시에 트리거해도
 * `reserving` 락으로 중복 예약을 방지합니다.
 */

const BASE = "https://oasis.ssu.ac.kr";
const POLL_ALARM = "oasis-autoreserve-poll";
const RESERVE_PREFIX = "oasis-autoreserve-";

let reserving = false; // 동시 실행 방지 락

// ── 인증 ──────────────────────────────────────────────

function getReserveToken() {
    return new Promise((resolve) => {
        chrome.cookies.get(
            { url: BASE, name: "LOPE_PYXIS3_SSU" },
            (cookie) => resolve(parsePyxisToken(cookie?.value)), // shared/token.js
        );
    });
}

async function apiGet(path, token) {
    const res = await fetch(`${BASE}${path}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Accept-Language": "ko",
            "Pyxis-Auth-Token": token,
        },
    });
    return res.json();
}

async function apiPost(path, body, token) {
    const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Accept-Language": "ko",
            "Content-Type": "application/json",
            "Pyxis-Auth-Token": token,
        },
        body: JSON.stringify(body),
    });
    return res.json();
}

// ── 상태 조회 ─────────────────────────────────────────

// 자동예약 대상 좌석들: { storageKey: { roomId, roomName, seatCode } }
function getReserveTargets() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            const out = {};
            for (const [k, v] of Object.entries(items)) {
                if (k.startsWith(RESERVE_PREFIX)) out[k] = v;
            }
            resolve(out);
        });
    });
}

// 내가 현재 보유한 자리가 있는지
async function hasActiveCharge(token) {
    try {
        const d = await apiGet("/pyxis-api/1/api/seat-charges", token);
        if (!d.success) return false;
        const data = d.data || {};
        if (data.code === "success.noRecord") return false;
        return (data.totalCount || 0) > 0 || (data.list && data.list.length > 0);
    } catch {
        return false;
    }
}

// oasis 탭들에 메시지 브로드캐스트
function broadcast(msg) {
    chrome.tabs.query({ url: `${BASE}/*` }, (tabs) => {
        tabs.forEach((t) =>
            chrome.tabs.sendMessage(t.id, msg, () => void chrome.runtime.lastError),
        );
    });
}

// 자동예약 대상이 있으면 폴링 알람 보장, 없으면 해제
function syncPollAlarm() {
    return getReserveTargets().then((targets) => {
        if (Object.keys(targets).length > 0) {
            chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
        } else {
            chrome.alarms.clear(POLL_ALARM);
        }
    });
}

// ── 예약 코어 ─────────────────────────────────────────

async function tryReserveAll() {
    if (reserving) return;

    const targets = await getReserveTargets();
    const keys = Object.keys(targets);
    if (keys.length === 0) {
        chrome.alarms.clear(POLL_ALARM);
        return;
    }

    reserving = true;
    try {
        console.log("[oasis-reserve] tryReserveAll 시작, 대상:", targets);

        const token = await getReserveToken();
        if (!token) {
            console.log("[oasis-reserve] ❌ 토큰 없음 (로그인 필요)");
            return;
        }

        // 이미 내 자리가 있으면 예약하지 않음 (자리 1개 제한)
        const active = await hasActiveCharge(token);
        console.log("[oasis-reserve] 내 자리 보유 여부:", active);
        if (active) {
            console.log("[oasis-reserve] ⏸ 이미 내 자리 있음 → 예약 보류");
            return;
        }

        // roomId 별로 그룹화
        const byRoom = new Map();
        for (const key of keys) {
            const t = targets[key];
            if (!byRoom.has(t.roomId)) byRoom.set(t.roomId, []);
            byRoom.get(t.roomId).push(t);
        }

        for (const [roomId, list] of byRoom.entries()) {
            let seats;
            try {
                const d = await apiGet(`/pyxis-api/1/api/rooms/${roomId}/seats`, token);
                if (!d.success) {
                    console.log(`[oasis-reserve] ❌ room ${roomId} seats 응답 success:false`, d);
                    continue;
                }
                seats = d.data?.list || [];
            } catch (e) {
                console.log(`[oasis-reserve] ❌ room ${roomId} seats 조회 오류`, e);
                continue;
            }

            console.log(`[oasis-reserve] room ${roomId}: seats ${seats.length}개 조회됨`);

            for (const t of list) {
                const seat = seats.find((s) => String(s.code) === String(t.seatCode));
                if (!seat) {
                    console.log(
                        `[oasis-reserve] ⚠️ 좌석 code="${t.seatCode}" 매칭 실패.`,
                        "응답의 code 샘플:", seats.slice(0, 5).map((s) => s.code),
                    );
                    continue;
                }
                console.log(
                    `[oasis-reserve] 좌석 "${t.seatCode}" 찾음 → isOccupied=${seat.isOccupied}, id=${seat.id}`,
                );
                if (seat.isOccupied) continue; // 아직 점유 중 → 다음 기회

                // 빈자리 발견 → 예약 시도
                console.log(`[oasis-reserve] 🟢 빈자리! 예약 시도 seatId=${seat.id}`);
                let r;
                try {
                    r = await apiPost(
                        "/pyxis-api/1/api/seat-charges",
                        { seatId: seat.id, smufMethodCode: "PC" },
                        token,
                    );
                } catch (e) {
                    console.log("[oasis-reserve] ❌ 예약 POST 오류", e);
                    continue; // 네트워크 오류 → 다음 폴링에서 재시도
                }

                console.log("[oasis-reserve] 예약 응답:", r);
                if (r && r.success) {
                    console.log("[oasis-reserve] ✅ 예약 성공!");
                    await onReserveSuccess(r.data, t);
                    return; // 자리 1개 확보 → 종료
                }
                console.log("[oasis-reserve] ⚠️ 예약 실패(success:false) → 계속 감시", r?.code, r?.message);
            }
        }
    } finally {
        reserving = false;
    }
}

async function onReserveSuccess(data, target) {
    // 모든 자동예약 대상 해제 (자리 확보 완료)
    const all = await getReserveTargets();
    const allKeys = Object.keys(all);
    if (allKeys.length) await chrome.storage.local.remove(allKeys);
    await chrome.alarms.clear(POLL_ALARM);

    const roomName = data?.room?.name || target.roomName || "";
    const seatCode = data?.seat?.code || target.seatCode || "";
    const endTime = data?.endTime; // "2026-06-01 13:14:00"
    const endStr = endTime ? ` (종료 ${endTime.slice(11, 16)})` : "";

    showNotification(
        `oasis-reserved-${seatCode}`,
        "✅ 자동예약 완료",
        `'${roomName}' ${seatCode}번 자리를 예약했어요!${endStr}`,
    );

    // 내 자리 종료 30분 전 알림 자동 설정
    if (endTime) {
        const endTs = new Date(endTime.replace(" ", "T")).getTime();
        const warnTs = endTs - 30 * 60 * 1000;
        if (warnTs > Date.now()) {
            chrome.alarms.create("oasis-my-seat-warning", { when: warnTs });
            chrome.storage.local.set({
                "oasis-my-seat-warning": { seatCode, roomName, endTimestamp: endTs },
            });
        }
    }

    // 열려있는 탭들의 자동예약 버튼 UI 초기화
    broadcast({ action: "autoReserveResolved", roomName, seatCode });
}
