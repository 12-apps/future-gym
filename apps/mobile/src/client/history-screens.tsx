import { useLocaleCopy } from "@12-apps/i18n/react";
import { Chip } from "@12-apps/ui/data-display/Chip";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Button } from "@12-apps/ui/form/Button";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useLocalSearchParams } from "expo-router";
import { CLIENT_COPY, formatDuration, formatNumber } from "./copy";
import { useClient } from "./context";
import { useSingleNavigation } from "./navigation";
import { Muted, Page, Plate, ProviderHeader, SampleNote, SectionTitle } from "./components";
import { trainingForMember } from "./model";

function Stats({ values }: { values: readonly (readonly [number | string, string])[] }) {
  return <Stack direction="row" gap={1}>{values.map(([value, label]) => <Card key={label} variant="outlined" borderRadius="lg" style={{ flex: 1 }}><Stack p={1.5} gap={1} align="center"><Text size="xl" weight="bold">{value}</Text><Muted>{label}</Muted></Stack></Card>)}</Stack>;
}
export function HistoryScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { state } = useClient(); const router = useSingleNavigation();
  const history = trainingForMember(state).history;
  return <Page testID="gym-history" tabs><ProviderHeader /><Stack gap={1}><Muted>{copy.yourWorkouts}</Muted><Heading level="h1" size="h3">{copy.history}</Heading></Stack>
    {history.length ? <>
      <Stats values={[[history.length, copy.sessions], [formatNumber(history.reduce((sum, entry) => sum + entry.volumeKg, 0) / 1000), copy.tonnes], [history.reduce((sum, entry) => sum + entry.completedSets, 0), copy.sets]]} />
      <Card variant="outlined" borderRadius="lg"><Stack gap={0}>{history.map((entry) => <Card key={entry.id} variant="outlined" borderRadius="none" accessibilityRole="button" accessibilityLabel={`${entry.name}, ${new Date(entry.startedAt).toLocaleDateString("pt-BR")}, ${formatNumber(entry.volumeKg)} kg`} onPress={() => router.push({ pathname: "/summary/[id]", params: { id: entry.id } })} dataTestId={`history-${entry.id}`}>
        <Stack direction="row" p={1.5} gap={1.5} align="center"><Plate letter={entry.letter} small /><Stack flex={1} gap={0.5}><Text weight="semibold">{entry.name}</Text><Muted>{new Date(entry.startedAt).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} · {formatDuration(entry.durationSeconds, copy.minutes)} · {entry.completedSets} {copy.sets}</Muted></Stack><Text weight="bold">{formatNumber(entry.volumeKg)} kg</Text></Stack>
      </Card>)}</Stack></Card>
    </> : <Card variant="outlined" borderRadius="lg"><Stack p={3} gap={2} align="center"><Text weight="semibold">{copy.noHistory}</Text><Muted>{copy.noHistoryHint}</Muted><Button onPress={() => router.replace("/")}>{copy.goHome}</Button></Stack></Card>}
    <SampleNote />
  </Page>;
}
export function SummaryScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { id } = useLocalSearchParams<{ id: string }>(); const { state } = useClient(); const router = useSingleNavigation();
  const summary = trainingForMember(state).history.find((entry) => entry.id === id);
  if (!summary) return <Page testID="gym-summary-unavailable"><EmptyState title={copy.unavailable} description={copy.unavailableHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  return <Page testID="gym-summary" footer={<Button size="lg" style={{ width: "100%" }} onPress={() => router.replace("/")}>{copy.goHome}</Button>}>
    <Stack direction="row" gap={2} align="center"><Plate letter={summary.letter} /><Stack flex={1} gap={1}><Muted>{copy.workout} {summary.letter} · {summary.name}</Muted><Heading level="h1" size="h3">{copy.summary}</Heading></Stack></Stack>
    <Stats values={[[formatDuration(summary.durationSeconds, copy.minutes), copy.duration], [summary.completedSets, copy.sets], [formatNumber(summary.volumeKg), copy.volume]]} />
    <Stack gap={1.5}><SectionTitle>{copy.recorded}</SectionTitle><Card variant="outlined" borderRadius="lg"><Stack gap={0}>{summary.exercises.map((exercise) => {
      const done = exercise.sets.filter((set) => set.completed);
      return <Box key={exercise.id} bordered><Stack direction="row" p={1.5} gap={2} align="center"><Stack flex={1} gap={0.5}><Text weight="semibold">{exercise.name}</Text>{done.length ? done.map((set, index) => <Text key={index} size="sm">{formatNumber(set.kg)} kg × {set.repetitions}</Text>) : <Muted>{copy.notPerformed}</Muted>}</Stack><Chip label={`${done.length}/${exercise.sets.length}`} color={done.length ? "success" : "neutral"} size="sm" /></Stack></Box>;
    })}</Stack></Card></Stack><SampleNote />
  </Page>;
}
