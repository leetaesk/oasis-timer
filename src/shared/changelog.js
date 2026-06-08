/**
 * Oasis Timer — 업데이트 공지(changelog) 데이터 (공유)
 *
 * 새 버전 릴리스 시 CHANGELOG 맨 위에 항목을 추가한다.
 * content script 가 로드될 때마다 storage 의 '마지막으로 본 버전'과 현재
 * manifest 버전을 비교해, 그 사이에 공지가 있으면 풀스크린 모달로 보여준다.
 * (onInstalled 이벤트에 의존하지 않아 로컬 설치/이벤트 누락에도 견고)
 */

const LAST_SEEN_VERSION_KEY = "oasis-last-seen-version";

// 버전 → { title, items[] }. 최신이 위로.
const CHANGELOG = {
    "2.1.0": {
        title: "Oasis Timer 주요 기능 추가",
        items: [
            "✅ 자동예약: 좌석 우측 상단 캘린더 아이콘 - 자리가 비는 즉시 예약",
            "✅ 자동연장: 익스텐션 팝업에서 자동연장 토글 시 연장 가능 시점에 좌석자동연장",
        ],
    },
};

// "2.0.10" vs "2.1.0" 처럼 숫자 단위로 비교. a<b: -1, a==b: 0, a>b: 1
function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
}

// (from, to] 범위에 해당하는 공지들을 최신순으로 반환.
// from 이 없으면(신규 설치 등) to 한 건만. 각 원소: { version, title, items }
function getChangelogSince(from, to) {
    return Object.keys(CHANGELOG)
        .filter((v) => {
            if (compareVersions(v, to) > 0) return false; // to 보다 높으면 제외
            if (from && compareVersions(v, from) <= 0) return false; // from 이하 제외
            return true;
        })
        .sort((a, b) => compareVersions(b, a)) // 최신이 위로
        .map((v) => ({ version: v, ...CHANGELOG[v] }));
}
