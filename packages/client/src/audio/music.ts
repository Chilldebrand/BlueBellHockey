// Procedural music bed (WO-11). A lookahead scheduler clocks a short looping chord
// progression — a calmer "menu" mood and a driving "game" mood — built from plain
// oscillators (no audio files). It sits low under the SFX and routes through the
// shared master gain so mute/volume apply. An A-minor i–VI–III–VII loop keeps it
// consonant no matter where the loop is entered.

interface Chord {
  bass: number;
  arp: number[];
}
// Am – F – C – G (roots an octave down for the bass)
const PROG: Chord[] = [
  { bass: 110.0, arp: [220.0, 261.63, 329.63] }, // Am: A C E
  { bass: 87.31, arp: [174.61, 220.0, 261.63] }, // F:  F A C
  { bass: 130.81, arp: [261.63, 329.63, 392.0] }, // C:  C E G
  { bass: 98.0, arp: [196.0, 246.94, 293.66] }, // G:  G B D
];

interface Mood {
  stepDur: number; // seconds per 1/8 step
  arpEvery: number; // play an arp note every N steps
  arpGain: number;
  bassGain: number;
  arpType: OscillatorType;
}
const MOODS: Record<'menu' | 'game', Mood> = {
  menu: { stepDur: 60 / 84 / 2, arpEvery: 2, arpGain: 0.06, bassGain: 0.07, arpType: 'triangle' },
  game: { stepDur: 60 / 124 / 2, arpEvery: 1, arpGain: 0.05, bassGain: 0.09, arpType: 'sawtooth' },
};

const STEPS_PER_CHORD = 4; // 4 eighth-steps per chord → 16-step loop

export class Music {
  private ctx: AudioContext;
  private out: GainNode;
  private mood: keyof typeof MOODS | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(master);
  }

  setMood(mood: keyof typeof MOODS | null): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const t = this.ctx.currentTime;
    // duck the bed to silence when stopping, fade in when (re)starting
    this.out.gain.setTargetAtTime(mood ? 0.5 : 0.0001, t, 0.4);
    if (mood && !this.timer) {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    } else if (!mood && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (!this.mood) return;
    const m = MOODS[this.mood];
    // schedule any steps falling inside the next 100ms lookahead window
    while (this.nextTime < this.ctx.currentTime + 0.1) {
      const chord = PROG[Math.floor(this.step / STEPS_PER_CHORD) % PROG.length];
      const inChord = this.step % STEPS_PER_CHORD;
      if (inChord === 0) this.note(chord.bass, this.nextTime, m.stepDur * 3.4, 'sine', m.bassGain);
      if (this.step % m.arpEvery === 0) {
        const arp = chord.arp[Math.floor(this.step / m.arpEvery) % chord.arp.length];
        this.note(arp, this.nextTime, m.stepDur * 1.6, m.arpType, m.arpGain);
      }
      this.nextTime += m.stepDur;
      this.step = (this.step + 1) % (STEPS_PER_CHORD * PROG.length);
    }
  }

  private note(freq: number, time: number, dur: number, type: OscillatorType, gain: number): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
