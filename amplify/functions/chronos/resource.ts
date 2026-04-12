import { defineFunction } from "@aws-amplify/backend";

/**
 * Time management and scheduling function
 */
export const chronos = defineFunction({
  name: "getChronos",
  entry: "./handler.ts",
  runtime: 24,
  bundling: {
    minify: true
  },
});