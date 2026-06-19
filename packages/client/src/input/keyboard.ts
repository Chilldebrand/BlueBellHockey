// Tracks raw keyboard + mouse-button state. Raw axes are W=+Z (away), S=-Z,
// A=-X, D=+X; InputManager.gather() then inverts X to match the broadcast
// camera (which views the ice from -Z and mirrors X on screen).
export class KeyboardMouse {
  private keys = new Set<string>();
  private mouseButtons = new Set<number>();

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContext);
  }
  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContext);
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseDown = (e: MouseEvent) => this.mouseButtons.add(e.button);
  private onMouseUp = (e: MouseEvent) => this.mouseButtons.delete(e.button);
  private onContext = (e: Event) => e.preventDefault();

  key(code: string): boolean {
    return this.keys.has(code);
  }
  mouse(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  // Resolves a binding token: "Mouse0"/"Mouse1"/"Mouse2" hit the mouse-button
  // set, anything else is a KeyboardEvent.code.
  isDown(token: string): boolean {
    if (token.startsWith('Mouse')) return this.mouseButtons.has(Number(token.slice(5)));
    return this.keys.has(token);
  }
}
