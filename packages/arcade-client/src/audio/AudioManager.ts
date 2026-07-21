import { createWorld, type WorldState } from "@bbh/arcade-core";
import { MenuMusic } from "./music.js";
import {
  AnnouncerQueue,
  announcerCueForEvent,
  validateAnnouncerManifest
} from "./announcer.js";
import { gameplayCueForEvent, skatingMixForSpeed } from "./gameplay.js";
import {
  clampAudioLevel,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences
} from "./preferences.js";
import {
  createAudioContext,
  createSkatingBuffer,
  safeResume,
  scheduleNoiseBurst,
  scheduleTone
} from "./synth.js";

export interface AudioManagerApi {
  start(): void;
  setPreferences(preferences: AudioPreferences): void;
  getPreferences(): AudioPreferences;
  setMenuMusicAllowed(allowed: boolean): void;
  consumeWorld(world: WorldState, localEntityId: string | null): void;
  resetEventCursor(): void;
  dispose(): void;
}

export interface AudioInspectionHandle {
  start(): void;
  getPreferences(): AudioPreferences;
  getMenuMusicState(): {
    readonly allowed: boolean;
    readonly active: boolean;
  };
  getBusLevels(): AudioBusLevels;
  getDiagnostics(): AudioDiagnostics;
  runEventCursorSmoke(): AudioDiagnostics;
}

export interface AudioBusLevels {
  readonly master: number;
  readonly announcer: number;
  readonly gameplay: number;
  readonly music: number;
}

export interface AudioDiagnostics {
  readonly contextAvailable: boolean;
  readonly contextState: string;
  readonly manifestStatus: "pending" | "loaded" | "unavailable" | "failed";
  readonly manifestCharacterIdsValid: boolean | null;
  readonly missingAssets: readonly string[];
  readonly assetErrors: readonly string[];
  readonly processedEventCount: number;
  readonly duplicateEventCount: number;
  readonly suppressedEventCount: number;
  readonly announcerGoalCount: number;
  readonly announcerPowerupCount: number;
}

declare global {
  interface Window {
    __bbhArcadeAudio?: AudioInspectionHandle;
  }
}

export class AudioManager implements AudioManagerApi {
  private preferences: AudioPreferences;
  private context: AudioContext | null = null;
  private started = false;
  private menuMusicAllowed = false;
  private menuMusic: MenuMusic | null = null;
  private resumeListener: (() => void) | null = null;

  private masterGain: GainNode | null = null;
  private announcerGain: GainNode | null = null;
  private gameplayGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private skatingGain: GainNode | null = null;
  private skatingFilter: BiquadFilterNode | null = null;
  private skatingSource: AudioBufferSourceNode | null = null;
  private readonly announcerBuffers = new Map<string, AudioBuffer>();
  private readonly announcerSources = new Set<AudioBufferSourceNode>();
  private announcerAssetLoadPromise: Promise<void> | null = null;
  private consumedEventIds = new Set<string>();
  private suppressBacklogOnNextConsume = false;
  private readonly announcerQueue = new AnnouncerQueue();
  private announcerTimer: ReturnType<typeof setTimeout> | null = null;
  private announcerBusy = false;
  private announcerEpoch = 0;
  private diagnostics: AudioDiagnostics = createInitialDiagnostics();

  constructor() {
    this.preferences = loadAudioPreferences();
    this.installDevelopmentInspectionHandle();
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.context = createAudioContext();
    this.diagnostics = {
      ...this.diagnostics,
      contextAvailable: Boolean(this.context),
      contextState: getContextState(this.context)
    };
    this.announcerAssetLoadPromise = this.loadAssetDiagnostics();

    if (!this.context) {
      return;
    }

    const masterGain = this.context.createGain();
    const announcerGain = this.context.createGain();
    const gameplayGain = this.context.createGain();
    const musicGain = this.context.createGain();

    masterGain.connect(this.context.destination);
    announcerGain.connect(masterGain);
    gameplayGain.connect(masterGain);
    musicGain.connect(masterGain);

    this.masterGain = masterGain;
    this.announcerGain = announcerGain;
    this.gameplayGain = gameplayGain;
    this.musicGain = musicGain;

    this.applyPreferences(this.preferences);
    this.menuMusic = new MenuMusic(this.context, musicGain);
    void safeResume(this.context);

    if (typeof window !== "undefined") {
      this.resumeListener = () => {
        void safeResume(this.context);
      };
      window.addEventListener("pointerdown", this.resumeListener);
    }

    this.menuMusic.setEnabled(this.menuMusicAllowed);
    this.diagnostics = {
      ...this.diagnostics,
      contextState: getContextState(this.context)
    };
  }

  setPreferences(preferences: AudioPreferences): void {
    const normalized = normalizeAudioPreferences(preferences);

    this.preferences = normalized;
    saveAudioPreferences(normalized);
    this.applyPreferences(normalized);
  }

  getPreferences(): AudioPreferences {
    return { ...this.preferences };
  }

  setMenuMusicAllowed(allowed: boolean): void {
    this.menuMusicAllowed = allowed;
    this.menuMusic?.setEnabled(allowed);
  }

  consumeWorld(world: WorldState, localEntityId: string | null): void {
    if (!this.context || !this.gameplayGain) {
      return;
    }

    this.ensureSkatingSource();
    this.consumeEvents(world);
    this.updateSkatingMix(world, localEntityId);
  }

  resetEventCursor(): void {
    this.consumedEventIds.clear();
    // The next snapshot may carry the sim's retained event backlog (e.g. the
    // ~5s window replayed to a reconnecting client); swallow it silently so
    // rejoining never fires a burst of stale sounds.
    this.suppressBacklogOnNextConsume = true;
    this.announcerEpoch += 1;
    this.announcerBusy = false;
    this.announcerQueue.clear();
    this.stopAnnouncerSources();
    this.clearAnnouncerTimer();
    this.cancelSpeech();
    this.silenceSkating();
  }

  dispose(): void {
    this.menuMusic?.dispose();
    this.menuMusic = null;

    if (typeof window !== "undefined" && this.resumeListener) {
      window.removeEventListener("pointerdown", this.resumeListener);
    }

    this.resumeListener = null;

    if (this.context) {
      void this.context.close().catch(() => {
        // Ignore shutdown failures.
      });
    }

    this.context = null;
    this.masterGain = null;
    this.announcerGain = null;
    this.gameplayGain = null;
    this.musicGain = null;
    this.skatingGain = null;
    this.skatingFilter = null;
    this.skatingSource = null;
    this.announcerQueue.clear();
    this.stopAnnouncerSources();
    this.clearAnnouncerTimer();
    this.cancelSpeech();
    this.announcerEpoch += 1;
    this.announcerBusy = false;
    this.diagnostics = {
      ...this.diagnostics,
      contextAvailable: false,
      contextState: "closed"
    };
    this.consumedEventIds.clear();
    this.started = false;
  }

  private applyPreferences(preferences: AudioPreferences): void {
    if (this.masterGain) {
      this.masterGain.gain.value = 1;
    }

    if (this.announcerGain) {
      this.announcerGain.gain.value = preferences.announcer;
    }

    if (this.gameplayGain) {
      this.gameplayGain.gain.value = preferences.gameplay;
    }

    if (this.musicGain) {
      this.musicGain.gain.value = preferences.music;
    }
  }

  private ensureSkatingSource(): void {
    if (!this.context || !this.gameplayGain || this.skatingSource) {
      return;
    }

    const skatingGain = this.context.createGain();
    skatingGain.gain.setValueAtTime(0, this.context.currentTime);
    skatingGain.connect(this.gameplayGain);

    const skatingFilter = this.context.createBiquadFilter();
    skatingFilter.type = "lowpass";
    skatingFilter.frequency.setValueAtTime(360, this.context.currentTime);
    skatingFilter.Q.setValueAtTime(0.35, this.context.currentTime);

    const skatingSource = this.context.createBufferSource();
    skatingSource.buffer = createSkatingBuffer(this.context);
    skatingSource.loop = true;
    skatingSource.playbackRate.setValueAtTime(0.85, this.context.currentTime);
    skatingSource.connect(skatingFilter);
    skatingFilter.connect(skatingGain);
    skatingSource.start(this.context.currentTime);

    this.skatingGain = skatingGain;
    this.skatingFilter = skatingFilter;
    this.skatingSource = skatingSource;
  }

  private consumeEvents(world: WorldState): void {
    if (!this.context || !this.gameplayGain) {
      return;
    }

    const liveEventIds = new Set(world.eventQueue.map((event) => event.id));

    if (this.suppressBacklogOnNextConsume) {
      this.suppressBacklogOnNextConsume = false;
      this.consumedEventIds = liveEventIds;
      this.diagnostics = {
        ...this.diagnostics,
        suppressedEventCount:
          this.diagnostics.suppressedEventCount + liveEventIds.size
      };
      return;
    }

    for (const event of world.eventQueue) {
      if (this.consumedEventIds.has(event.id)) {
        this.diagnostics = {
          ...this.diagnostics,
          duplicateEventCount: this.diagnostics.duplicateEventCount + 1
        };
        continue;
      }

      this.consumedEventIds.add(event.id);
      this.diagnostics = {
        ...this.diagnostics,
        processedEventCount: this.diagnostics.processedEventCount + 1
      };
      const cue = gameplayCueForEvent(event);
      if (cue) {
        this.playGameplayCue(cue.id, cue.intensity);
      }

      const announcerCue = announcerCueForEvent(event, world);
      if (announcerCue) {
        if (announcerCue.kind === "goal") {
          this.interruptAnnouncer(announcerCue);
        } else {
          this.announcerQueue.enqueue(announcerCue);
        }
        this.drainAnnouncerQueue();
        this.diagnostics = {
          ...this.diagnostics,
          announcerGoalCount:
            this.diagnostics.announcerGoalCount +
            (announcerCue.kind === "goal" ? 1 : 0),
          announcerPowerupCount:
            this.diagnostics.announcerPowerupCount +
            (announcerCue.kind === "powerup" ? 1 : 0)
        };
      }
    }

    this.consumedEventIds = new Set(
      Array.from(this.consumedEventIds).filter((eventId) => liveEventIds.has(eventId))
    );
  }

  private installDevelopmentInspectionHandle(): void {
    if (typeof window === "undefined" || import.meta.env.PROD) {
      return;
    }

    const manager = this;
    window.__bbhArcadeAudio = Object.freeze({
      start: () => manager.start(),
      getPreferences: () => manager.getPreferences(),
      getMenuMusicState: () => ({
        allowed: manager.menuMusicAllowed,
        active: manager.menuMusicAllowed && manager.menuMusic !== null
      }),
      getBusLevels: () => manager.getBusLevels(),
      getDiagnostics: () => manager.getDiagnostics(),
      runEventCursorSmoke: () => manager.runEventCursorSmoke()
    });
  }

  private runEventCursorSmoke(): AudioDiagnostics {
    if (!this.context || !this.gameplayGain) {
      return this.getDiagnostics();
    }

    const world = createWorld(3, "arcade3v3");
    world.eventQueue = [
      {
        id: "__arcade-audio-smoke-goal__",
        type: "goal",
        atMs: 100,
        sourceSlotId: "home-skater-1"
      },
      {
        id: "__arcade-audio-smoke-powerup__",
        type: "powerupPickup",
        atMs: 100,
        sourceSlotId: "home-skater-1",
        targetSlotId: "speed-boost"
      }
    ];

    this.consumeWorld(world, "home-skater-1");
    this.consumeWorld(world, "home-skater-1");
    return this.getDiagnostics();
  }

  private interruptAnnouncer(cue: NonNullable<ReturnType<typeof announcerCueForEvent>>): void {
    // A goal supersedes whatever is currently talking: cut the active clip or
    // speech, invalidate any in-flight drain, and put the goal in the active slot.
    this.announcerEpoch += 1;
    this.announcerBusy = false;
    this.clearAnnouncerTimer();
    this.stopAnnouncerSources();
    this.cancelSpeech();
    this.announcerQueue.interruptWith(cue);
  }

  private drainAnnouncerQueue(): void {
    if (this.announcerTimer || this.announcerBusy) {
      return;
    }

    const cue = this.announcerQueue.next(getNowMs());
    if (!cue) {
      return;
    }

    this.announcerBusy = true;
    const epoch = this.announcerEpoch;
    void this.playAnnouncerCue(cue).then((cueDurationMs) => {
      if (epoch !== this.announcerEpoch) {
        return;
      }

      this.announcerBusy = false;
      this.announcerTimer = setTimeout(() => {
        this.announcerTimer = null;
        this.drainAnnouncerQueue();
      }, cueDurationMs);
    });
  }

  private async playAnnouncerCue(
    cue: ReturnType<typeof announcerCueForEvent>
  ): Promise<number> {
    if (!cue) {
      return ANNOUNCER_MIN_INTERVAL_MS;
    }

    if (this.announcerAssetLoadPromise) {
      await this.announcerAssetLoadPromise;
    }

    const clipDurationMs = this.playLoadedAnnouncerCue(cue.clipIds);
    if (clipDurationMs !== null) {
      return Math.max(ANNOUNCER_MIN_INTERVAL_MS, clipDurationMs + ANNOUNCER_GAP_MS);
    }

    this.speakAnnouncerCue(cue.text);
    return ANNOUNCER_MIN_INTERVAL_MS;
  }

  /** Returns the total clip duration in ms, or null if assets are unavailable. */
  private playLoadedAnnouncerCue(clipIds: readonly string[]): number | null {
    if (!this.context || !this.announcerGain || clipIds.length === 0) {
      return null;
    }

    const buffers = clipIds.map((clipId) => this.announcerBuffers.get(clipId));
    if (buffers.some((buffer) => !buffer)) {
      return null;
    }

    let startTime = this.context.currentTime + 0.02;
    let totalDurationSeconds = 0;
    for (const buffer of buffers) {
      if (!buffer) {
        return null;
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.announcerGain);
      this.announcerSources.add(source);
      source.onended = () => this.announcerSources.delete(source);
      source.start(startTime);
      startTime += Math.max(0, buffer.duration);
      totalDurationSeconds += Math.max(0, buffer.duration);
    }

    return totalDurationSeconds * 1000;
  }

  private stopAnnouncerSources(): void {
    for (const source of this.announcerSources) {
      try {
        source.stop();
      } catch {
        // Sources that already ended can reject stop(); they are safe to drop.
      }
    }

    this.announcerSources.clear();
  }

  private speakAnnouncerCue(text: string): void {
    if (typeof window === "undefined") {
      return;
    }

    const speechWindow = window as Window & {
      SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
      speechSynthesis?: SpeechSynthesis;
    };
    const Utterance = speechWindow.SpeechSynthesisUtterance;
    const speechSynthesis = speechWindow.speechSynthesis;
    if (!Utterance || !speechSynthesis) {
      return;
    }

    const utterance = new Utterance(text);
    utterance.volume = this.preferences.announcer;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }

  private cancelSpeech(): void {
    if (typeof window === "undefined") {
      return;
    }

    const speechSynthesis = (window as Window & {
      speechSynthesis?: SpeechSynthesis;
    }).speechSynthesis;
    speechSynthesis?.cancel();
  }

  private clearAnnouncerTimer(): void {
    if (this.announcerTimer) {
      clearTimeout(this.announcerTimer);
      this.announcerTimer = null;
    }
  }

  private getBusLevels(): AudioBusLevels {
    return {
      master: readGainLevel(this.masterGain, 1),
      announcer: readGainLevel(this.announcerGain, this.preferences.announcer),
      gameplay: readGainLevel(this.gameplayGain, this.preferences.gameplay),
      music: readGainLevel(this.musicGain, this.preferences.music)
    };
  }

  private getDiagnostics(): AudioDiagnostics {
    return {
      ...this.diagnostics,
      missingAssets: [...this.diagnostics.missingAssets],
      assetErrors: [...this.diagnostics.assetErrors]
    };
  }

  private async loadAssetDiagnostics(): Promise<void> {
    if (typeof fetch !== "function") {
      this.diagnostics = { ...this.diagnostics, manifestStatus: "unavailable" };
      return;
    }

    try {
      const response = await fetch("/audio/manifest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`manifest HTTP ${response.status}`);
      }

      const manifest: unknown = await response.json();
      const validation = validateAnnouncerManifest(manifest);
      const clips = isManifestRecord(manifest) && isManifestRecord(manifest.clips)
        ? manifest.clips
        : {};
      const missingAssets: string[] = [];
      const assetErrors: string[] = [];

      await Promise.all(Object.entries(clips).map(async ([clipId, paths]) => {
        const candidates = Array.isArray(paths)
          ? paths.filter((path): path is string => typeof path === "string")
          : [];
        const result = await this.loadAudioCandidates(clipId, candidates);
        if (!result.available) {
          missingAssets.push(...candidates);
        }
        if (result.error) {
          assetErrors.push(result.error);
        }
      }));

      this.diagnostics = {
        ...this.diagnostics,
        manifestStatus: "loaded",
        manifestCharacterIdsValid: validation.characterIdsValid &&
          validation.missingIds.filter((id) => id.startsWith("announcer.name.")).length === 0 &&
          validation.unexpectedIds.filter((id) => id.startsWith("announcer.name.")).length === 0,
        missingAssets: [...missingAssets].sort(),
        assetErrors: [...assetErrors]
      };
    } catch (error) {
      this.diagnostics = {
        ...this.diagnostics,
        manifestStatus: "failed",
        assetErrors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private async loadAudioCandidates(
    clipId: string,
    candidates: readonly string[]
  ): Promise<{ readonly available: boolean; readonly error: string | null }> {
    let lastError: string | null = null;

    for (const path of candidates) {
      try {
        const response = await fetch(path, { cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("audio/")) {
          continue;
        }

        if (clipId.startsWith("announcer.") && this.context) {
          const encoded = await response.arrayBuffer();
          const decoded = await this.context.decodeAudioData(encoded);
          this.announcerBuffers.set(clipId, decoded);
        }

        return { available: true, error: null };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return { available: false, error: lastError };
  }

  private silenceSkating(): void {
    // The skating loop's gain is only driven while consumeWorld runs; when a
    // screen change stops the world feed the loop would otherwise keep playing
    // at its last level (e.g. exiting Free Skate at speed).
    if (!this.context || !this.skatingGain) {
      return;
    }

    this.skatingGain.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
  }

  private updateSkatingMix(world: WorldState, localEntityId: string | null): void {
    if (!this.context || !this.skatingGain || !this.skatingSource) {
      return;
    }

    const localSkater =
      localEntityId === null
        ? null
        : world.skaters.find((skater) => skater.id === localEntityId) ?? null;
    const speed =
      localSkater === null
        ? 0
        : Math.hypot(localSkater.velocity.x, localSkater.velocity.y);
    const mix = skatingMixForSpeed(speed);

    this.skatingGain.gain.setTargetAtTime(mix.gain, this.context.currentTime, 0.03);
    this.skatingSource.playbackRate.setTargetAtTime(
      mix.playbackRate,
      this.context.currentTime,
      0.04
    );
  }

  private playGameplayCue(id: string, intensity: number): void {
    if (!this.context || !this.gameplayGain) {
      return;
    }

    const startTime = this.context.currentTime;
    switch (id) {
      case "hit":
        scheduleNoiseBurst(this.context, {
          destination: this.gameplayGain,
          startTime,
          duration: 0.08,
          gain: 0.14 + intensity * 0.24
        });
        break;
      case "knockdown":
        scheduleNoiseBurst(this.context, {
          destination: this.gameplayGain,
          startTime,
          duration: 0.12,
          gain: 0.22
        });
        break;
      case "save-pad":
      case "save-body":
      case "save-cover":
      case "shot":
      case "block":
      case "poke":
      case "jostle":
      case "bounce-back":
        scheduleNoiseBurst(this.context, {
          destination: this.gameplayGain,
          startTime,
          duration: 0.06,
          gain: 0.16
        });
        break;
      case "save-glove":
      case "save-blocker":
      case "one-timer":
      case "post":
        scheduleTone(this.context, {
          destination: this.gameplayGain,
          frequency: id === "post" ? 1120 : 760,
          startTime,
          duration: 0.1,
          gain: 0.12,
          type: "triangle"
        });
        break;
      default:
        break;
    }
  }
}

export const audioManager: AudioManagerApi = new AudioManager();

const ANNOUNCER_MIN_INTERVAL_MS = 1500;
const ANNOUNCER_GAP_MS = 250;

function createInitialDiagnostics(): AudioDiagnostics {
  return {
    contextAvailable: false,
    contextState: "unavailable",
    manifestStatus: "pending",
    manifestCharacterIdsValid: null,
    missingAssets: [],
    assetErrors: [],
    processedEventCount: 0,
    duplicateEventCount: 0,
    suppressedEventCount: 0,
    announcerGoalCount: 0,
    announcerPowerupCount: 0
  };
}

function readGainLevel(gain: GainNode | null, fallback: number): number {
  const value = gain?.gain.value;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getContextState(context: AudioContext | null): string {
  const state = context?.state;
  return typeof state === "string" ? state : context ? "available" : "unavailable";
}

function getNowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function isManifestRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAudioPreferences(
  preferences: AudioPreferences
): AudioPreferences {
  return {
    announcer: normalizeAudioBusLevel(
      preferences.announcer,
      DEFAULT_AUDIO_PREFERENCES.announcer
    ),
    gameplay: normalizeAudioBusLevel(
      preferences.gameplay,
      DEFAULT_AUDIO_PREFERENCES.gameplay
    ),
    music: normalizeAudioBusLevel(
      preferences.music,
      DEFAULT_AUDIO_PREFERENCES.music
    )
  };
}

function normalizeAudioBusLevel(value: number, fallback: number): number {
  return Number.isFinite(value) ? clampAudioLevel(value) : fallback;
}
