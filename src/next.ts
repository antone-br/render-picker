type NextConfigObject = { env?: Record<string, string | undefined> } & Record<
  string,
  unknown
>;
type NextConfigFn<C> = (...args: never[]) => C | Promise<C>;

function inject<C extends NextConfigObject>(config: C): C {
  // Racine projet absolue — dev only (Ctrl+clic → VS Code).
  // Jamais injectée en prod (pas de fuite de chemin local dans le bundle).
  if (process.env.NODE_ENV === "production") return config;
  return {
    ...config,
    env: { ...config.env, NEXT_PUBLIC_PROJECT_ROOT: process.cwd() },
  };
}

/**
 * Wrap `next.config` : expose `NEXT_PUBLIC_PROJECT_ROOT` au client hors production.
 * Accepte un objet ou une fonction `(phase, ctx) => config`.
 */
export function withRenderPicker<C extends NextConfigObject>(config: C): C;
export function withRenderPicker<C extends NextConfigObject, F extends NextConfigFn<C>>(
  config: F,
): F;
export function withRenderPicker(
  config: NextConfigObject | NextConfigFn<NextConfigObject>,
): unknown {
  if (typeof config === "function") {
    return async (...args: never[]) => inject(await config(...args));
  }
  return inject(config);
}
