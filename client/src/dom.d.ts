export {};

declare global {
  interface Document {
    /** index.html guarantees this root; main.ts also keeps a runtime guard for malformed hosts. */
    querySelector<E extends Element = HTMLDivElement>(selectors: '#app'): E;
  }
}
