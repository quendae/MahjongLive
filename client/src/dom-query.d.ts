export {};

declare global {
  interface Document {
    querySelector<E extends Element = HTMLDivElement>(selectors: '#table-3d-stage'): E;
    querySelector<E extends Element = Element>(selectors: string): E | null;
  }
}
