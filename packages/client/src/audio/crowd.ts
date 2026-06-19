// Living crowd bed (WO-11). A continuously looping noise source through a lowpass
// is the murmur; its level + brightness rise with "excitement", which tracks the
// danger of the moment (puck near a net) and spikes on big events (goals roar,
// hits/saves pop). All synthesized — no audio files — and routed through the shared
// master gain so the player's mute/volume still apply.
export class Crowd {
  private bed: GainNode;
  private filter: BiquadFilterNode;
  private src: AudioBufferSourceNode | null = null;
  private ctx: AudioContext;
  private danger = 0; // 0..1 sustained scoring-chance pressure (set from the rink)
  private excite = 0; // 0..1 transient spike (goals/hits), decays over time
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: AudioContext, master: GainNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.bed = ctx.createGain();
    this.bed.gain.value = 0.0001;

    this.src = ctx.createBufferSource();
    this.src.buffer = noise;
    this.src.loop = true;
    this.src.connect(this.filter).connect(this.bed).connect(master);
    this.src.start();

    // smooth the level toward the current excitement a few times a second
    this.timer = setInterval(() => this.update(), 60);
  }

  /** Sustained pressure from how close the puck is to a net (0..1). */
  setDanger(d: number): void {
    this.danger = Math.max(0, Math.min(1, d));
  }
  /** A transient pop (hit/save). */
  bump(amount = 0.4): void {
    this.excite = Math.min(1, this.excite + amount);
  }
  /** A full roar (goal). */
  roar(): void {
    this.excite = 1;
  }

  private update(): void {
    this.excite *= 0.9; // spikes decay
    const level = Math.max(this.danger * 0.55, this.excite);
    const t = this.ctx.currentTime;
    // murmur floor so the arena never goes dead silent, swelling toward a roar
    const targetGain = 0.05 + level * 0.5;
    const targetFreq = 450 + level * 2200;
    this.bed.gain.setTargetAtTime(targetGain, t, 0.18);
    this.filter.frequency.setTargetAtTime(targetFreq, t, 0.18);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
  }
}
