// ── 이벤트 ────────────────────────────────────────────

document.getElementById("open-reservations").addEventListener("click", () => {
    chrome.tabs.create({
        url: "https://oasis.ssu.ac.kr/mylibrary/seat/reservations",
    });
});

// ── 초기 렌더 ─────────────────────────────────────────

(async () => {
    const token = await getPyxisToken();
    if (!token) {
        document.getElementById("my-seat-content").innerHTML =
            '<div class="error">로그인이 필요해요.</div>';
        document.getElementById("alarms-content").innerHTML =
            '<div class="error">로그인이 필요해요.</div>';
        return;
    }
    await Promise.all([renderMySeat(token), renderAlarms()]);
})();
