import { useLocaleCopy } from "@12-apps/i18n/react";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Progress } from "@12-apps/ui/data-display/Progress";
import { Button } from "@12-apps/ui/form/Button";
import { Icon } from "@12-apps/ui/icons";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useLocalSearchParams } from "expo-router";
import { calendarWeek, isoWeekNumber, useCalendarDate } from "./calendar";
import { CLIENT_COPY, formatDuration, formatNumber } from "./copy";
import { useClient } from "./context";
import { useSingleNavigation } from "./navigation";
import { Muted, Page, Plate, ProviderHeader, SampleNote, SectionTitle, WorkoutCard } from "./components";
import { beginWorkout, plannedWorkoutSeconds, trainingForMember, type Workout } from "./model";
import { SAMPLE_WEEK, workoutsForTenant } from "./sample-data";

const openPath = (id: string) => ({ pathname: "/workout/[id]" as const, params: { id } });
const plannedSets = (workout: Workout) => workout.exercises.reduce((sum, item) => sum + item.sets, 0);
const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

export function HomeScreen() {
  const copy = useLocaleCopy(CLIENT_COPY);
  const { state } = useClient(); const router = useSingleNavigation();
  const tenant = trainingForMember(state);
  const workouts = workoutsForTenant(state.selectedTenantId);
  const week = SAMPLE_WEEK[state.selectedTenantId]!;
  const now = useCalendarDate(); const days = calendarWeek(now);
  const todayIndex = (now.getDay() + 6) % 7;
  const today = workouts.find((workout) => workout.id === week[todayIndex]);
  const nextIndex = week.findIndex((id, index) => index > todayIndex && workouts.some((workout) => workout.id === id));
  const nextWorkout = workouts.find((workout) => workout.id === week[nextIndex]);
  const active = tenant.activeSession; const featured = active?.workout ?? today;
  const weekEnd = new Date(days[0]!); weekEnd.setDate(weekEnd.getDate() + 7);
  const completedDays = new Set(tenant.history.filter((item) => item.startedAt >= days[0]!.getTime() && item.startedAt < weekEnd.getTime()).map((item) => new Date(item.startedAt).toDateString()));
  const plannedDays = week.filter(Boolean).length;
  const totalPlannedSets = week.reduce((sum, id) => sum + (workouts.find((item) => item.id === id)?.exercises.reduce((total, item) => total + item.sets, 0) ?? 0), 0);
  return <Page testID="gym-home" tabs>
    <ProviderHeader />
    <Stack gap={1}><Muted>{copy.week} {isoWeekNumber(now)} · {shortDate(days[0]!)} – {shortDate(days[6]!)}</Muted><Heading level="h1" size="h3">{copy.yourPlan}</Heading></Stack>
    <Card variant="elevated" borderRadius="xl"><Stack p={2.5} gap={2.5}>
      <Stack direction="row" gap={2} align="center">
        <Plate letter={featured?.letter ?? "–"} />
        <Stack flex={1} gap={1}><Text size="xs" weight="bold" color="primary">{active ? copy.active : `${copy.today} · ${copy.days[todayIndex]}`}</Text>
          <Heading level="h2" size="h4">{featured?.name ?? copy.restDay}</Heading>
          <Muted>{featured ? `${featured.exercises.length} ${copy.exercises.toLowerCase()} · ${plannedSets(featured)} ${copy.sets} · ~${formatDuration(plannedWorkoutSeconds(featured), copy.minutes)}` : nextWorkout ? `${copy.next}: ${copy.workout} ${nextWorkout.letter} · ${copy.days[nextIndex]}` : copy.weekEnded}</Muted>
        </Stack>
      </Stack>
      {featured ? <Button size="lg" onPress={() => router.push(active ? "/session" : openPath(featured.id))} dataTestId="home-open-workout">{active ? copy.resume : copy.openWorkout}</Button> : nextWorkout ? <Button variant="outline" onPress={() => router.push(openPath(nextWorkout.id))} dataTestId="home-next-workout">{copy.viewWorkout} {nextWorkout.letter}</Button> : null}
    </Stack></Card>
    <Stack gap={2}>
      <Stack direction="row" justify="between" gap={0.5}>{days.map((date, index) => {
        const workout = workouts.find((item) => item.id === week[index]);
        return <Box key={date.toDateString()} gap={0.5} flex={1} align="center" py={1} radius="lg" bordered={todayIndex === index} bg={todayIndex === index ? "paper" : "transparent"}>
          <Text size="xs" weight="semibold">{copy.days[index]}</Text><Text weight="semibold" dataTestId={`calendar-date-${index}`}>{date.getDate()}</Text>{workout ? <Plate letter={completedDays.has(date.toDateString()) ? "✓" : workout.letter} small /> : <Text size="lg">·</Text>}
        </Box>;
      })}</Stack>
      <Stack direction="row" justify="between"><Muted>{copy.weekProgress}</Muted><Text weight="semibold">{completedDays.size} {copy.of} {plannedDays}</Text></Stack>
      <Progress value={plannedDays ? Math.min(100, completedDays.size / plannedDays * 100) : 0} color="success" dataTestId="weekly-progress" />
    </Stack>
    <Card variant="outlined" borderRadius="lg" accessibilityRole="button" accessibilityLabel={copy.volumeEntryHint} onPress={() => router.push({ pathname: "/workouts", params: { section: "volume" } })} dataTestId="home-volume">
      <Stack direction="row" p={2} gap={2} align="center"><Stack flex={1} gap={1}><Text size="xs" weight="bold">{copy.weeklyVolume}</Text><Text>{totalPlannedSets} {copy.plannedTotal}</Text></Stack><Icon name="ChevronRight" color="neutral" /></Stack>
    </Card>
    <Stack gap={1.5}><SectionTitle>{copy.weekPlan}</SectionTitle><Card variant="outlined" borderRadius="lg"><Stack gap={0}>{days.map((date, index) => {
      const workout = workouts.find((item) => item.id === week[index]);
      const when = <Stack gap={0.5}><Text weight="bold" size="sm">{copy.days[index]}</Text><Muted>{date.getDate()}/{String(date.getMonth() + 1).padStart(2, "0")}</Muted></Stack>;
      const id = workout ? `workout-${workout.id}${week.indexOf(workout.id) === index ? "" : `-day-${index}`}` : `rest-day-${index}`;
      const content = <Stack direction="row" p={2} gap={1.5} align="center">{when}{workout ? <><Plate letter={workout.letter} small /><Stack flex={1} gap={0.5}><Text weight="semibold">{copy.workout} {workout.letter} · {workout.name}</Text><Muted>{workout.exercises.length} {copy.exercises.toLowerCase()} · ~{formatDuration(plannedWorkoutSeconds(workout), copy.minutes)}</Muted></Stack><Icon name="ChevronRight" color="neutral" /></> : <><Text>·</Text><Muted>{copy.rest}</Muted></>}</Stack>;
      return workout ? <Card key={id} variant="outlined" borderRadius="none" accessibilityRole="button" accessibilityLabel={`${copy.workout} ${workout.letter}: ${workout.name}, ${copy.days[index]} ${date.getDate()}`} onPress={() => router.push(openPath(workout.id))} dataTestId={id}>{content}</Card> : <Box key={id} dataTestId={id}>{content}</Box>;
    })}</Stack></Card></Stack>
    <SampleNote />
  </Page>;
}

export function WorkoutsScreen() {
  const copy = useLocaleCopy(CLIENT_COPY);
  const { state } = useClient(); const router = useSingleNavigation();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const workouts = workoutsForTenant(state.selectedTenantId); const week = SAMPLE_WEEK[state.selectedTenantId]!;
  const volumes = new Map<string, number>();
  week.forEach((id) => workouts.find((workout) => workout.id === id)?.exercises.forEach((exercise) => volumes.set(exercise.muscle, (volumes.get(exercise.muscle) ?? 0) + exercise.sets)));
  const max = Math.max(1, ...volumes.values());
  const volume = <Stack gap={2} dataTestId="planned-volume"><SectionTitle>{copy.weeklyVolume}</SectionTitle><Muted>{copy.weeklyVolumeHint}</Muted>
    <Card variant="outlined" borderRadius="lg"><Stack p={2} gap={2}>{Array.from(volumes).map(([muscle, sets]) => <Stack key={muscle} gap={1}><Stack direction="row" justify="between" gap={1}><Text weight="semibold" style={{ flex: 1 }}>{muscle}</Text><Muted>{sets} {copy.sets}</Muted></Stack><Progress value={sets / max * 100} color="primary" /></Stack>)}</Stack></Card>
  </Stack>;
  return <Page testID="gym-workouts" tabs><ProviderHeader />
    <Stack gap={1}><Heading level="h1" size="h3">{copy.workouts}</Heading><Muted>{copy.assignedHint}</Muted></Stack>
    {section === "volume" ? volume : null}
    <Stack gap={1.5}>{workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} onPress={() => router.push(openPath(workout.id))} />)}</Stack>
    {section !== "volume" ? volume : null}<SampleNote />
  </Page>;
}

export function WorkoutScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setState } = useClient(); const router = useSingleNavigation();
  const workout = workoutsForTenant(state.selectedTenantId).find((item) => item.id === id);
  const tenant = trainingForMember(state); const active = tenant.activeSession;
  if (!workout) return <Page testID="gym-unavailable"><EmptyState title={copy.unavailable} description={copy.unavailableHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  const previous = tenant.history.find((entry) => entry.workoutId === workout.id);
  const start = <Button size="lg" style={{ width: "100%" }} onPress={() => router.run((currentRouter) => {
    const now = Date.now(); setState((current) => beginWorkout(current, workout, `sample-${now}`, now)); currentRouter.push("/session");
  })} dataTestId="start-workout">{active ? copy.resume : copy.startWorkout}</Button>;
  return <Page testID="gym-workout-detail" footer={start}>
    <Button variant="ghost" onPress={() => router.back()}>{copy.back}</Button>
    <Stack direction="row" gap={2} align="center"><Plate letter={workout.letter} /><Stack flex={1} gap={1}><Muted>{copy.workout} {workout.letter}</Muted><Heading level="h1" size="h3">{workout.name}</Heading><Muted>{workout.exercises.length} {copy.exercises.toLowerCase()} · {plannedSets(workout)} {copy.sets} · ~{formatDuration(plannedWorkoutSeconds(workout), copy.minutes)}</Muted></Stack></Stack>
    <Muted>{copy.by}: {workout.prescribedBy}</Muted>
    <Stack gap={1.5}><SectionTitle>{copy.exercises}</SectionTitle><Card variant="outlined" borderRadius="lg"><Stack gap={0}>{workout.exercises.map((exercise, index) => {
      const performed = previous?.exercises.find((item) => item.id === exercise.id)?.sets.filter((set) => set.completed) ?? [];
      const kg = performed.length ? Math.max(...performed.map((set) => set.kg)) : exercise.suggestedKg;
      return <Box key={exercise.id} bordered><Stack direction="row" p={1.5} gap={1.5} align="center"><Text color="primary" weight="bold">{index + 1}</Text><Stack flex={1} gap={0.5}>
        <Text weight="semibold">{exercise.name}</Text><Muted>{exercise.muscle}</Muted><Text size="sm">{exercise.sets} × {exercise.repetitions} reps · {exercise.executionSeconds}{copy.seconds} {copy.perSet} · {exercise.restSeconds}{copy.seconds} {copy.interval}</Text>
      </Stack><Stack align="end" gap={0.5}><Text weight="bold">{formatNumber(kg)}</Text><Muted>{performed.length ? copy.lastLoad : copy.suggested}</Muted></Stack></Stack></Box>;
    })}</Stack></Card></Stack><Muted>{copy.assignedHint}</Muted>
  </Page>;
}
