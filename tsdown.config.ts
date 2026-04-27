import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  dts: {
    tsgo: true,
  },
  deps: {
    alwaysBundle: ["yaml", "tinyglobby"],
  },
  exports: true,
  // ...config options
});
