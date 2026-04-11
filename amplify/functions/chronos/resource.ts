import { defineFunction } from "@aws-amplify/backend";

/**
 * Time management and scheduling function
 */
export const chronos = defineFunction({
  name: "getChronos",
  entry: "./handler.ts",
  runtime: 18,
  bundling: {
    minify: true
  },
});