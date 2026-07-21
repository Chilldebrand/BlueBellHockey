const NOISE_BUFFERS = new WeakMap<BaseAudioContext, AudioBuffer>();
const SKATING_BUFFERS = new WeakMap<BaseAudioContext, AudioBuffer>();

type BrowserAudioContextConstructor = typeof AudioContext & {
  new (): AudioContext;
};

interface BrowserAudioGlobal {
  AudioContext?: BrowserAudioContextConstructor;
  webkitAudioContext?: BrowserAudioContextConstructor;
}

export function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as Window & BrowserAudioGlobal;
  const audioGlobal = globalThis as typeof globalThis & BrowserAudioGlobal;
  const AudioContextCtor =
    audioWindow.AudioContext ??
    audioWindow.webkitAudioContext ??
    audioGlobal.AudioContext ??
    audioGlobal.webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  try {
    return new AudioContextCtor();
  } catch {
    return null;
  }
}

export function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const cached = NOISE_BUFFERS.get(context);

  if (cached) {
    return cached;
  }

  const length = Math.max(1, Math.floor(context.sampleRate * 0.25));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  NOISE_BUFFERS.set(context, buffer);
  return buffer;
}

export function createSkatingBuffer(context: BaseAudioContext): AudioBuffer {
  const cached = SKATING_BUFFERS.get(context);

  if (cached) {
    return cached;
  }

  const length = Math.max(1, Math.floor(context.sampleRate * 0.44));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  const cycleLength = Math.max(1, Math.floor(context.sampleRate * 0.22));
  const scrapeLength = Math.max(1, Math.floor(context.sampleRate * 0.06));

  for (let index = 0; index < channel.length; index += 1) {
    const cycleIndex = index % cycleLength;
    if (cycleIndex >= scrapeLength) {
      channel[index] = 0;
      continue;
    }

    const envelope = Math.sin((cycleIndex / scrapeLength) * Math.PI);
    const grit = Math.random() * 2 - 1;
    const scrapeTone = Math.sin(
      (2 * Math.PI * 230 * cycleIndex) / context.sampleRate
    );
    channel[index] = envelope * (grit * 0.22 + scrapeTone * 0.18);
  }

  SKATING_BUFFERS.set(context, buffer);
  return buffer;
}

export async function safeResume(
  context: Pick<AudioContext, "resume"> | null | undefined
): Promise<void> {
  if (!context) {
    return;
  }

  try {
    await context.resume();
  } catch {
    // Safari/autoplay rejections should not break the client.
  }
}

interface ToneOptions {
  readonly destination: AudioNode;
  readonly frequency: number;
  readonly startTime: number;
  readonly duration: number;
  readonly gain: number;
  readonly type?: OscillatorType;
}

export function scheduleTone(
  context: AudioContext,
  options: ToneOptions
): void {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, options.startTime);
  envelope.gain.setValueAtTime(0.0001, options.startTime);
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, options.gain),
    options.startTime + 0.02
  );
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    options.startTime + options.duration
  );

  oscillator.connect(envelope);
  envelope.connect(options.destination);
  oscillator.start(options.startTime);
  oscillator.stop(options.startTime + options.duration + 0.02);
}

interface BurstOptions {
  readonly destination: AudioNode;
  readonly startTime: number;
  readonly duration: number;
  readonly gain: number;
}

export interface CrowdCheerHandle {
  stop(): void;
}

interface CrowdCheerOptions {
  readonly destination: AudioNode;
  readonly kind: "goal" | "majorHit";
  readonly durationMs: number;
}

/**
 * One synthesized crowd cheer: looped noise pushed through a band-pass so it
 * reads as a distant roar rather than static. A goal gets a two-surge swell;
 * a major hit gets one short pop. Exactly one source per cheer — callers stop
 * the previous handle before starting another so cheers never layer.
 */
export function scheduleCrowdCheer(
  context: AudioContext,
  options: CrowdCheerOptions
): CrowdCheerHandle {
  const now = context.currentTime;
  const duration = options.durationMs / 1000;
  const peak = options.kind === "goal" ? 0.55 : 0.38;

  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context);
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(options.kind === "goal" ? 950 : 1150, now);
  filter.Q.setValueAtTime(0.7, now);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(
    peak,
    now + (options.kind === "goal" ? 0.18 : 0.05)
  );
  if (options.kind === "goal") {
    // Dip and resurge — the crowd's second wave as the celebration rolls.
    envelope.gain.exponentialRampToValueAtTime(peak * 0.6, now + duration * 0.5);
    envelope.gain.exponentialRampToValueAtTime(peak * 0.85, now + duration * 0.68);
  }
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(options.destination);
  source.start(now);
  source.stop(now + duration + 0.05);

  let stopped = false;
  return {
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      try {
        source.stop();
      } catch {
        // Ended sources can reject stop(); safe to ignore.
      }
    }
  };
}

export function scheduleNoiseBurst(
  context: AudioContext,
  options: BurstOptions
): void {
  const source = context.createBufferSource();
  const envelope = context.createGain();

  source.buffer = createNoiseBuffer(context);
  envelope.gain.setValueAtTime(Math.max(0.0001, options.gain), options.startTime);
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    options.startTime + options.duration
  );

  source.connect(envelope);
  envelope.connect(options.destination);
  source.start(options.startTime);
  source.stop(options.startTime + options.duration);
}
