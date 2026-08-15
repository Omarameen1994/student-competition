"use client";

/**
 * مؤثرات صوتية مولَّدة بالكامل في المتصفح (WebAudio) — بدون ملفات خارجية.
 * يمكن تعطيلها من إعدادات البطولة (القسم 47).
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("sc_muted", value ? "1" : "0");
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sc_muted") === "1" || muted;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", delay = 0, gain = 0.12) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;

  const osc = ac.createOscillator();
  const vol = ac.createGain();
  const start = ac.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  vol.gain.setValueAtTime(0, start);
  vol.gain.linearRampToValueAtTime(gain, start + 0.01);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(vol).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export const sounds = {
  questionStart: () => {
    tone(523.25, 0.15, "triangle", 0);
    tone(783.99, 0.25, "triangle", 0.12);
  },
  buzz: () => {
    tone(880, 0.08, "square", 0, 0.16);
    tone(1174.66, 0.14, "square", 0.06, 0.14);
  },
  correct: () => {
    tone(659.25, 0.12, "sine", 0);
    tone(830.61, 0.12, "sine", 0.1);
    tone(1046.5, 0.3, "sine", 0.2);
  },
  wrong: () => {
    tone(220, 0.18, "sawtooth", 0, 0.1);
    tone(164.81, 0.3, "sawtooth", 0.14, 0.1);
  },
  timeUp: () => {
    tone(392, 0.2, "square", 0, 0.1);
    tone(261.63, 0.4, "square", 0.18, 0.1);
  },
  unlock: () => {
    tone(587.33, 0.1, "triangle", 0);
    tone(739.99, 0.1, "triangle", 0.08);
    tone(987.77, 0.1, "triangle", 0.16);
    tone(1318.51, 0.35, "triangle", 0.24);
  },
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.35, "triangle", i * 0.14, 0.13));
  },
};
