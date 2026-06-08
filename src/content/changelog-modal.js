// ── 업데이트 공지 모달 (풀스크린 오버레이) ────────────
// background 가 남긴 pendingChangelog({from, to}) 플래그를 확인해,
// (from, to] 범위의 모든 버전 공지를 페이지 전체를 덮는 모달로 띄운다.
// 닫으면 플래그를 지워 다시 뜨지 않게 한다.

function showChangelogModal(from, to) {
    const entries = getChangelogSince(from, to); // shared/changelog.js
    if (!entries.length) return;
    if (document.getElementById("oasis-changelog-overlay")) return; // 중복 방지

    const sectionsHtml = entries
        .map(
            (e) => `
        <section class="oasis-cl-section">
            <div class="oasis-cl-badge">v${e.version}</div>
            <h3 class="oasis-cl-title">${e.title}</h3>
            <ul class="oasis-cl-list">
                ${e.items.map((t) => `<li class="oasis-cl-item">${t}</li>`).join("")}
            </ul>
        </section>`,
        )
        .join("");

    const overlay = document.createElement("div");
    overlay.id = "oasis-changelog-overlay";
    overlay.innerHTML = `
        <div class="oasis-cl-modal" role="dialog" aria-modal="true" aria-labelledby="oasis-cl-heading">
            <div class="oasis-cl-head">
                <span id="oasis-cl-heading" class="oasis-cl-heading">Oasis Timer 업데이트</span>
            </div>
            <div class="oasis-cl-body">${sectionsHtml}</div>
            <button type="button" class="oasis-cl-close">확인했어요</button>
        </div>
    `;

    function close() {
        overlay.classList.remove("oasis-cl-visible");
        chrome.storage.local.remove(CHANGELOG_STORAGE_KEY); // shared/changelog.js
        setTimeout(() => overlay.remove(), 200);
    }

    // 닫기: 버튼 · 배경 클릭 · ESC
    overlay.querySelector(".oasis-cl-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function onEsc(e) {
        if (e.key === "Escape") {
            document.removeEventListener("keydown", onEsc);
            close();
        }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add("oasis-cl-visible"));
    });
}

function checkPendingChangelog() {
    chrome.storage.local.get(CHANGELOG_STORAGE_KEY, (data) => {
        const pending = data[CHANGELOG_STORAGE_KEY];
        if (!pending) return;
        // 신규 포맷 {from, to}. (구버전 호환: 문자열이면 그 버전 하나만)
        if (typeof pending === "string") {
            showChangelogModal(pending, pending);
        } else if (pending.to) {
            showChangelogModal(pending.from || null, pending.to);
        }
    });
}
