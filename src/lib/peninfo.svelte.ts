/** What the pen details card shows. */
export interface PenDetails {
  code: string;
  name: string;
  hex: string;
  brand?: string;
  range?: string;
  /** Former code, for renumbered pens. */
  alt?: string;
}

/**
 * The one pen details card of the app: shown while hovering a swatch (mouse) or after a long
 * press (touch), anchored to the swatch.
 */
class PenInfo {
  details = $state<PenDetails | null>(null);
  anchor = $state<DOMRect | null>(null);

  show(details: PenDetails, el: Element) {
    this.details = details;
    this.anchor = el.getBoundingClientRect();
  }

  hide() {
    this.details = null;
  }
}

export const penInfo = new PenInfo();

const HOVER_DELAY = 350;
const PRESS_DELAY = 450;

/**
 * Pointer handling for a swatch. Returns handlers to spread on the element and `suppressClick`,
 * which is true right after a long press so the press doesn't also pick the pen.
 */
export function detailsTrigger(get: () => PenDetails | undefined) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let pressed = false;

  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    get suppressClick() {
      return pressed;
    },
    handlers: {
      onpointerenter(e: PointerEvent) {
        const d = get();
        if (!d || e.pointerType !== 'mouse') return;
        const el = e.currentTarget as Element;
        clear();
        timer = setTimeout(() => penInfo.show(d, el), HOVER_DELAY);
      },
      onpointerleave(e: PointerEvent) {
        if (e.pointerType !== 'mouse') return;
        clear();
        penInfo.hide();
      },
      onpointerdown(e: PointerEvent) {
        pressed = false;
        const d = get();
        if (!d || e.pointerType === 'mouse') return;
        const el = e.currentTarget as Element;
        start = { x: e.clientX, y: e.clientY };
        clear();
        timer = setTimeout(() => {
          pressed = true;
          navigator.vibrate?.(10);
          penInfo.show(d, el);
        }, PRESS_DELAY);
      },
      onpointermove(e: PointerEvent) {
        // Scrolling the list is not a long press
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) clear();
      },
      onpointerup() {
        clear();
        start = null;
      },
      onpointercancel() {
        clear();
        start = null;
      },
      oncontextmenu(e: Event) {
        if (get()) e.preventDefault();
      }
    }
  };
}
