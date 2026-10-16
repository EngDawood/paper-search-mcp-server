// Vite `?raw` imports: test fixtures loaded as strings.
declare module "*?raw" {
  const content: string;
  export default content;
}
