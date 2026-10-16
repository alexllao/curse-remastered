/** Submenús compartidos del selector DOS. Los objetos y efectos los aporta cada sala. */
export interface ActionCommand {
  kind: 'take' | 'look' | 'talk' | 'fight' | 'jump' | 'use' | 'disk' | 'info';
  item?: number;
  other?: number;
  verb?: number;
}
export interface MenuSource {
  inventory(): number[];
  nearby(mask: number): number[];
  vocabulary(): number[];
  icon(item: number): number;
  blocked(): boolean;
  execute(command: ActionCommand): void;
}
export interface ActionCell {
  icon: number;
  value: number;
  blocked?: boolean;
}
export class OriginalActionMenu {
  private mode:
    | 'main'
    | 'inventory'
    | 'take'
    | 'look'
    | 'talk'
    | 'verbs'
    | 'targets'
    | 'fight'
    | 'jump'
    | 'disk' = 'main';
  private verb = 0;
  private first: number | undefined;
  private choosingInventory = false;
  private source: MenuSource;
  constructor(source: MenuSource) {
    this.source = source;
  }
  reset() {
    this.mode = 'main';
    this.first = undefined;
    this.choosingInventory = false;
  }
  cells(): ActionCell[] {
    const item = (id: number): ActionCell => ({
      icon: this.source.icon(id),
      value: id,
      blocked: id === this.first,
    });
    switch (this.mode) {
      case 'main':
        return Array.from({ length: 10 }, (_, i) => ({
          icon: i,
          value: i,
          blocked: this.source.blocked() && (i === 1 || i === 2),
        }));
      case 'inventory':
      case 'fight':
        return this.source.inventory().map(item);
      case 'take':
        return this.source.nearby(2).map(item);
      case 'look':
      case 'jump':
        return this.source.nearby(this.mode === 'jump' ? 5 : 1).map(item);
      case 'talk':
        return this.source.vocabulary().map((id) => ({ icon: 23 + id, value: id }));
      case 'verbs':
        return Array.from({ length: 8 }, (_, i) => ({ icon: 15 + i, value: i }));
      case 'disk':
        return [10, 11, 12].map((i) => ({ icon: i, value: i - 10 }));
      case 'targets':
        return this.choosingInventory
          ? this.source.inventory().map(item)
          : [
              ...(this.verb === 1 || this.verb === 6 ? [] : [{ icon: 0, value: -1 }]),
              ...this.source.nearby(1).map(item),
            ].slice(0, 10);
    }
  }
  /** true: la acción termina el selector; false: se dibuja el submenú resultante. */
  select(index: number): boolean {
    const cell = this.cells()[index];
    if (!cell || cell.blocked) return false;
    const value = cell.value;
    switch (this.mode) {
      case 'main':
        this.mode = (
          [
            'inventory',
            'take',
            'verbs',
            'look',
            'talk',
            'fight',
            'jump',
            'disk',
            'main',
            'main',
          ] as const
        )[value];
        if (value === 9) {
          this.source.execute({ kind: 'info' });
          return true;
        }
        return false;
      case 'inventory':
        this.reset();
        return false;
      case 'verbs':
        this.verb = value;
        this.first = undefined;
        this.mode = 'targets';
        this.choosingInventory = [1, 3, 4, 5, 6, 7].includes(value);
        return false;
      case 'targets':
        if (value === -1) {
          this.choosingInventory = true;
          return false;
        }
        if (this.first === undefined && this.verb !== 2) {
          this.first = value;
          this.choosingInventory = false;
          return false;
        }
        this.source.execute({ kind: 'use', verb: this.verb, item: value, other: this.first });
        return true;
      default:
        this.source.execute({ kind: this.mode, item: value });
        return true;
    }
  }
}
