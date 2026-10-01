import { useLocaleCopy } from "@12-apps/i18n/react";
import { useUiTheme } from "@12-apps/ui/provider";
import { Tabs } from "expo-router";
import { FOUNDATION_COPY } from "../../src/copy";

/** Navigation structure only; all appearance values come from the shared theme. */
export default function TabLayout() {
  const theme = useUiTheme();
  const copy = useLocaleCopy(FOUNDATION_COPY);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.palette.primary.main,
      tabBarInactiveTintColor: theme.palette.text.secondary,
      tabBarStyle: { backgroundColor: theme.palette.background.paper, borderTopColor: theme.palette.divider },
    }}>
      <Tabs.Screen name="index" options={{ title: copy.homeTab, tabBarIcon: () => null }} />
    </Tabs>
  );
}
