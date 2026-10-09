import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  target: "es2020",
  external: ["react", "react-dom", "next"],
};

export default defineConfig([
  {
    ...shared,
    // Entrées navigateur : "use client" pour l'App Router.
    entry: { index: "src/index.ts", client: "src/client.ts", react: "src/react.tsx" },
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    // Helper next.config (Node) : pas de directive client.
    entry: { next: "src/next.ts" },
  },
]);
