// ===== Audio =====
let audioCtx = null;
let humStarted = false;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, duration, type = 'square', vol = 0.08) {
  const ctx = ensureAudio();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const playDigit    = () => beep(880, 0.04, 'square', 0.06);
const playOperator = () => beep(600, 0.06, 'square', 0.08);
const playDot      = () => beep(1200, 0.03, 'square', 0.05);
const playClear    = () => beep(320, 0.09, 'sawtooth', 0.08);
const playBack     = () => beep(500, 0.04, 'square', 0.06);

function playEquals() {
  beep(1000, 0.05, 'square', 0.09);
  setTimeout(() => beep(1320, 0.08, 'square', 0.09), 55);
}

function playBootBlip() {
  beep(900 + Math.random() * 700, 0.025, 'square', 0.05);
}

function playExplosion() {
  const ctx = ensureAudio();
  const t = ctx.currentTime;
  const duration = 1.8;

  // Noise burst
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const envelope = Math.pow(1 - i / data.length, 1.7);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0, t);
  noiseGain.gain.linearRampToValueAtTime(0.55, t + 0.01);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + duration);

  // Low rumble
  const rumble = ctx.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.setValueAtTime(110, t);
  rumble.frequency.exponentialRampToValueAtTime(28, t + duration);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.45, t);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  rumble.connect(rumbleGain).connect(ctx.destination);
  rumble.start(t);
  rumble.stop(t + duration);

  // Sizzle
  const sizzle = ctx.createOscillator();
  sizzle.type = 'sawtooth';
  sizzle.frequency.setValueAtTime(1800, t);
  sizzle.frequency.exponentialRampToValueAtTime(120, t + duration * 0.7);
  const sizzleGain = ctx.createGain();
  sizzleGain.gain.setValueAtTime(0.12, t);
  sizzleGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7);
  sizzle.connect(sizzleGain).connect(ctx.destination);
  sizzle.start(t);
  sizzle.stop(t + duration * 0.7);
}

function startHum() {
  if (humStarted) return;
  humStarted = true;
  const ctx = ensureAudio();

  const hum = ctx.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 60;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.012;
  hum.connect(humGain).connect(ctx.destination);
  hum.start();

  const whine = ctx.createOscillator();
  whine.type = 'sine';
  whine.frequency.value = 15720;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0.0025;
  whine.connect(whineGain).connect(ctx.destination);
  whine.start();
}

// ===== Boot sequence =====
const BOOT_LINES = [
  '> SYSTEM BOOTING...',
  '> INITIALIZING CPU.................OK',
  '> LOADING KERNEL MODULES...........OK',
  '> CHECKING MEMORY..................OK',
  '> CALIBRATING PHOSPHOR DISPLAY.....OK',
  '> MOUNTING AUDIO SUBSYSTEM.........OK',
  '> ESTABLISHING UPLINK..............OK',
  '> LOADING SYS-CALC v1.0............OK',
  '> ALL SYSTEMS NOMINAL.',
  '> READY.',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runBoot() {
  const prompt = document.getElementById('boot-prompt');
  const log = document.getElementById('boot-log');
  prompt.style.display = 'none';

  for (const line of BOOT_LINES) {
    log.textContent += line + '\n';
    playBootBlip();
    await sleep(180 + Math.random() * 160);
  }

  await sleep(500);

  const boot = document.getElementById('boot-screen');
  boot.style.transition = 'opacity 0.5s';
  boot.style.opacity = '0';
  await sleep(500);
  boot.classList.add('hidden');

  const calc = document.getElementById('calculator');
  calc.classList.remove('hidden');

  startHum();
}

// ===== Calculator state =====
const state = {
  current: '0',
  history: [],
  error: false,
  justEvaluated: false,
};

function render() {
  const cur = document.getElementById('current');
  cur.textContent = state.current;
  cur.classList.toggle('error', state.error);

  const hist = document.getElementById('history');
  hist.innerHTML = state.history
    .slice(-4)
    .map((h) => `<div class="history-line">${h}</div>`)
    .join('');
}

const OPS = ['+', '-', '*', '/'];

function formatForDisplay(expr) {
  return expr
    .replace(/\*/g, '\u00D7')
    .replace(/\//g, '\u00F7')
    .replace(/-/g, '\u2212');
}

function input(key) {
  if (state.error && key !== 'C') return;

  if (/^[0-9]$/.test(key)) {
    playDigit();
    if (state.current === '0' || state.justEvaluated) {
      state.current = key;
    } else {
      state.current += key;
    }
    state.justEvaluated = false;
  } else if (key === '.') {
    playDot();
    if (state.justEvaluated) {
      state.current = '0.';
      state.justEvaluated = false;
      render();
      return;
    }
    const lastNum = state.current.split(/[+\-*/]/).pop();
    if (!lastNum.includes('.')) {
      state.current += lastNum === '' ? '0.' : '.';
    }
  } else if (OPS.includes(key)) {
    playOperator();
    state.justEvaluated = false;
    const last = state.current.slice(-1);
    if (OPS.includes(last)) {
      state.current = state.current.slice(0, -1) + key;
    } else {
      state.current += key;
    }
  } else if (key === '=') {
    evaluate();
  } else if (key === 'C') {
    playClear();
    state.current = '0';
    state.error = false;
    state.justEvaluated = false;
  } else if (key === 'Backspace') {
    playBack();
    if (state.justEvaluated) {
      state.current = '0';
    } else if (state.current.length <= 1) {
      state.current = '0';
    } else {
      state.current = state.current.slice(0, -1);
    }
    state.justEvaluated = false;
  }

  render();
}

function evaluate() {
  let expr = state.current;
  // Strip trailing operator
  if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1);

  if (!/^[0-9+\-*/.]+$/.test(expr) || expr === '') {
    triggerError();
    return;
  }

  let result;
  try {
    result = Function('"use strict"; return (' + expr + ')')();
  } catch {
    triggerError();
    return;
  }

  if (!isFinite(result) || isNaN(result)) {
    triggerError();
    return;
  }

  playEquals();

  // Trim float precision noise
  result = Math.round(result * 1e10) / 1e10;

  state.history.push(`${formatForDisplay(state.current)} = ${result}`);
  state.current = String(result);
  state.justEvaluated = true;
  state.error = false;
  render();
}

function triggerError() {
  state.error = true;
  state.current = 'ERROR \uD83E\uDD2F';
  state.justEvaluated = false;
  playExplosion();
  render();
}

// ===== Event wiring =====
document.addEventListener('DOMContentLoaded', () => {
  let booted = false;
  const boot = () => {
    if (booted) return;
    booted = true;
    ensureAudio();
    runBoot();
  };

  const bootOnFirstInput = (e) => {
    boot();
    document.removeEventListener('keydown', bootOnFirstInput);
    document.removeEventListener('click', bootOnFirstInput);
  };
  document.addEventListener('keydown', bootOnFirstInput);
  document.addEventListener('click', bootOnFirstInput);

  // Button clicks
  document.querySelectorAll('.hex[data-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 110);
      input(key);
    });
  });

  // Keyboard input (ignored until calculator is visible)
  document.addEventListener('keydown', (e) => {
    const calc = document.getElementById('calculator');
    if (calc.classList.contains('hidden')) return;

    let key = e.key;
    if (key === 'Enter') key = '=';
    if (key === 'Escape') key = 'C';
    if (key === 'c' || key === 'C') key = 'C';
    if (key === 'x' || key === 'X') key = '*';

    const valid = ['0','1','2','3','4','5','6','7','8','9','+','-','*','/','.','=','C','Backspace'];
    if (!valid.includes(key)) return;

    e.preventDefault();

    const btn = document.querySelector(`.hex[data-key="${key}"]`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 110);
    }
    input(key);
  });

  render();
});
