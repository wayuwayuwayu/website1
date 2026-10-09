const MODES = {
  pomodoro: { label: "Pomodoro", minutes: 25, status: "Stay focused" },
  short: { label: "Short Break", minutes: 5, status: "Take a short break" },
  long: { label: "Long Break", minutes: 15, status: "Recharge a little longer" },
};

const RING = 2 * Math.PI * 88;
const STORAGE_KEY = "focus-timer-tasks";
const SESSION_KEY = "focus-timer-sessions";

const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");
const resetBtn = document.getElementById("reset");
const sessionCountEl = document.getElementById("session-count");
const progressRing = document.querySelector(".ring-progress");
const modeButtons = document.querySelectorAll(".mode");
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskProgress = document.getElementById("task-progress");

let mode = "pomodoro";
let remaining = MODES.pomodoro.minutes * 60;
let total = remaining;
let running = false;
let timerId = null;
let tasks = loadTasks();
let sessions = Number(localStorage.getItem(SESSION_KEY) || 0);

progressRing.style.strokeDasharray = String(RING);
sessionCountEl.textContent = String(sessions);
renderTasks();
updateDisplay();

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

toggleBtn.addEventListener("click", () => {
  if (running) {
    pause();
  } else {
    start();
  }
});

resetBtn.addEventListener("click", reset);

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  tasks.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    text,
    done: false,
  });
  taskInput.value = "";
  persistTasks();
  renderTasks();
});

taskList.addEventListener("click", (event) => {
  const item = event.target.closest(".task");
  if (!item) return;

  const id = item.dataset.id;
  if (event.target.closest(".check")) {
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    persistTasks();
    renderTasks();
  }

  if (event.target.closest(".delete")) {
    tasks = tasks.filter((task) => task.id !== id);
    persistTasks();
    renderTasks();
  }
});

function setMode(nextMode) {
  if (!MODES[nextMode] || nextMode === mode) return;

  mode = nextMode;
  document.body.dataset.mode = mode;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  reset();
}

function start() {
  if (remaining <= 0) remaining = total;
  running = true;
  toggleBtn.textContent = "Pause";
  toggleBtn.classList.add("is-running");
  statusEl.textContent = MODES[mode].status;
  timerId = setInterval(tick, 1000);
}

function pause() {
  running = false;
  clearInterval(timerId);
  toggleBtn.textContent = "Start";
  toggleBtn.classList.remove("is-running");
  statusEl.textContent = "Paused";
}

function reset() {
  running = false;
  clearInterval(timerId);
  total = MODES[mode].minutes * 60;
  remaining = total;
  toggleBtn.textContent = "Start";
  toggleBtn.classList.remove("is-running");
  statusEl.textContent = "Ready to focus";
  updateDisplay();
}

function tick() {
  if (remaining <= 0) {
    completeSession();
    return;
  }
  remaining -= 1;
  updateDisplay();
  if (remaining <= 0) {
    completeSession();
  }
}

function completeSession() {
  const finishedFocus = mode === "pomodoro" && running;
  remaining = 0;
  updateDisplay();
  pause();
  playAlert();
  statusEl.textContent = "Time’s up";

  if (finishedFocus) {
    sessions += 1;
    localStorage.setItem(SESSION_KEY, String(sessions));
    sessionCountEl.textContent = String(sessions);
  }
}

function updateDisplay() {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const stamp = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timeEl.textContent = stamp;
  document.title = `${stamp} • ${MODES[mode].label}`;

  const progress = total === 0 ? 0 : remaining / total;
  progressRing.style.strokeDashoffset = String(RING * (1 - progress));
}

function playAlert() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime;

  [0, 0.18, 0.36].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 2 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.18);
  });

  setTimeout(() => context.close(), 900);
}

function renderTasks() {
  taskList.innerHTML = tasks
    .map(
      (task) => `
      <li class="task${task.done ? " done" : ""}" data-id="${escapeAttr(task.id)}">
        <button class="check" type="button" aria-label="Mark complete">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12.5l4 4 8-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <p class="task-text">${escapeHtml(task.text)}</p>
        <button class="delete" type="button" aria-label="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 7h12M10 7V5h4v2m-7 0l.8 12h8.4L17 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </li>`
    )
    .join("");

  const done = tasks.filter((task) => task.done).length;
  taskProgress.textContent = `${done} / ${tasks.length}`;
  emptyState.classList.toggle("is-hidden", tasks.length > 0);
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}
