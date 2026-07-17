import { scheduleTone } from "./synth.js";

interface Chord {
  readonly bass: number;
  readonly arp: readonly number[];
}

const PROGRESSION: readonly Chord[] = [
  { bass: 110, arp: [220, 261.63, 329.63] },
  { bass: 87.31, arp: [174.61, 220, 261.63] },
  { bass: 130.81, arp: [261.63, 329.63, 392] },
  { bass: 98, arp: [196, 246.94, 293.66] }
];

const STEP_DURATION_SECONDS = 60 / 84 / 2;
const STEPS_PER_CHORD = 4;
const LOOKAHEAD_MS = 25;
const LOOKAHEAD_SECONDS = 0.1;
const SILENT_GAIN = 0.0001;

export class MenuMusic {
  private readonly output: GainNode;
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode
  ) {
    this.output = context.createGain();
    this.output.gain.value = SILENT_GAIN;
    this.output.connect(destination);
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }

    this.enabled = enabled;
    this.output.gain.setTargetAtTime(
      enabled ? 1 : SILENT_GAIN,
      this.context.currentTime,
      0.4
    );

    if (enabled) {
      this.step = 0;
      this.nextTime = this.context.currentTime + 0.08;

      if (!this.timer) {
        this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
      }

      return;
    }

    this.clearTimer();
  }

  dispose(): void {
    this.enabled = false;
    this.clearTimer();
  }

  private schedule(): void {
    if (!this.enabled) {
      return;
    }

    while (this.nextTime < this.context.currentTime + LOOKAHEAD_SECONDS) {
      const chord =
        PROGRESSION[Math.floor(this.step / STEPS_PER_CHORD) % PROGRESSION.length]!;
      const inChord = this.step % STEPS_PER_CHORD;

      if (inChord === 0) {
        scheduleTone(this.context, {
          destination: this.output,
          frequency: chord.bass,
          startTime: this.nextTime,
          duration: STEP_DURATION_SECONDS * 3.4,
          gain: 0.07
        });
      }

      if (this.step % 2 === 0) {
        const arp = chord.arp[Math.floor(this.step / 2) % chord.arp.length]!;
        scheduleTone(this.context, {
          destination: this.output,
          frequency: arp,
          startTime: this.nextTime,
          duration: STEP_DURATION_SECONDS * 1.6,
          gain: 0.06,
          type: "triangle"
        });
      }

      this.nextTime += STEP_DURATION_SECONDS;
      this.step = (this.step + 1) % (STEPS_PER_CHORD * PROGRESSION.length);
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
