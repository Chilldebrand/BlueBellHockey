import { neutralInput, v, type InputState } from '@bbh/shared';
import { KeyboardMouse } from './keyboard.js';
import { readGamepad } from './gamepad.js';

// Folds keyboard/mouse + gamepad into one normalized InputState each frame.
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
    const gp = readGamepad();

    // movement
    let mx = 0;
    let mz = 0;
    if (this.km.key('KeyD') || this.km.key('ArrowRight')) mx += 1;
    if (this.km.key('KeyA') || this.km.key('ArrowLeft')) mx -= 1;
    if (this.km.key('KeyW') || this.km.key('ArrowUp')) mz += 1;
    if (this.km.key('KeyS') || this.km.key('ArrowDown')) mz -= 1;
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
      shoot: gp.shoot || this.km.mouse(0) || this.km.key('KeyJ'),
      pass: gp.pass || this.km.mouse(2) || this.km.key('KeyK'),
      hit: gp.hit || this.km.key('ShiftLeft') || this.km.key('KeyL'),
      steal: gp.steal || this.km.key('KeyF'),
      ult: gp.ult || this.km.key('Space') || this.km.key('KeyE'),
      deke: gp.deke || this.km.key('KeyQ'),
    };
    return input;
  }
}

export const inputManager = new InputManager();
