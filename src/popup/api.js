// ── 인증 ──────────────────────────────────────────────

function getPyxisToken() {
    return new Promise((resolve) => {
        chrome.cookies.get(
            { url: "https://oasis.ssu.ac.kr", name: "LOPE_PYXIS3_SSU" },
            (cookie) => {
                if (!cookie) {
                    resolve(null);
                    return;
                }
                try {
                    const obj = JSON.parse(decodeURIComponent(cookie.value));
                    resolve(obj.accessToken || null);
                } catch {
                    resolve(null);
                }
            },
        );
    });
}

async function apiFetch(path, token) {
    const res = await fetch(`https://oasis.ssu.ac.kr${path}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Accept-Language": "ko",
            "Pyxis-Auth-Token": token,
        },
    });
    const data = await res.json();
    if (!data.success)
        throw new Error(data.code || data.message || JSON.stringify(data));
    return data.data ?? { totalCount: 0, list: [] };
}
