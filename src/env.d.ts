// Rspack's require.context: lets Root.tsx find every videos/<slug>/spec.json at bundle time.
declare namespace NodeJS {
  interface Require {
    context(
      directory: string,
      useSubdirectories: boolean,
      regExp: RegExp,
    ): { keys(): string[]; (id: string): unknown };
  }
}
