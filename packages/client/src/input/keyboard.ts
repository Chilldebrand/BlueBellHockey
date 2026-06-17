// Tracks raw keyboard + mouse-button state. World-relative controls (fixed
// broadcast camera): W=+Z (away), S=-Z, A=-X, D=+X.
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
}
