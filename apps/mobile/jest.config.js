const shared = {
  transformIgnorePatterns: ["node_modules/(?!.*(react-native|expo|@12-apps|navigation))"],
  testEnvironmentOptions: { customExportConditions: ["react-native"] },
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  // Renderer-only device boundary. Focused audio tests replace this with controlled failures.
  setupFilesAfterEnv: ["<rootDir>/__tests__/audio-setup.tsx"],
};

module.exports = {
  // Both use real shared native exports; these are renderer tests, not device boots.
  projects: [
    { ...shared, preset: "jest-expo/android", displayName: "Android" },
    { ...shared, preset: "jest-expo/ios", displayName: "iOS" },
  ],
  testTimeout: 30000,
  reporters: ["default", ["jest-junit", { outputDirectory: "reports", outputName: "junit.xml" }]],
};
