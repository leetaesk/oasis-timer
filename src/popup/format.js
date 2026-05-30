// ── 포맷 ──────────────────────────────────────────────

function formatEndTimeFromStr(str) {
    // "2026-04-14 21:19:00" → "21:19"
    return str?.split(" ")?.[1]?.slice(0, 5) ?? str;
}

function formatEndTimeFromTs(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRemaining(minutes) {
    if (minutes <= 0) return "종료됨";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m}분 남음`;
    return `${m}분 남음`;
}
