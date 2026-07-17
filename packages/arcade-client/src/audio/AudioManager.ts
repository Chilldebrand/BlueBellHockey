import type { WorldState } from "@bbh/arcade-core";
import { MenuMusic } from "./music.js";
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
  createNoiseBuffer,
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
  private skatingSource: AudioBufferSourceNode | null = null;
  private consumedEventIds = new Set<string>();

  constructor() {
    this.preferences = loadAudioPreferences();
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.context = createAudioContext();

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
  }

  setPreferences(preferences: AudioPreferences): void {
    const normalized = normalizeAudioPreferences(preferences);

    this.preferences = normalized;
    saveAudioPreferences(normalized);
    this.applyPreferences(normalized);
  }

  getPreferences(): AudioPreferences {
    return this.preferences;
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
    this.consumeGameplayEvents(world);
    this.updateSkatingMix(world, localEntityId);
  }

  resetEventCursor(): void {
    this.consumedEventIds.clear();
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
    this.skatingSource = null;
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

    const skatingSource = this.context.createBufferSource();
    skatingSource.buffer = createNoiseBuffer(this.context);
    skatingSource.loop = true;
    skatingSource.playbackRate.setValueAtTime(0.85, this.context.currentTime);
    skatingSource.connect(skatingGain);
    skatingSource.start(this.context.currentTime);

    this.skatingGain = skatingGain;
    this.skatingSource = skatingSource;
  }

  private consumeGameplayEvents(world: WorldState): void {
    if (!this.context || !this.gameplayGain) {
      return;
    }

    const liveEventIds = new Set(world.eventQueue.map((event) => event.id));

    for (const event of world.eventQueue) {
      if (this.consumedEventIds.has(event.id)) {
        continue;
      }

      this.consumedEventIds.add(event.id);
      const cue = gameplayCueForEvent(event);
      if (!cue) {
        continue;
      }

      this.playGameplayCue(cue.id, cue.intensity);
    }

    this.consumedEventIds = new Set(
      Array.from(this.consumedEventIds).filter((eventId) => liveEventIds.has(eventId))
    );
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
