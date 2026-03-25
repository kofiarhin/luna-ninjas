// jest.config.js
// Root Jest configuration.

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  // Pick up test files in server/tests and client/src/utils
  testMatch: [
    "**/server/tests/**/*.test.js",
    "**/client/src/utils/**/*.test.js",
  ],
  // Do not transform any files — all test files must be CJS compatible
  transformIgnorePatterns: ["/node_modules/"],
};

module.exports = config;
