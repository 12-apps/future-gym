import { config } from "@12-apps/eslint-config/react-internal";
import globals from "globals";

const message = "Appearance comes only from @12-apps/ui; see docs/adr/appearance-comes-only-from-12-apps-ui.md";
export default [
  ...config,
  { ignores: ["android/**", "ios/**", ".expo/**", "dist/**", "coverage/**", "reports/**"] },
  {
    files: ["*.config.js", "scripts/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-modules": ["error", {
        paths: ["react-native", "expo-image", "expo-linear-gradient", "expo-blur", "expo-symbols", "nativewind", "styled-components"].map((name) => ({ name, message })),
        patterns: ["react-native-*", "@mui/*", "@emotion/*", "@12-apps/ui/mui/*", "@expo/vector-icons", "@expo/vector-icons/*", "tailwind*"],
      }],
      "no-restricted-imports": ["error", {
        paths: ["react-native", "expo-image", "expo-linear-gradient", "expo-blur", "expo-symbols", "nativewind", "styled-components"].map((name) => ({ name, message })),
        patterns: [{ group: ["react-native-*", "@mui/*", "@emotion/*", "@12-apps/ui/mui/*", "@expo/vector-icons", "@expo/vector-icons/*", "tailwind*"], message }],
      }],
    },
  },
  { files: ["__tests__/**/*.tsx"], languageOptions: { globals: globals.jest } },
];
