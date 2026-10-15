/** Models verified against isolated execution of the original palette routines. */
export function fadePaletteFrame(source: Buffer, step: number): Buffer {
  if (source.length !== 768 || source.some((value) => value > 63))
    throw new Error('Expected 256 RGB6 colors');
  if (!Number.isInteger(step) || step < 0 || step > 32) throw new Error('Fade step must be 0..32');
  // Original calls use AX=32. The 8.8 accumulator step is exactly value*8.
  return Buffer.from(source.map((value) => (value * 256 - value * 8 * step) >>> 8));
}

export type SelectorState = { countdown: number; nextColor: number };
export function advanceSelector(
  state: SelectorState,
  carry: boolean,
): { state: SelectorState; tableIndex?: number } {
  if (
    !Number.isInteger(state.countdown) ||
    state.countdown < 0 ||
    state.countdown > 65535 ||
    !Number.isInteger(state.nextColor) ||
    state.nextColor < 0 ||
    state.nextColor >= 24
  ) {
    throw new Error('Invalid selector state');
  }
  const countdown = (state.countdown - 1) & 65535;
  // DEC preserves CF; original JA skips only when CF=0 AND ZF=0.
  if (!carry && countdown !== 0) return { state: { ...state, countdown } };
  return {
    state: { countdown: 4, nextColor: (state.nextColor + 1) % 24 },
    tableIndex: state.nextColor,
  };
}
