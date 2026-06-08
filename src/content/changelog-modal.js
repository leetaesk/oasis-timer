// ── 업데이트 공지 모달 (풀스크린 오버레이) ────────────
// '마지막으로 본 버전'과 현재 버전을 비교해, 그 사이의 공지를
// 페이지 전체를 덮는 모달로 띄운다. 닫으면 본 버전을 갱신해 다시 뜨지 않게 한다.

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
            <button type="button" class="oasis-cl-close">확인</button>
        </div>
    `;

    function close() {
        overlay.classList.remove("oasis-cl-visible");
        // 닫으면 현재 버전을 '본 버전'으로 기록 → 다시 뜨지 않음
        chrome.storage.local.set({ [LAST_SEEN_VERSION_KEY]: to }); // shared/changelog.js
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

// content 로드 시마다 '마지막으로 본 버전' vs 현재 버전을 비교한다.
// onInstalled 이벤트에 의존하지 않으므로(로컬 설치/이벤트 누락에도) 견고하다.
//   - 저장값 없음 = 공지 도입 이전부터 쓰던 사용자(또는 신규 설치)
//     → 0.0.0 으로 간주해 현재까지의 공지를 한 번은 반드시 보여준다.
//   - 저장값 < 현재 = 업데이트됨 → 그 사이 공지를 모달로 표시
function checkPendingChangelog() {
    const current = chrome.runtime.getManifest().version;
    chrome.storage.local.get(LAST_SEEN_VERSION_KEY, (data) => {
        const lastSeen = data[LAST_SEEN_VERSION_KEY] || "0.0.0";

        if (compareVersions(lastSeen, current) >= 0) return; // 이미 최신까지 봄

        // (lastSeen, current] 공지가 있으면 모달, 없으면 조용히 버전만 갱신
        if (getChangelogSince(lastSeen, current).length > 0) {
            showChangelogModal(lastSeen, current);
        } else {
            chrome.storage.local.set({ [LAST_SEEN_VERSION_KEY]: current });
        }
    });
}
