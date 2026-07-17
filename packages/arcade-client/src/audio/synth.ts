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
