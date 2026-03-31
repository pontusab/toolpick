import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/eval/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
});
