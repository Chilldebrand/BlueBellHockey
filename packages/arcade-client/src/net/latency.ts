export interface LatencyProfile {
  readonly baseMs: number;
  readonly jitterMs: number;
  readonly packetLossRate: number;
}

export interface ScheduledNetworkMessage<TMessage> {
  readonly message: TMessage;
  readonly deliverAtMs: number;
  readonly dropped: boolean;
}

export const DEFAULT_LATENCY_PROFILE: LatencyProfile = {
  baseMs: 80,
  jitterMs: 35,
  packetLossRate: 0
};

export function scheduleNetworkMessage<TMessage>(
  message: TMessage,
  sentAtMs: number,
  sequence: number,
  profile: LatencyProfile = DEFAULT_LATENCY_PROFILE
): ScheduledNetworkMessage<TMessage> {
  const jitter = deterministicUnit(sequence, 17) * profile.jitterMs;
  const dropped =
    profile.packetLossRate > 0 &&
    deterministicUnit(sequence, 71) < profile.packetLossRate;

  return {
    message,
    deliverAtMs: Math.max(sentAtMs, sentAtMs + profile.baseMs + jitter),
    dropped
  };
}

function deterministicUnit(sequence: number, salt: number): number {
  const raw = Math.sin((sequence + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}
