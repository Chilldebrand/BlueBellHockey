import { neutralInput, v, type InputState } from '@bbh/shared';
import { KeyboardMouse } from './keyboard.js';
import { readGamepad } from './gamepad.js';
import { controls } from './bindings.js';

// Folds keyboard/mouse + gamepad into one normalized InputState each frame,
// using the player's (possibly customized) bindings from `controls`.
export class InputManager {
  private km = new KeyboardMouse();
  /** world-space aim direction set by the renderer from the mouse->ice raycast */
  mouseAim: { x: number; z: number } | null = null;

  attach(): void {
    this.km.attach();
  }
  detach(): void {
    this.km.detach();
  }

  gather(opts: { hasPuck?: boolean } = {}): InputState {
    const input = neutralInput();
    // While the controls menu is open, swallow input so rebinding keystrokes
    // don't fire actions in the live match behind it.
    if (controls.suspended) return input;

    const kb = controls.keyboard;
    const gp = readGamepad(controls.gamepad);
    const down = (tokens: string[]): boolean => tokens.some((t) => this.km.isDown(t));

    // movement in screen space for the north-south camera
    let screenX = 0;
    let screenY = 0;
    if (down(kb.moveRight)) screenX += 1;
    if (down(kb.moveLeft)) screenX -= 1;
    if (down(kb.moveUp)) screenY += 1;
    if (down(kb.moveDown)) screenY -= 1;
    if (gp.connected && (gp.moveX || gp.moveZ)) {
      screenX = gp.moveX;
      screenY = gp.moveZ;
    }
    if (gp.connected) {
      input.shotPlacement = Math.max(-1, Math.min(1, gp.moveX));
    }
    input.lowShot = (gp.connected && gp.aimZ < -0.6) || down(['ShiftLeft', 'ShiftRight']);
    // The north-south camera looks from the -X end toward +X, so screen up/down
    // is rink X and screen right/left is +/- rink Z. Mouse aim is already in
    // world space from the ice raycast, so it needs no correction here.
    const mx = screenY;
    const mz = screenX;
    input.move = { x: mx, z: mz };

    // aim: gamepad right stick > mouse > movement direction
    if (gp.connected && (gp.aimX || gp.aimZ)) {
      input.aim = { x: gp.aimZ, z: gp.aimX };
    } else if (this.mouseAim) {
      input.aim = this.mouseAim;
    } else {
      input.aim = v.len({ x: mx, z: mz }) > 0 ? { x: mx, z: mz } : { x: 0, z: 0 };
    }

    input.actions = {
      shoot: gp.shoot || down(kb.shoot),
      pass: gp.pass || down(kb.pass),
      hit: gp.hit || (!opts.hasPuck && gp.hitGesture) || down(kb.hit),
      steal: gp.steal || down(kb.steal),
      ult: gp.ult || down(kb.ult),
      deke: gp.deke || down(kb.deke),
      poke: gp.poke || down(kb.poke),
      sprint: gp.sprint || down(kb.sprint),
      switchPlayer: gp.switchPlayer || down(kb.switchPlayer),
    };
    return input;
  }
}

export const inputManager = new InputManager();
