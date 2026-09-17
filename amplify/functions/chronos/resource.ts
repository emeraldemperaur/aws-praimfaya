import { defineFunction } from "@aws-amplify/backend";

/**
 * Time management and scheduling function
 */
export const chronos = defineFunction({
  name: "getChronos",
  entry: "./handler.ts",
  resourceGroupName: 'data',
  runtime: 24,
  timeoutSeconds: 30,
  bundling: {
    minify: true
  },
});