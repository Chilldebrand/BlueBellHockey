export interface RinkConfig {
  readonly width: number;
  readonly height: number;
  readonly goalLineOffset: number;
  readonly goalWidth: number;
}

export const RINK_CONFIG: RinkConfig = {
  width: 2000,
  height: 1000,
  goalLineOffset: 80,
  goalWidth: 220
};
