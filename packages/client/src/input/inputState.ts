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

  gather(): InputState {
    const input = neutralInput();
    // While the controls menu is open, swallow input so rebinding keystrokes
    // don't fire actions in the live match behind it.
    if (controls.suspended) return input;

    const kb = controls.keyboard;
    const gp = readGamepad(controls.gamepad);
    const down = (tokens: string[]): boolean => tokens.some((t) => this.km.isDown(t));

    // movement
    let mx = 0;
    let mz = 0;
    if (down(kb.moveRight)) mx += 1;
    if (down(kb.moveLeft)) mx -= 1;
    if (down(kb.moveUp)) mz += 1;
    if (down(kb.moveDown)) mz -= 1;
    if (gp.connected && (gp.moveX || gp.moveZ)) {
      mx = gp.moveX;
      mz = gp.moveZ;
    }
    // The broadcast camera views the ice from the -Z side, which mirrors the X
    // axis on screen. Invert X so pressing left/right (or tilting the stick)
    // moves the skater the way the player sees it. Mouse aim is already in world
    // space from the ice raycast, so it needs no correction here.
    mx = -mx;
    input.move = { x: mx, z: mz };

    // aim: gamepad right stick > mouse > movement direction
    if (gp.connected && (gp.aimX || gp.aimZ)) {
      input.aim = { x: -gp.aimX, z: gp.aimZ };
    } else if (this.mouseAim) {
      input.aim = this.mouseAim;
    } else {
      input.aim = v.len({ x: mx, z: mz }) > 0 ? { x: mx, z: mz } : { x: 0, z: 0 };
    }

    input.actions = {
      shoot: gp.shoot || down(kb.shoot),
      pass: gp.pass || down(kb.pass),
      hit: gp.hit || down(kb.hit),
      steal: gp.steal || down(kb.steal),
      ult: gp.ult || down(kb.ult),
      deke: gp.deke || down(kb.deke),
      poke: gp.poke || down(kb.poke),
    };
    return input;
  }
}

export const inputManager = new InputManager();
