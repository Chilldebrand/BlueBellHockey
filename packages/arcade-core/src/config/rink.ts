export interface RinkConfig {
  readonly width: number;
  readonly height: number;
  /** Radius of the rounded board corners (a real rink is not a rectangle). */
  readonly cornerRadius: number;
  readonly goalLineOffset: number;
  readonly goalWidth: number;
}

export const RINK_CONFIG: RinkConfig = {
  width: 2000,
  height: 1000,
  cornerRadius: 310,
  goalLineOffset: 80,
  goalWidth: 220
};
