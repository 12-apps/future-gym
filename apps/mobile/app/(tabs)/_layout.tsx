import { useLocaleCopy } from "@12-apps/i18n/react";
import { Icon } from "@12-apps/ui/icons";
import { useUiTheme } from "@12-apps/ui/provider";
import { Tabs } from "expo-router";
import { CLIENT_COPY } from "../../src/client/copy";

/** Navigation structure only; all appearance values come from the shared theme. */
export default function TabLayout() {
  const theme = useUiTheme();
  const copy = useLocaleCopy(CLIENT_COPY);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.palette.primary.main,
      tabBarInactiveTintColor: theme.palette.text.secondary,
      tabBarStyle: { backgroundColor: theme.palette.background.paper, borderTopColor: theme.palette.divider },
    }}>
      <Tabs.Screen name="index" options={{ title: copy.home, tabBarIcon: ({ focused, size }) => <Icon name="Home" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
      <Tabs.Screen name="workouts" options={{ title: copy.workouts, tabBarIcon: ({ focused, size }) => <Icon name="FitnessCenter" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: copy.history, tabBarIcon: ({ focused, size }) => <Icon name="History" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
    </Tabs>
  );
}
