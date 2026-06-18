import { emptyActions, neutralInput, type ActionFlags, type InputState, type Vec2 } from '@bbh/shared';

const AXIS_MIN = -1;
const AXIS_MAX = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function axis(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(AXIS_MIN, Math.min(AXIS_MAX, value))
    : 0;
}

function vec(value: unknown): Vec2 {
  if (!isRecord(value)) return { x: 0, z: 0 };
  return { x: axis(value.x), z: axis(value.z) };
}

function actions(value: unknown): ActionFlags {
  const base = emptyActions();
  if (!isRecord(value)) return base;
  return {
    shoot: value.shoot === true,
    pass: value.pass === true,
    hit: value.hit === true,
    steal: value.steal === true,
    ult: value.ult === true,
    deke: value.deke === true,
  };
}

export function sanitizeClientInput(value: unknown): InputState {
  const input = neutralInput();
  if (!isRecord(value)) return input;
  return {
    move: vec(value.move),
    aim: vec(value.aim),
    actions: actions(value.actions),
  };
}

export function sanitizeInputSeq(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
