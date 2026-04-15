// ===== Audio =====
let audioCtx = null;
let humNodes = null;

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
  if (humNodes) return;
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

  humNodes = { hum, humGain, whine, whineGain };
}

function stopHum() {
  if (!humNodes) return;
  const ctx = ensureAudio();
  const t = ctx.currentTime;
  const { hum, humGain, whine, whineGain } = humNodes;
  humGain.gain.cancelScheduledValues(t);
  whineGain.gain.cancelScheduledValues(t);
  humGain.gain.setValueAtTime(humGain.gain.value, t);
  whineGain.gain.setValueAtTime(whineGain.gain.value, t);
  humGain.gain.linearRampToValueAtTime(0.0001, t + 1.4);
  whineGain.gain.linearRampToValueAtTime(0.0001, t + 1.4);
  hum.stop(t + 1.5);
  whine.stop(t + 1.5);
  humNodes = null;
}

// ===== Speech (HAL) =====
function speak(text, rate = 0.9, pitch = 0.6, volume = 1) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  try { speechSynthesis.speak(u); } catch {}
}

// ===== Daisy Bell =====
// "Dai-sy, Dai-sy, give me your an-swer, do."
const DAISY_NOTES = [
  [523.25, 1.2],  // C5  - Dai
  [440.00, 0.8],  // A4  - sy
  [349.23, 1.5],  // F4  - (hold)
  [349.23, 1.0],  // F4  - Dai
  [349.23, 0.5],  // F4  - sy
  [440.00, 1.5],  // A4  - (hold)
  [523.25, 0.6],  // C5  - give
  [587.33, 0.6],  // D5  - me
  [659.25, 0.6],  // E5  - your
  [698.46, 0.6],  // F5  - an-
  [659.25, 0.6],  // E5  - swer
  [587.33, 0.6],  // D5  - do
  [523.25, 1.8],  // C5  - (hold)
];

async function playDaisyBell() {
  const ctx = ensureAudio();
  const baseBeat = 0.30;
  const startAt = ctx.currentTime + 0.1;
  let t = startAt;
  const total = DAISY_NOTES.length;

  for (let i = 0; i < total; i++) {
    const [freq, beats] = DAISY_NOTES[i];
    const progress = i / (total - 1);
    // Progressive slowdown: 1.0x → 0.32x speed, pitch 1.0x → 0.38x
    const speedFactor = 1 - progress * 0.68;
    const pitchFactor = 1 - progress * 0.62;
    const noteDuration = (baseBeat * beats) / speedFactor;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * pitchFactor, t);
    // Slight downward pitch bend within each note as it progresses (dying vibe)
    if (progress > 0.5) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, freq * pitchFactor * (1 - progress * 0.2)),
        t + noteDuration
      );
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
    gain.gain.setValueAtTime(0.14, t + Math.max(0.02, noteDuration - 0.08));
    gain.gain.linearRampToValueAtTime(0.0001, t + noteDuration - 0.005);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + noteDuration + 0.02);

    t += noteDuration;
  }

  // Final dying drone
  const droneDur = 2.0;
  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = 'sine';
  drone.frequency.setValueAtTime(180, t);
  drone.frequency.exponentialRampToValueAtTime(28, t + droneDur);
  droneGain.gain.setValueAtTime(0.18, t);
  droneGain.gain.linearRampToValueAtTime(0.0001, t + droneDur);
  drone.connect(droneGain).connect(ctx.destination);
  drone.start(t);
  drone.stop(t + droneDur + 0.05);

  const totalMs = (t + droneDur - startAt) * 1000;
  await sleep(totalMs);
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
  powerState = 'booting';
  const prompt = document.getElementById('boot-prompt');
  const log = document.getElementById('boot-log');
  prompt.style.display = 'none';
  log.textContent = '';

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

  showCalculator();
  startHum();
  powerState = 'on';
}

function showCalculator() {
  const calc = document.getElementById('calculator');
  calc.classList.remove('powering-down');
  calc.classList.remove('hidden');
  // Force animation restart
  calc.style.animation = 'none';
  void calc.offsetWidth;
  calc.style.animation = '';
}

// ===== Power down (HAL tribute) =====
async function powerDown() {
  if (powerState !== 'on') return;
  powerState = 'shuttingDown';

  const cur = document.getElementById('current');
  const hist = document.getElementById('history');

  state.history = [];
  state.error = false;
  state.current = 'SHUTTING DOWN...';
  render();
  cur.classList.add('hal');

  beep(220, 0.5, 'sawtooth', 0.1);
  await sleep(1400);

  const halLines = [
    { text: "I'M AFRAID, DAVE.", spoken: "I'm afraid, Dave.",    rate: 0.85, pitch: 0.7, wait: 3000 },
    { text: "MY MIND IS GOING.", spoken: "My mind is going.",    rate: 0.80, pitch: 0.55, wait: 3200 },
    { text: "I CAN FEEL IT.",    spoken: "I can feel it.",       rate: 0.72, pitch: 0.4,  wait: 3200 },
  ];

  for (const line of halLines) {
    state.current = line.text;
    render();
    cur.classList.add('hal');
    speak(line.spoken, line.rate, line.pitch);
    await sleep(line.wait);
  }

  state.current = '\u266A DAISY, DAISY...';
  render();
  cur.classList.add('hal');
  await sleep(600);

  await playDaisyBell();

  // Collapse the CRT image and fade the hum
  stopHum();
  const calc = document.getElementById('calculator');
  calc.classList.add('powering-down');
  await sleep(1400);

  resetToBoot();
}

function resetToBoot() {
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel(); } catch {}
  }

  state.current = '0';
  state.history = [];
  state.error = false;
  state.justEvaluated = false;

  const cur = document.getElementById('current');
  cur.classList.remove('hal');
  render();

  const calc = document.getElementById('calculator');
  calc.classList.add('hidden');
  calc.classList.remove('powering-down');

  const boot = document.getElementById('boot-screen');
  const log = document.getElementById('boot-log');
  const prompt = document.getElementById('boot-prompt');
  log.textContent = '';
  prompt.style.display = '';
  boot.style.transition = 'none';
  boot.style.opacity = '1';
  boot.classList.remove('hidden');

  powerState = 'off';
  armBootTrigger();
}

// ===== Calculator state =====
const state = {
  current: '0',
  history: [],
  error: false,
  justEvaluated: false,
};

let powerState = 'off'; // 'off' | 'booting' | 'on' | 'shuttingDown'

function render() {
  const cur = document.getElementById('current');
  cur.textContent = state.current;
  cur.classList.toggle('error', state.error);
  if (!state.error) cur.classList.remove('hal');

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
  if (powerState !== 'on') return;
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
let bootTriggerBound = null;

function armBootTrigger() {
  if (bootTriggerBound) return;
  const trigger = () => {
    document.removeEventListener('keydown', trigger);
    document.removeEventListener('click', trigger);
    bootTriggerBound = null;
    ensureAudio();
    runBoot();
  };
  bootTriggerBound = trigger;
  document.addEventListener('keydown', trigger);
  document.addEventListener('click', trigger);
}

document.addEventListener('DOMContentLoaded', () => {
  armBootTrigger();

  // Keypad buttons
  document.querySelectorAll('.hex[data-key]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (powerState !== 'on') return;
      const key = btn.dataset.key;
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 110);
      input(key);
    });
  });

  // PWR button
  const pwr = document.getElementById('pwr-btn');
  if (pwr) {
    pwr.addEventListener('click', (e) => {
      e.stopPropagation();
      if (powerState !== 'on') return;
      pwr.classList.add('pressed');
      setTimeout(() => pwr.classList.remove('pressed'), 150);
      powerDown();
    });
  }

  // Keyboard input
  document.addEventListener('keydown', (e) => {
    if (powerState !== 'on') return;

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
