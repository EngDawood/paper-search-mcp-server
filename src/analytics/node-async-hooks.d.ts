// Minimal typing for the one Node API we use (available via the nodejs_compat flag); avoids adding @types/node.
declare module "node:async_hooks" {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: () => R): R;
    getStore(): T | undefined;
  }
}
