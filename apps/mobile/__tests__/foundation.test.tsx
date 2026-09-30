import { useLocale } from "@12-apps/i18n/react";
import { useUiTheme } from "@12-apps/ui/provider";
import { Text } from "@12-apps/ui/typography/Text";
import { render, screen } from "@testing-library/react-native";
import { AppProviders } from "../src/providers";

function ProviderProbe() {
  const locale = useLocale();
  const theme = useUiTheme();
  return <Text dataTestId="provider-probe">{`${locale}:${theme.mode}`}</Text>;
}

describe("native client provider boundary", () => {
  it("puts an explicit pt-BR locale and shared theme in scope", () => {
    render(<AppProviders><ProviderProbe /></AppProviders>);
    expect(screen.getByTestId("provider-probe")).toHaveTextContent("pt-BR:light");
  });
});
