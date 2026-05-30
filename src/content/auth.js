// ── 인증 / 위치 ───────────────────────────────────────

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
