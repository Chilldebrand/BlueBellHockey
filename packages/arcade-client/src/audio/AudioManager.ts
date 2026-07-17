import type { WorldState } from "@bbh/arcade-core";
import { MenuMusic } from "./music.js";
import {
  clampAudioLevel,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences
} from "./preferences.js";
import { createAudioContext, safeResume } from "./synth.js";

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

  consumeWorld(_world: WorldState, _localEntityId: string | null): void {
    // Event-driven gameplay audio arrives in a later task.
  }

  resetEventCursor(): void {
    // Event-driven gameplay audio arrives in a later task.
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
