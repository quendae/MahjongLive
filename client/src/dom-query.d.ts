export {};

declare global {
  interface Document {
    querySelector<E extends Element = Element>(selectors: string): E | null;
  }
}
