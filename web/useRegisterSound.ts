import { useEffect, useRef, useState } from "react";

// Audio is optional feedback. No context or sound is created before a user opts in.
export function useRegisterSound() {
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const optedIn = useRef(false);

  useEffect(
    () => () => {
      void context.current?.close().catch(() => {});
    },
    [],
  );

  function turnOff() {
    optedIn.current = false;
    setEnabled(false);
    const previous = context.current;
    context.current = null;
    void previous?.close().catch(() => {});
  }

  function failed() {
    turnOff();
    setUnavailable(true);
  }

  function toggle() {
    if (optedIn.current) {
      turnOff();
      return;
    }
    try {
      if (typeof AudioContext === "undefined") {
        failed();
        return;
      }
      const audio = new AudioContext();
      context.current = audio;
      optedIn.current = true;
      setEnabled(true);
      setUnavailable(false);
      void audio.resume().catch(failed);
    } catch {
      failed();
    }
  }

  function play(kind: "key" | "success") {
    const audio = context.current;
    if (!optedIn.current || !audio || audio.state !== "running") return;
    try {
      const notes = kind === "key" ? [180] : [880, 1320];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.085;
        const duration = kind === "key" ? 0.045 : 0.16;
        oscillator.type = kind === "key" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.035, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      failed();
    }
  }

  return { enabled, unavailable, toggle, play };
}
