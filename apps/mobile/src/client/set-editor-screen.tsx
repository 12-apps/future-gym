import { useLocaleCopy } from "@12-apps/i18n/react";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { CLIENT_COPY, formatInputNumber } from "./copy";
import { useClient } from "./context";
import { useSingleNavigation } from "./navigation";
import { Muted, Page } from "./components";
import { commandForTenant, parseSetInput, trainingForMember, type SetLog } from "./model";

function SetEditor({ initial, exerciseName, index, onSave, onCancel }: {
  initial: SetLog; exerciseName: string; index: number;
  onSave: (values: { kg: number; repetitions: number }) => void; onCancel: () => void;
}) {
  const copy = useLocaleCopy(CLIENT_COPY);
  const [kg, setKg] = useState(() => formatInputNumber(initial.kg));
  const [repetitions, setRepetitions] = useState(() => String(initial.repetitions));
  const [invalid, setInvalid] = useState(false);
  return <Page testID="set-editor"><Button variant="ghost" onPress={onCancel}>{copy.cancel}</Button>
    <Stack gap={1}><Muted>{exerciseName}</Muted><Heading level="h1" size="h3">{copy.editSet} {index + 1}</Heading></Stack>
    <Card variant="outlined" borderRadius="lg"><Stack p={2} gap={2}>
      <Input label={copy.kg} value={kg} onChangeText={setKg} inputMode="decimal" error={invalid} dataTestId="set-load-input" />
      <Input label={copy.reps} value={repetitions} onChangeText={setRepetitions} inputMode="numeric" error={invalid} dataTestId="set-reps-input" />
      {invalid ? <Text color="danger" size="sm" accessibilityRole="alert">{copy.invalidSet}</Text> : null}
    </Stack></Card>
    <Button size="lg" onPress={() => { const parsed = parseSetInput(kg, repetitions); if (!parsed) { setInvalid(true); return; } onSave(parsed); }} dataTestId="save-set">{copy.save}</Button>
  </Page>;
}

/** A routed Screen keeps keyboard avoidance and native Back semantics shared. */
export function SetEditorScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const router = useSingleNavigation();
  const { exerciseId, setIndex, sessionId } = useLocalSearchParams<{ exerciseId: string; setIndex: string; sessionId: string }>();
  const { state, setState } = useClient(); const tenantId = state.selectedTenantId;
  const session = trainingForMember(state).activeSession;
  const index = /^\d+$/.test(setIndex ?? "") ? Number(setIndex) : -1;
  const exercise = session?.workout.exercises.find((item) => item.id === exerciseId);
  const initial = session?.logs[exerciseId]?.[index];
  if (!session || session.id !== sessionId || session.userId !== state.userId || !exercise || !initial) return <Page testID="gym-set-unavailable"><EmptyState title={copy.unavailable} description={copy.unavailableHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  const back = () => router.back("/session");
  return <SetEditor key={`${tenantId}:${session.id}:${exerciseId}:${index}`} initial={initial} exerciseName={exercise.name} index={index} onCancel={back} onSave={(values) => router.run((currentRouter) => {
    setState((current) => commandForTenant(current, tenantId, session.id, { type: "set-log", exerciseId, setIndex: index, ...values }));
    if (currentRouter.canGoBack()) currentRouter.back(); else currentRouter.replace("/session");
  })} />;
}
