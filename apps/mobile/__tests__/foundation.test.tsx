import { useLocale } from "@12-apps/i18n/react";
import { useUiTheme } from "@12-apps/ui/provider";
import { Text } from "@12-apps/ui/typography/Text";
import { render, screen } from "@testing-library/react-native";
import FoundationScreen from "../app/(tabs)/index";
import { AppProviders } from "../src/providers";

function ProviderProbe() {
  const locale = useLocale();
  const theme = useUiTheme();
  return <Text dataTestId="provider-probe">{`${locale}:${theme.mode}`}</Text>;
}

describe("screenless native foundation", () => {
  it("renders the actual native shared UI surface", () => {
    render(<AppProviders><FoundationScreen /></AppProviders>);
    expect(screen.getByTestId("gym-foundation")).toBeOnTheScreen();
    expect(screen.toJSON()).toMatchObject({ type: "View" });
  });

  it("puts an explicit pt-BR locale and shared theme in scope", () => {
    render(<AppProviders><ProviderProbe /></AppProviders>);
    expect(screen.getByTestId("provider-probe")).toHaveTextContent("pt-BR:light");
  });

  it("reopens the empty shell without retaining old rendered content", () => {
    const first = render(<AppProviders><FoundationScreen /></AppProviders>);
    first.unmount();
    render(<AppProviders><FoundationScreen /></AppProviders>);
    expect(screen.getAllByTestId("gym-foundation")).toHaveLength(2);
  });
});
