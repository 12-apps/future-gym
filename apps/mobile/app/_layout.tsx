import { useUiTheme } from "@12-apps/ui/provider";
import { Stack } from "expo-router";
import { AppProviders } from "../src/providers";

/** Retain each tab's state while a workout, editor or summary is on top. */
function ClientNavigator() {
  const theme = useUiTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.palette.background.default } }} />;
}

export default function RootLayout() {
  return <AppProviders><ClientNavigator /></AppProviders>;
}
