/**
 * Oasis Timer — 업데이트 공지(changelog) 데이터 (공유)
 *
 * 새 버전 릴리스 시 CHANGELOG 맨 위에 항목을 추가한다.
 * background 가 확장 업데이트를 감지하면 storage 에 pendingChangelog 플래그를
 * 남기고, content script 가 oasis 페이지에서 풀스크린 모달로 보여준다.
 */

const CHANGELOG_STORAGE_KEY = "pendingChangelog";

// 버전 → { title, items[] }. 최신이 위로.
const CHANGELOG = {
    "2.1.0": {
        title: "자동연장 추가",
        items: [
            "팝업에서 자동연장을 켜면 연장 가능 시점에 좌석을 자동 연장함.",
        ],
    },
    "2.0.1": {
        title: "알림 오류 수정",
        items: [
            "자동예약 완료·이용 종료 30분 전 알림이 표시되지 않던 문제 수정.",
        ],
    },
    "2.0.0": {
        title: "자동예약 추가",
        items: [
            "좌석에 자동예약 설정 시 자리가 비는 즉시 예약함.",
            "좌석 정보 표시 안정성 개선.",
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

// 특정 버전의 공지 항목 반환 (없으면 null)
function getChangelogFor(version) {
    return CHANGELOG[version] || null;
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
