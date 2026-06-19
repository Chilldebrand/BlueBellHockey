import { net } from '../net/client.js';
import { useUi } from '../store.js';
import { Crowd } from './crowd.js';
import { Music } from './music.js';

type Mood = 'menu' | 'game';
function moodForPhase(phase: string): Mood {
  return phase === 'period' || phase === 'overtime' ? 'game' : 'menu';
}

// Lightweight synthesized SFX via Web Audio — no asset files. Must be initialized
// from a user gesture (the PLAY button) so the AudioContext can start.
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowd: Crowd | null = null;
  private music: Music | null = null;
  private started = false;
  private baseVolume = 0.5; // 0..1 from the player's control
  private muted = false;

  init(): void {
    if (this.started) return;
    this.started = true;
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    // seed from the persisted control, then keep it in sync (see wire()).
    this.baseVolume = useUi.getState().volume;
    this.muted = useUi.getState().muted;
    this.applyGain();
    this.master.connect(this.ctx.destination);

    // pre-baked white-noise buffer for impacts / whooshes / the crowd bed
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // living crowd + procedural music bed (WO-11)
    this.crowd = new Crowd(this.ctx, this.master, this.noise);
    this.music = new Music(this.ctx, this.master);
    const ui = useUi.getState();
    this.music.setMood(ui.musicOn ? moodForPhase(ui.phase) : null);

    this.wire();
  }

  /** Drive the crowd's sustained excitement from rink danger (0..1). */
  setCrowdDanger(d: number): void {
    this.crowd?.setDanger(d);
  }

  private now(): number {
    return this.ctx!.currentTime;
  }

  /** Effective master gain reflects the player's volume + mute. */
  private applyGain(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.baseVolume * 0.7;
  }
  setVolume(v: number): void {
    this.baseVolume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }
  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.5, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, gain = 0.5): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  goalHorn(): void {
    [196, 246.9, 293.7].forEach((f, i) => setTimeout(() => this.tone(f, 0.9, 'sawtooth', 0.4), i * 30));
  }
  hit(): void {
    this.burst(0.18, 240, 0.7);
    this.tone(90, 0.18, 'square', 0.4, 50);
  }
  shot(charge = 0): void {
    // a charged slapper is louder, lower, and gets a hard "crack"
    this.burst(0.16 + charge * 0.1, 1600 - charge * 700, 0.4 + charge * 0.3);
    if (charge > 0.6) this.tone(150, 0.16, 'square', 0.45, 70);
  }
  ult(): void {
    this.tone(220, 0.5, 'sawtooth', 0.4, 880);
  }
  whistle(): void {
    this.tone(2100, 0.25, 'triangle', 0.3);
  }
  ready(): void {
    this.tone(880, 0.12, 'sine', 0.3);
    setTimeout(() => this.tone(1320, 0.16, 'sine', 0.3), 110);
  }
  gamebreaker(): void {
    [261.6, 329.6, 392, 523.3].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.7, 'sawtooth', 0.4), i * 70),
    );
    this.burst(0.5, 600, 0.4);
  }
  ankleBreak(): void {
    this.burst(0.12, 1800, 0.6); // sharp snap
    this.tone(420, 0.22, 'square', 0.4, 120); // descending stumble
  }
  bankPlay(): void {
    this.tone(1320, 0.12, 'sine', 0.35);
    this.burst(0.1, 900, 0.3);
  }
  noLook(): void {
    this.burst(0.14, 2600, 0.25); // quick swish
  }
  oneTimer(): void {
    // crisp catch-and-release: a quick rising "ting" over a slap crack
    this.tone(880, 0.1, 'triangle', 0.35, 1480);
    this.burst(0.14, 1500, 0.4);
  }
  save(rebound: boolean): void {
    // pad/glove thud; a rebound gets an extra ringing "post-like" ping off the kick
    this.burst(0.12, 300, 0.55);
    this.tone(160, 0.14, 'square', 0.35, 90);
    if (rebound) this.tone(1200, 0.09, 'sine', 0.3);
  }

  private wire(): void {
    net.events.on('goal', () => {
      this.goalHorn();
      this.crowd?.roar();
    });
    net.events.on('gamebreaker', () => {
      this.gamebreaker();
      this.crowd?.roar();
    });
    net.events.on('hit', () => {
      this.hit();
      this.crowd?.bump(0.35);
    });
    net.events.on('shot', (e: { charge?: number }) => this.shot(e?.charge ?? 0));
    net.events.on('one_timer', () => this.oneTimer());
    net.events.on('save', (e: { rebound?: boolean }) => {
      this.save(!!e?.rebound);
      this.crowd?.bump(0.5); // a robbery gets a rise out of the building
    });
    net.events.on('ult', () => this.ult());
    net.events.on('ankle_break', () => {
      this.ankleBreak();
      this.crowd?.bump(0.45);
    });
    net.events.on('bank_play', () => this.bankPlay());
    net.events.on('nolook_pass', () => this.noLook());

    // derived cues + live mixer from match state
    let prevPhase = useUi.getState().phase;
    let prevMusicOn = useUi.getState().musicOn;
    let wasReady = false;
    let prevVol = this.baseVolume;
    let prevMuted = this.muted;
    useUi.subscribe((st) => {
      if (st.phase !== prevPhase) {
        if (st.phase === 'period') this.whistle();
        prevPhase = st.phase;
        if (st.musicOn) this.music?.setMood(moodForPhase(st.phase));
      }
      if (st.musicOn !== prevMusicOn) {
        this.music?.setMood(st.musicOn ? moodForPhase(st.phase) : null);
        prevMusicOn = st.musicOn;
      }
      const ready = st.myUltCharge >= 1;
      if (ready && !wasReady) this.ready();
      wasReady = ready;
      // reflect the player's mute/volume control
      if (st.volume !== prevVol) {
        this.setVolume(st.volume);
        prevVol = st.volume;
      }
      if (st.muted !== prevMuted) {
        this.setMuted(st.muted);
        prevMuted = st.muted;
      }
    });
  }
}

export const sfx = new Sfx();
