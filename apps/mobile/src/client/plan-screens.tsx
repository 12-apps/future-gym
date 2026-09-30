import { useLocaleCopy } from "@12-apps/i18n/react";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Progress } from "@12-apps/ui/data-display/Progress";
import { Button } from "@12-apps/ui/form/Button";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CLIENT_COPY, formatNumber } from "./copy";
import { useClient } from "./context";
import { Muted, Page, Plate, ProviderHeader, SampleNote, SectionTitle, WorkoutCard } from "./components";
import { beginWorkout, type Workout } from "./model";
import { SAMPLE_WEEK, workoutsForTenant } from "./sample-data";

const openPath = (id: string) => ({ pathname: "/workout/[id]" as const, params: { id } });
const plannedSets = (workout: Workout) => workout.exercises.reduce((sum, item) => sum + item.sets, 0);

export function HomeScreen() {
  const copy = useLocaleCopy(CLIENT_COPY);
  const { state } = useClient();
  const router = useRouter();
  const tenant = state.tenants[state.selectedTenantId]!;
  const workouts = workoutsForTenant(state.selectedTenantId);
  const week = SAMPLE_WEEK[state.selectedTenantId]!;
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const today = workouts.find((workout) => workout.id === week[todayIndex]);
  const active = tenant.activeSession;
  const featured = active?.workout ?? today;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIndex);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
  const completedDays = new Set(tenant.history.filter((item) => item.startedAt >= monday.getTime() && item.startedAt < sunday.getTime()).map((item) => new Date(item.startedAt).toDateString())).size;
  const plannedDays = week.filter(Boolean).length;
  return <Page testID="gym-home" tabs>
    <ProviderHeader />
    <Stack gap={1}><Muted>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</Muted><Heading level="h1" size="h3">{copy.yourPlan}</Heading></Stack>
    <Card variant="elevated" borderRadius="xl"><Stack p={2.5} gap={2.5}>
      <Stack direction="row" gap={2} align="center">
        {featured ? <Plate letter={featured.letter} /> : null}
        <Stack flex={1} gap={1}><Text size="xs" weight="bold" color="primary">{active ? copy.active : copy.today}</Text>
          <Heading level="h2" size="h4">{featured?.name ?? copy.restDay}</Heading>
          <Muted>{featured ? `${featured.exercises.length} ${copy.exercises.toLowerCase()} · ${plannedSets(featured)} ${copy.sets}` : copy.restHint}</Muted>
        </Stack>
      </Stack>
      {featured ? <Button size="lg" onPress={() => router.push(active ? "/session" : openPath(featured.id))} dataTestId="home-open-workout">{active ? copy.resume : copy.openWorkout}</Button> : null}
    </Stack></Card>
    <Stack gap={2}>
      <Stack direction="row" justify="between" gap={0.5}>{copy.days.map((day, index) => {
        const workout = workouts.find((item) => item.id === week[index]);
        return <Box key={day} gap={1} flex={1} align="center" py={1} radius="lg" bordered={todayIndex === index} bg={todayIndex === index ? "paper" : "transparent"}>
          <Text size="xs" weight="semibold">{day}</Text>{workout ? <Plate letter={workout.letter} small /> : <Text size="lg">·</Text>}
        </Box>;
      })}</Stack>
      <Stack direction="row" justify="between"><Muted>{copy.weekProgress}</Muted><Text weight="semibold">{completedDays} {copy.of} {plannedDays}</Text></Stack>
      <Progress value={plannedDays ? Math.min(100, completedDays / plannedDays * 100) : 0} color="success" dataTestId="weekly-progress" />
    </Stack>
    <Stack gap={1.5}><SectionTitle>{copy.weekPlan}</SectionTitle>{workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} onPress={() => router.push(openPath(workout.id))} />)}</Stack>
    <SampleNote />
  </Page>;
}

export function WorkoutsScreen() {
  const copy = useLocaleCopy(CLIENT_COPY);
  const { state } = useClient(); const router = useRouter();
  const workouts = workoutsForTenant(state.selectedTenantId);
  const week = SAMPLE_WEEK[state.selectedTenantId]!;
  const volumes = new Map<string, number>();
  week.forEach((id) => workouts.find((workout) => workout.id === id)?.exercises.forEach((exercise) => volumes.set(exercise.muscle, (volumes.get(exercise.muscle) ?? 0) + exercise.sets)));
  const max = Math.max(1, ...volumes.values());
  return <Page testID="gym-workouts" tabs><ProviderHeader />
    <Stack gap={1}><Heading level="h1" size="h3">{copy.workouts}</Heading><Muted>{copy.assignedHint}</Muted></Stack>
    <Stack gap={1.5}>{workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} onPress={() => router.push(openPath(workout.id))} />)}</Stack>
    <Stack gap={2}><SectionTitle>{copy.weeklyVolume}</SectionTitle><Muted>{copy.weeklyVolumeHint}</Muted>
      <Card variant="outlined" borderRadius="lg"><Stack p={2} gap={2}>{Array.from(volumes).map(([muscle, sets]) => <Stack key={muscle} gap={1}><Stack direction="row" justify="between" gap={1}><Text weight="semibold" style={{ flex: 1 }}>{muscle}</Text><Muted>{sets} {copy.sets}</Muted></Stack><Progress value={sets / max * 100} color="primary" /></Stack>)}</Stack></Card>
    </Stack><SampleNote />
  </Page>;
}

export function WorkoutScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setState } = useClient(); const router = useRouter();
  const workout = workoutsForTenant(state.selectedTenantId).find((item) => item.id === id);
  const active = state.tenants[state.selectedTenantId]!.activeSession;
  if (!workout) return <Page testID="gym-unavailable"><EmptyState title={copy.unavailable} description={copy.unavailableHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  return <Page testID="gym-workout-detail">
    <Button variant="ghost" onPress={() => router.back()}>{copy.back}</Button>
    <Stack direction="row" gap={2} align="center"><Plate letter={workout.letter} /><Stack flex={1} gap={1}><Muted>{copy.workout} {workout.letter}</Muted><Heading level="h1" size="h3">{workout.name}</Heading></Stack></Stack>
    <Muted>{copy.by}: {workout.prescribedBy} · {plannedSets(workout)} {copy.sets}</Muted>
    <Stack gap={1.5}><SectionTitle>{copy.exercises}</SectionTitle>{workout.exercises.map((exercise, index) => <Card key={exercise.id} variant="outlined" borderRadius="lg"><Stack p={2} gap={1}>
      <Stack direction="row" gap={1}><Text color="primary" weight="bold">{index + 1}</Text><Text weight="semibold" style={{ flex: 1 }}>{exercise.name}</Text></Stack>
      <Muted>{exercise.muscle}</Muted><Text size="sm">{exercise.sets} × {exercise.repetitions} · {exercise.executionSeconds}{copy.seconds} {copy.execution} · {exercise.restSeconds}{copy.seconds} {copy.interval}</Text>
      <Text size="sm" weight="semibold">{formatNumber(exercise.suggestedKg)} {copy.suggested}</Text>
    </Stack></Card>)}</Stack>
    <Button size="lg" onPress={() => {
      setState((current) => beginWorkout(current, workout, `sample-${Date.now()}`, Date.now())); router.push("/session");
    }} dataTestId="start-workout">{active ? copy.resume : copy.startWorkout}</Button>
    <Muted>{copy.assignedHint}</Muted>
  </Page>;
}
