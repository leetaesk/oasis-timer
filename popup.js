const TOTAL_SECONDS = 4 * 60 * 60; // 4시간

let intervalId = null;

const display = document.getElementById('display');
const progressFill = document.getElementById('progressFill');
const statusBadge = document.getElementById('statusBadge');
const elapsedLabel = document.getElementById('elapsedLabel');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const applyTimeBtn = document.getElementById('applyTimeBtn');
const startHourInput = document.getElementById('startHour');
const startMinInput = document.getElementById('startMin');

function formatTime(secs) {
  if (secs < 0) secs = 0;
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateDisplay(startTime) {
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  const remaining = TOTAL_SECONDS - elapsed;
  const percent = Math.min(100, Math.max(0, (elapsed / TOTAL_SECONDS) * 100));

  display.textContent = remaining > 0 ? formatTime(remaining) : '00:00:00';
  progressFill.style.width = percent + '%';
  elapsedLabel.textContent = `경과: ${formatTime(Math.min(elapsed, TOTAL_SECONDS))}`;

  // 상태에 따라 색상/뱃지 업데이트
  display.className = 'time-display';
  progressFill.className = 'progress-fill';
  statusBadge.className = 'status-badge';

  if (remaining <= 0) {
    statusBadge.textContent = '예약 종료';
    statusBadge.classList.add('expired');
    display.classList.add('expired');
    progressFill.style.width = '100%';
    startBtn.disabled = true;
    clearInterval(intervalId);
  } else if (remaining <= 600) {
    // 10분 이내
    statusBadge.textContent = '⚠️ 10분 이내 종료';
    statusBadge.classList.add('danger');
    display.classList.add('danger');
    progressFill.classList.add('danger');
  } else if (remaining <= 1800) {
    // 30분 이내
    statusBadge.textContent = '⚠️ 30분 이내 종료';
    statusBadge.classList.add('warning');
    display.classList.add('warning');
    progressFill.classList.add('warning');
  } else {
    statusBadge.textContent = '예약 진행 중';
    statusBadge.classList.add('running');
  }
}

function startCountdown(startTime) {
  clearInterval(intervalId);
  updateDisplay(startTime);

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed >= TOTAL_SECONDS) return;

  intervalId = setInterval(() => {
    updateDisplay(startTime);
  }, 1000);
}

function setRunningUI() {
  startBtn.textContent = '■ 정지';
  startBtn.classList.add('active');
  startBtn.disabled = false;
}

function setStoppedUI() {
  startBtn.textContent = '▶ 지금 시작';
  startBtn.classList.remove('active');
  startBtn.disabled = false;
  clearInterval(intervalId);
  display.textContent = '04:00:00';
  progressFill.style.width = '0%';
  progressFill.className = 'progress-fill';
  statusBadge.textContent = '대기 중';
  statusBadge.className = 'status-badge';
  display.className = 'time-display';
  elapsedLabel.textContent = '경과: 00:00:00';
}

// 팝업 열릴 때 저장된 상태 복원
chrome.storage.local.get(['startTime', 'running'], (data) => {
  if (data.running && data.startTime) {
    setRunningUI();
    startCountdown(data.startTime);
  }
});

// 지금 시작 / 정지 버튼
startBtn.addEventListener('click', () => {
  chrome.storage.local.get(['running'], (data) => {
    if (data.running) {
      // 정지
      chrome.storage.local.set({ running: false });
      chrome.runtime.sendMessage({ action: 'clearAlarms' });
      setStoppedUI();
    } else {
      // 지금부터 시작
      const startTime = Date.now();
      chrome.storage.local.set({ startTime, running: true });
      chrome.runtime.sendMessage({ action: 'setAlarms', startTime });
      setRunningUI();
      startCountdown(startTime);
    }
  });
});

// 시작 시간 직접 설정 (이미 예약 중인 경우)
applyTimeBtn.addEventListener('click', () => {
  const hour = parseInt(startHourInput.value, 10);
  const min = parseInt(startMinInput.value, 10);

  if (isNaN(hour) || isNaN(min) || hour < 0 || hour > 23 || min < 0 || min > 59) {
    alert('올바른 시간을 입력하세요 (시: 0~23, 분: 0~59)');
    return;
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0, 0);

  // 미래 시간이면 전날로 처리
  if (startDate > now) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const startTime = startDate.getTime();
  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  if (elapsed >= TOTAL_SECONDS) {
    alert('입력한 시작 시간 기준으로 이미 4시간이 경과했습니다.');
    return;
  }

  chrome.storage.local.set({ startTime, running: true });
  chrome.runtime.sendMessage({ action: 'setAlarms', startTime });
  setRunningUI();
  startCountdown(startTime);

  startHourInput.value = '';
  startMinInput.value = '';
});

// 초기화 버튼
resetBtn.addEventListener('click', () => {
  chrome.storage.local.clear();
  chrome.runtime.sendMessage({ action: 'clearAlarms' });
  setStoppedUI();
});
