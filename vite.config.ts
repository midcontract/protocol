/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";
import pkg from "./package.json";

const packageName = () => {
  return pkg.name.replace('@', '').replace('/', '-');
};

const packageNameToCamelCase = () => {
  try {
    return packageName().split('-').map((c) => (c[0]||'').toUpperCase()).join('');
  } catch (err) {
    throw new Error("Name property in package.json is missing.");
  }
};

const fileName = {
  es: `${packageName()}.mjs`,
  cjs: `${packageName()}.cjs`,
};

const formats = Object.keys(fileName) as Array<keyof typeof fileName>;

module.exports = defineConfig({
  base: "./",
  build: {
    outDir: "./dist",
    lib: {
      entry: path.resolve(__dirname, "sdk/index.ts"),
      name: packageNameToCamelCase(),
      formats,
      fileName: format => fileName[format as keyof typeof fileName],
    },
  },
  test: {},
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "sdk") },
    ],
  },
});
