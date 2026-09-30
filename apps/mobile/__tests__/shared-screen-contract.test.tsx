import { Screen } from "@12-apps/ui/layout/Screen";
import { UiProvider } from "@12-apps/ui/provider";
import { createUiTheme } from "@12-apps/ui/tokens";
import { Text } from "@12-apps/ui/typography/Text";
import { renderRouter, screen } from "expo-router/testing-library";

it("uses the same published theme context for Screen and the app provider", () => {
  const theme = createUiTheme({ mode: "dark" });
  renderRouter({ index: () => <UiProvider theme={theme}><Screen dataTestId="shared-screen-theme"><Text>Theme contract</Text></Screen></UiProvider> }, { initialUrl: "/" });
  expect(screen.getByTestId("shared-screen-theme")).toHaveStyle({ backgroundColor: theme.palette.background.default });
});
