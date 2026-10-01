import { useLocaleCopy } from "@12-apps/i18n/react";
import { Avatar } from "@12-apps/ui/data-display/Avatar";
import { Chip } from "@12-apps/ui/data-display/Chip";
import { Dialog, DialogContent } from "@12-apps/ui/feedback/Dialog";
import { Button } from "@12-apps/ui/form/Button";
import { Icon } from "@12-apps/ui/icons";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Container } from "@12-apps/ui/layout/Container";
import { Screen } from "@12-apps/ui/layout/Screen";
import { Stack } from "@12-apps/ui/layout/Stack";
import { useUiTheme } from "@12-apps/ui/provider";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { usePathname } from "expo-router";
import { useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { CLIENT_COPY } from "./copy";
import { useClient } from "./context";
import { useSingleNavigation } from "./navigation";
import { selectTenant, type Workout } from "./model";
import { SAMPLE_PROVIDERS, sampleRolesForTenant } from "./sample-data";

export function Page({ children, testID, tabs = false, footer }: PropsWithChildren<{ testID: string; tabs?: boolean; footer?: ReactNode }>) {
  const theme = useUiTheme();
  const content = <Container maxWidth={false} responsive={false} padding="none" style={{ maxWidth: theme.spacing(60) }}><Stack p={2} gap={3}>{children}</Stack></Container>;
  return <Screen dataTestId={testID} scroll={!footer} safeAreaEdges={tabs ? ["top", "left", "right"] : ["top", "right", "bottom", "left"]}>
    {footer ? <>
      <Screen dataTestId={`${testID}-body`} safeAreaEdges={[]} keyboardAvoiding={false}>{content}</Screen>
      <Box bg="paper" dataTestId={`${testID}-footer`}><Container maxWidth={false} responsive={false} padding="none" style={{ maxWidth: theme.spacing(60) }}><Stack p={2} gap={1}>{footer}</Stack></Container></Box>
    </> : content}
  </Screen>;
}
export function Muted({ children }: PropsWithChildren) {
  const theme = useUiTheme();
  return <Text size="sm" style={{ color: theme.palette.text.secondary }}>{children}</Text>;
}
export function SectionTitle({ children }: PropsWithChildren) {
  return <Heading level="h2" size="h5">{children}</Heading>;
}
export function Plate({ letter, small = false }: { letter: string; small?: boolean }) {
  const color = letter === "–" || letter === "·" ? "neutral" : letter === "A" ? "danger" : letter === "B" ? "primary" : letter === "C" ? "warning" : "success";
  return <Avatar fallback={letter} size={small ? "sm" : "lg"} color={color} bordered alt={`${letter}`} />;
}
export function ProviderHeader() {
  const copy = useLocaleCopy(CLIENT_COPY);
  const { state, setState } = useClient();
  const router = useSingleNavigation();
  const pathname = usePathname();
  const selectionLocked = useRef(false);
  const [open, setOpen] = useState(false);
  const provider = SAMPLE_PROVIDERS.find((item) => item.id === state.selectedTenantId)!;
  return <>
    <Stack gap={1}>
      <Stack direction="row" align="center" justify="between" gap={1}>
        <Text size="sm" weight="bold">{copy.brand}</Text><Chip label={copy.sample} size="xs" variant="outlined" color="primary" />
      </Stack>
      <Button variant="outline" color="neutral" onPress={() => { selectionLocked.current = false; setOpen(true); }} accessibilityLabel={`${copy.changeProvider}: ${provider.name}`} icon={<Icon name="ArrowDropDown" />} iconPosition="right" dataTestId="provider-switch">
        {provider.name}
      </Button>
    </Stack>
    <Dialog open={open} onClose={() => setOpen(false)} title={copy.chooseProvider} dataTestId="provider-dialog">
      <DialogContent><Stack gap={2}>
        <Muted>{copy.providerHint}</Muted>
        {SAMPLE_PROVIDERS.map((item) => <Button key={item.id} variant={item.id === provider.id ? "solid" : "outline"} onPress={() => {
          if (selectionLocked.current) return;
          selectionLocked.current = true;
          setState((current) => selectTenant(current, item.id)); setOpen(false);
          if (pathname !== "/") router.replace("/");
        }} dataTestId={`provider-${item.id}`}>{item.name} · {sampleRolesForTenant(state.userId, item.id).includes("owner") ? copy.ownerRole : copy.clientRole}</Button>)}
        <Button variant="ghost" onPress={() => setOpen(false)}>{copy.cancel}</Button>
      </Stack></DialogContent>
    </Dialog>
  </>;
}
export function WorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const copy = useLocaleCopy(CLIENT_COPY);
  return <Card variant="outlined" borderRadius="lg" accessibilityRole="button" accessibilityLabel={`${copy.workout} ${workout.letter}: ${workout.name}`} onPress={onPress} dataTestId={`workout-${workout.id}`}>
    <Stack direction="row" p={2} gap={2} align="center">
      <Plate letter={workout.letter} small /><Stack gap={0.5} flex={1}>
        <Text weight="semibold">{workout.name}</Text><Muted>{workout.exercises.length} {copy.exercises.toLowerCase()} · {workout.exercises.reduce((sum, item) => sum + item.sets, 0)} {copy.sets}</Muted>
      </Stack><Icon name="ChevronRight" color="neutral" />
    </Stack>
  </Card>;
}
export function SampleNote() {
  const copy = useLocaleCopy(CLIENT_COPY);
  return <Box gap={1}><Muted>{copy.sampleNotice}</Muted><Muted>{copy.inMemory}</Muted></Box>;
}
