export function nextHudSelection(
  selected: number,
  direction: number,
  cells: { blocked?: boolean }[],
) {
  const length = cells.length;
  if (!length) return 0;
  for (let step = 1; step <= length; step++) {
    const index = (((selected + direction * step) % length) + length) % length;
    if (!cells[index].blocked) return index;
  }
  return Math.min(selected, length - 1);
}

export function hudKeyboardCommand(key: string, open: boolean, shift = false) {
  if (!open) return key === 'Enter' || key === ' ' ? 'open' : null;
  if (key === 'Escape' || key === 'Backspace') return 'back';
  if (key === 'Enter' || key === ' ') return 'select';
  if (key === 'ArrowLeft' || key === 'ArrowUp' || (key === 'Tab' && shift)) return 'previous';
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'Tab') return 'next';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}
