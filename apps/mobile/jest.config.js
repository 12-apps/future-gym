module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: ["node_modules/(?!.*(react-native|expo|@12-apps|navigation))"],
  testEnvironmentOptions: { customExportConditions: ["react-native"] },
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  testTimeout: 30000,
  reporters: ["default", ["jest-junit", { outputDirectory: "reports", outputName: "junit.xml" }]],
};
