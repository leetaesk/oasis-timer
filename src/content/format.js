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
