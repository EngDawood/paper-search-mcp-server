// Test-only typings (no @types/node in this project).
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { run(...p: unknown[]): unknown; all(...p: unknown[]): Record<string, unknown>[] };
  }
}
declare module "*.sql?raw" {
  const sql: string;
  export default sql;
}
