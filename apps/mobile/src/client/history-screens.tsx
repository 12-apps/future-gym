import { useLocaleCopy } from "@12-apps/i18n/react";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Button } from "@12-apps/ui/form/Button";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CLIENT_COPY, formatNumber } from "./copy";
import { useClient } from "./context";
import { Muted, Page, Plate, ProviderHeader, SampleNote, SectionTitle } from "./components";
import { trainingForMember, type SessionSummary } from "./model";

function SummaryStats({ summary }: { summary: SessionSummary }) {
  const copy = useLocaleCopy(CLIENT_COPY);
  return <Stack direction="row" gap={1}>{[
    [Math.floor(summary.durationSeconds / 60), copy.minutes], [summary.completedSets, copy.sets], [formatNumber(summary.volumeKg), copy.volume],
  ].map(([value, label]) => <Card key={label} variant="outlined" borderRadius="lg" style={{ flex: 1 }}><Stack p={1.5} gap={1}><Text size="xl" weight="bold">{value}</Text><Muted>{label}</Muted></Stack></Card>)}</Stack>;
}
export function HistoryScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { state } = useClient(); const router = useRouter();
  const history = trainingForMember(state).history;
  return <Page testID="gym-history" tabs><ProviderHeader /><Heading level="h1" size="h3">{copy.history}</Heading>
    {history.length ? <Stack gap={1.5}>{history.map((entry) => <Card key={entry.id} variant="outlined" borderRadius="lg" onPress={() => router.push({ pathname: "/summary/[id]", params: { id: entry.id } })} dataTestId={`history-${entry.id}`}>
      <Stack p={2} gap={1.5}><Stack direction="row" gap={1.5} align="center"><Plate letter={entry.letter} small /><Stack flex={1} gap={0.5}><Text weight="semibold">{entry.name}</Text><Muted>{new Date(entry.startedAt).toLocaleDateString("pt-BR")} · {entry.completedSets} {copy.sets}</Muted></Stack><Text weight="bold">{formatNumber(entry.volumeKg)} kg</Text></Stack></Stack>
    </Card>)}</Stack> : <EmptyState title={copy.noHistory} description={copy.noHistoryHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} />}
    <SampleNote />
  </Page>;
}
export function SummaryScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { id } = useLocalSearchParams<{ id: string }>(); const { state } = useClient(); const router = useRouter();
  const summary = trainingForMember(state).history.find((entry) => entry.id === id);
  if (!summary) return <Page testID="gym-summary-unavailable"><EmptyState title={copy.unavailable} description={copy.unavailableHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  return <Page testID="gym-summary"><Plate letter={summary.letter} /><Stack gap={1}><Muted>{summary.name}</Muted><Heading level="h1" size="h3">{copy.summary}</Heading></Stack>
    <SummaryStats summary={summary} /><Stack gap={1.5}><SectionTitle>{copy.recorded}</SectionTitle>{summary.exercises.map((exercise) => {
      const done = exercise.sets.filter((set) => set.completed);
      return <Card key={exercise.id} variant="outlined" borderRadius="lg"><Stack p={2} gap={1}><Text weight="semibold">{exercise.name}</Text><Muted>{done.length} {copy.of} {exercise.sets.length} {copy.sets}</Muted>{done.map((set, index) => <Text key={index} size="sm">{formatNumber(set.kg)} kg × {set.repetitions}</Text>)}</Stack></Card>;
    })}</Stack><Button size="lg" onPress={() => router.replace("/")}>{copy.goHome}</Button><SampleNote />
  </Page>;
}
