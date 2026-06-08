/**
 * Oasis Timer — 자동연장 엔진 (service worker)
 *
 * 자동연장이 켜져 있으면 내 좌석의 연장 가능 시점(renewableDate)이 지났을 때
 * 자동으로 연장한다. 연장은 3단계 시퀀스로 동작한다:
 *   1) GET  /seat-charges                     → 현재 charge(id, renewableDate) 확인
 *   2) POST /rooms/{roomId}/check-arrival     → 게이트 통과 {methodCode:"GATE"}
 *   3) POST /seat-renewed-charges             → 연장 {seatCharge:id, smufMethodCode:"PC"}
 *
 * 예약과 동일하게 폴링은 POLL_ALARM 하나를 공유하고, 연장 실행은 SW 에서만
 * 일어나며 renewing 락으로 중복 연장을 막는다.
 * (BASE, apiGet, apiPost, getReserveToken 은 reserve.js 에 정의됨)
 */

const AUTORENEW_KEY = "oasis-autorenew";

let renewing = false; // 동시 실행 방지 락

// 자동연장 on/off 상태
function isAutoRenewOn() {
    return new Promise((resolve) => {
        chrome.storage.local.get(AUTORENEW_KEY, (d) => resolve(!!d[AUTORENEW_KEY]));
    });
}

async function tryRenew() {
    if (renewing) return;
    if (!(await isAutoRenewOn())) return;

    renewing = true;
    try {
        const token = await getReserveToken();
        if (!token) return;

        // 현재 내 좌석(charge) 조회
        let charge;
        try {
            const d = await apiGet("/pyxis-api/1/api/seat-charges", token);
            if (!d.success) return;
            const data = d.data || {};
            if (data.code === "success.noRecord") return; // 자리 없음
            charge = (data.list || [])[0];
        } catch {
            return;
        }
        if (!charge) return;

        // 연장 가능 시점 확인. renewableDate 가 없거나 아직 안 됐으면 대기.
        if (!charge.renewableDate) return;
        const renewableTs = new Date(charge.renewableDate.replace(" ", "T")).getTime();
        if (isNaN(renewableTs) || renewableTs > Date.now()) return; // 아직 연장 불가

        const roomId = charge.room?.id;
        const chargeId = charge.id;
        if (!roomId || !chargeId) return;

        // 1) 게이트 통과
        try {
            const arr = await apiPost(
                `/pyxis-api/1/api/rooms/${roomId}/check-arrival`,
                { methodCode: "GATE" },
                token,
            );
            if (!arr || !arr.success) return; // 게이트 실패 → 다음 폴링 재시도
        } catch {
            return;
        }

        // 2) 연장 실행
        let r;
        try {
            r = await apiPost(
                "/pyxis-api/1/api/seat-renewed-charges",
                { seatCharge: chargeId, smufMethodCode: "PC" },
                token,
            );
        } catch {
            return;
        }

        if (r && r.success) {
            await onRenewSuccess(r.data, charge);
        }
        // 실패 → 다음 폴링에서 재시도 (연장 조건 미충족 등)
    } finally {
        renewing = false;
    }
}

async function onRenewSuccess(data, prevCharge) {
    const roomName = data?.room?.name || prevCharge?.room?.name || "";
    const seatCode = data?.seat?.code || prevCharge?.seat?.code || "";
    const endTime = data?.endTime; // "2026-06-01 17:14:00"
    const endStr = endTime ? ` 종료 ${endTime.slice(11, 16)}.` : "";

    showNotification(
        `oasis-renewed-${seatCode}`,
        "자동연장 완료",
        `${roomName} ${seatCode}번 좌석 연장됨.${endStr}`,
    );

    // 종료 30분 전 알림 재설정
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

    broadcast({ action: "autoRenewRenewed", roomName, seatCode });
}
