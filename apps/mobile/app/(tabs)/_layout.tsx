import { useLocaleCopy } from "@12-apps/i18n/react";
import { Icon } from "@12-apps/ui/icons";
import { Box } from "@12-apps/ui/layout/Box";
import { useUiTheme } from "@12-apps/ui/provider";
import { Tabs } from "expo-router";
import { useState } from "react";
import { CLIENT_COPY } from "../../src/client/copy";

/** Navigation structure only; all appearance values come from the shared theme. */
export default function TabLayout() {
  const theme = useUiTheme();
  const copy = useLocaleCopy(CLIENT_COPY);
  const [width, setWidth] = useState(0);
  return (
    <Box flex={1} dataTestId="tab-frame" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}><Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.palette.primary.main,
      tabBarInactiveTintColor: theme.palette.text.secondary,
      tabBarLabelPosition: "below-icon",
      tabBarStyle: { backgroundColor: theme.palette.background.paper, borderTopColor: theme.palette.divider, paddingHorizontal: Math.max(0, (width - theme.spacing(60)) / 2) },
    }}>
      <Tabs.Screen name="index" options={{ title: copy.home, tabBarIcon: ({ focused, size }) => <Icon name="Home" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
      <Tabs.Screen name="workouts" options={{ title: copy.workouts, tabBarIcon: ({ focused, size }) => <Icon name="FitnessCenter" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: copy.history, tabBarIcon: ({ focused, size }) => <Icon name="History" color={focused ? theme.palette.primary.main : theme.palette.text.secondary} size={size} /> }} />
    </Tabs></Box>
  );
}
