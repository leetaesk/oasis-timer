# Oasis Timer

숭실대학교 중앙도서관 열람좌석 예약 시스템(oasis.ssu.ac.kr)을 위한 Chrome 확장 프로그램입니다.

## 기능

### 좌석 정보 표시

- 열람실 페이지에서 사용 중인 좌석에 **남은 시간**과 **종료 시각**을 표시
- 남은 시간에 따라 색상 변경 (30분 이내: 주황, 10분 이내: 빨강)

### 자리 비움 알람

- 원하는 좌석의 벨 아이콘을 클릭해 알람 설정
- 해당 좌석의 예약이 종료되는 시각에 크롬 알림 발송
- 알람 설정해 놓은 좌석 1분 간격 상태 갱신
    - 조기 좌석 갱신 시 알림 발송
    - 기존 사용자가 좌석 연장 시 알림 발송

### 내 자리 종료 30분 전 알림

- 현재 이용 중인 자리의 종료 30분 전에 자동 알림 발송

### 팝업 관리

- 확장 아이콘 클릭 시 팝업으로 현황 확인
    - 내 자리 (열람실명, 좌석번호, 남은 시간, 종료 시각)
    - 설정된 알람 목록 및 개별 취소
    - 예약 현황 페이지 바로가기

## 설치 방법

1. 이 저장소를 클론 또는 ZIP으로 다운로드
2. Chrome에서 `chrome://extensions` 접속
3. 우측 상단 **개발자 모드** 활성화
4. **압축 해제된 확장 프로그램 로드** 클릭 후 폴더 선택

## 파일 구조

확장 프로그램은 빌드 단계 없이 동작합니다. 각 컨텍스트(content / popup / background)는
manifest 또는 HTML에 명시된 **로드 순서대로** 실행되며 같은 스코프를 공유합니다.

```
oasis_timer/
├── manifest.json              # 확장 프로그램 설정 (로드 순서 정의)
├── icons/                     # 16 / 48 / 128 아이콘
├── src/
│   ├── content/               # 열람실 페이지 DOM 조작 및 폴링
│   │   ├── constants.js       #   상수 · 열람실명 · 공유 상태(Map)
│   │   ├── format.js          #   남은시간 / 종료시각 / 긴급도 포맷
│   │   ├── auth.js            #   roomId 파싱 · pyxis 토큰 추출
│   │   ├── toast.js           #   인페이지 토스트
│   │   ├── poll.js            #   내자리 30분전 알림 · 좌석 취소/연장 폴링
│   │   ├── seat-ui.js         #   알람 토글 · 인라인 주입 · 스캔
│   │   ├── main.js            #   MutationObserver · 메시지 · 초기화
│   │   └── content.css        #   인라인 표시 스타일
│   ├── popup/                 # 확장 아이콘 팝업
│   │   ├── popup.html         #   팝업 UI
│   │   ├── popup.css          #   팝업 스타일
│   │   ├── constants.js       #   열람실명
│   │   ├── api.js             #   토큰 획득 · pyxis API 호출
│   │   ├── format.js          #   시각/남은시간 포맷
│   │   ├── render.js          #   내자리 · 알람목록 렌더 · 취소
│   │   └── main.js            #   이벤트 바인딩 · 초기 렌더
│   └── background/            # 서비스 워커
│       ├── background.js      #   엔트리 (importScripts)
│       ├── notifications.js   #   시스템 알림
│       └── handlers.js        #   alarms / messages / notifications 리스너
└── releases/                  # 릴리스 zip (git 미추적)
```

## 권한

| 권한            | 용도                           |
| --------------- | ------------------------------ |
| `storage`       | 알람 정보 저장                 |
| `alarms`        | 종료 시각 알람 스케줄링        |
| `notifications` | 시스템 알림 표시               |
| `tabs`          | oasis 탭 포커스 및 메시지 전달 |
| `cookies`       | 팝업에서 API 인증 토큰 획득    |
