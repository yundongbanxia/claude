/**
 * Keyboard + mouse input with action mapping, pointer lock, and a virtual
 * override layer so automated tests can drive the game.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'sprint' | 'aim' | 'fire' | 'reload'
  | 'interact' | 'knife' | 'crouch' | 'grenade' | 'heal'
  | 'inventory' | 'pause'
  | 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7' | 'slot8';

const KEY_MAP: Record<string, Action> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyR: 'reload',
  KeyF: 'interact', KeyE: 'interact', Space: 'interact',
  KeyQ: 'knife', KeyV: 'knife',
  KeyC: 'crouch',
  KeyG: 'grenade',
  KeyH: 'heal',
  Tab: 'inventory', KeyI: 'inventory',
  Escape: 'pause', KeyP: 'pause',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4',
  Digit5: 'slot5', Digit6: 'slot6', Digit7: 'slot7', Digit8: 'slot8',
};

export class Input {
  private down = new Set<Action>();
  private pressedSet = new Set<Action>();
  private releasedSet = new Set<Action>();
  private virtualDown = new Set<Action>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /** When false, gameplay ignores mouse look (menus open). */
  enabled = true;
  onLockChange: ((locked: boolean) => void) | null = null;
  onAnyKey: ((e: KeyboardEvent) => void) | null = null;
  private canvas: HTMLElement;
  /** Tests run without pointer lock. */
  allowUnlocked = false;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    canvas.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.allowUnlocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.down.delete('fire');
        this.down.delete('aim');
      }
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = (this.canvas as any).requestPointerLock?.({ unadjustedMovement: true });
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          try {
            (this.canvas as any).requestPointerLock?.();
          } catch {
            /* ignore */
          }
        });
      }
    } catch {
      /* ignore */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onKey(e: KeyboardEvent, isDown: boolean) {
    if (isDown) this.onAnyKey?.(e);
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (isDown) {
      if (!this.down.has(action)) this.pressedSet.add(action);
      this.down.add(action);
    } else {
      if (this.down.has(action)) this.releasedSet.add(action);
      this.down.delete(action);
    }
  }

  private onMouse(e: MouseEvent, isDown: boolean) {
    const action: Action | null = e.button === 0 ? 'fire' : e.button === 2 ? 'aim' : e.button === 1 ? 'knife' : null;
    if (!action) return;
    if (isDown && !this.locked && !this.allowUnlocked) return; // first click just locks
    if (isDown) {
      if (!this.down.has(action)) this.pressedSet.add(action);
      this.down.add(action);
    } else {
      if (this.down.has(action)) this.releasedSet.add(action);
      this.down.delete(action);
    }
  }

  isDown(a: Action): boolean {
    return this.down.has(a) || this.virtualDown.has(a);
  }
  pressed(a: Action): boolean {
    return this.pressedSet.has(a);
  }
  released(a: Action): boolean {
    return this.releasedSet.has(a);
  }
  /** Consume a press so other systems don't also react. */
  consume(a: Action) {
    this.pressedSet.delete(a);
  }

  /** Virtual input for tests / scripted sequences. */
  setVirtual(a: Action, v: boolean) {
    if (v) {
      if (!this.isDown(a)) this.pressedSet.add(a);
      this.virtualDown.add(a);
    } else {
      if (this.virtualDown.has(a)) this.releasedSet.add(a);
      this.virtualDown.delete(a);
    }
  }
  tap(a: Action) {
    this.pressedSet.add(a);
    this.releasedSet.add(a);
  }

  clearAll() {
    this.down.clear();
    this.virtualDown.clear();
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouseDX = this.mouseDY = this.wheel = 0;
  }

  /** Call at end of each frame. */
  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
