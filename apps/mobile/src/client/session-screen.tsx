import { useLocaleCopy } from "@12-apps/i18n/react";
import { Chip } from "@12-apps/ui/data-display/Chip";
import { EmptyState } from "@12-apps/ui/data-display/EmptyState";
import { Progress } from "@12-apps/ui/data-display/Progress";
import { Dialog, DialogContent } from "@12-apps/ui/feedback/Dialog";
import { Button } from "@12-apps/ui/form/Button";
import { Icon } from "@12-apps/ui/icons";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { useUiTheme } from "@12-apps/ui/provider";
import { Heading } from "@12-apps/ui/typography/Heading";
import { Text } from "@12-apps/ui/typography/Text";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { CLIENT_COPY, formatClock, formatNumber } from "./copy";
import { useClient } from "./context";
import { Muted, Page, SectionTitle } from "./components";
import { commandForTenant, finishSession, remainingMilliseconds, summarizeSession, trainingForMember, type SessionCommand } from "./model";

export function SessionScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const theme = useUiTheme(); const router = useRouter();
  const { state, setState } = useClient();
  const tenantId = state.selectedTenantId;
  const session = trainingForMember(state).activeSession;
  const sessionId = session?.id;
  const [now, setNow] = useState(Date.now);
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const tick = () => { const time = Date.now(); setNow(time); setState((current) => commandForTenant(current, tenantId, sessionId, { type: "tick", now: time })); };
    tick(); const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [sessionId, tenantId, setState]);
  if (!session || session.userId !== state.userId) return <Page testID="gym-no-session"><EmptyState title={copy.noSession} description={copy.noSessionHint} primaryAction={{ label: copy.goHome, onClick: () => router.replace("/") }} /></Page>;
  const exercise = session.workout.exercises[session.exerciseIndex]!;
  const logs = session.logs[exercise.id]!;
  const remaining = session.phase === "ready" ? exercise.executionSeconds * 1000 : remainingMilliseconds(session, now);
  const phaseColor = session.phase === "rest" || session.phase === "exercise-complete" ? "success" : session.phase === "execution" ? "danger" : "primary";
  const phaseLabel = session.paused ? copy.paused : ({ ready: copy.ready, execution: copy.working, rest: copy.resting, "exercise-complete": copy.exerciseDone })[session.phase];
  const summary = summarizeSession(session, now);
  const command = (action: SessionCommand) => setState((current) => commandForTenant(current, tenantId, session.id, action));
  const finish = (discard = false) => {
    setState((current) => finishSession(current, tenantId, session.id, Date.now(), discard)); setConfirmEnd(false);
    router.replace(discard ? "/" : { pathname: "/summary/[id]", params: { id: session.id } });
  };
  return <Page testID="gym-session">
    <Stack direction="row" gap={1} align="center" justify="between">
      <Button variant="ghost" onPress={() => router.replace("/")} accessibilityLabel={copy.goHome} icon={<Icon name="ArrowBack" />} />
      <Stack flex={1} gap={0.5}><Text weight="semibold">{copy.workout} {session.workout.letter}</Text><Muted>{copy.total} {formatClock(now - session.startedAt)}</Muted></Stack>
      <Button variant="outline" size="sm" onPress={() => setConfirmEnd(true)}>{copy.endSession}</Button>
    </Stack>
    <Progress value={(session.exerciseIndex + 1) / session.workout.exercises.length * 100} variant="segmented" segments={session.workout.exercises.length} color="primary" />
    <Stack gap={1}><Muted>{copy.exercises} {session.exerciseIndex + 1} {copy.of} {session.workout.exercises.length} · {exercise.muscle}</Muted>
      <Heading level="h1" size="h3">{exercise.name}</Heading><Muted>{exercise.sets} × {exercise.repetitions} · {exercise.executionSeconds}{copy.seconds} {copy.execution} · {exercise.restSeconds}{copy.seconds} {copy.interval}</Muted>
    </Stack>
    <Card variant="outlined" borderRadius="xl"><Stack p={2.5} gap={2} align="center">
      <Chip label={phaseLabel} color={phaseColor} size="sm" />
      <Stack direction="row" gap={3} align="center">
        <Progress variant="circular" color={phaseColor} value={session.phase === "ready" || session.phase === "exercise-complete" ? 100 : session.durationMs ? remaining / session.durationMs * 100 : 0} circularSize={theme.spacing(12)} thickness={theme.spacing(0.75)} />
        <Stack gap={0.5}><Heading level="h2" size="h1" color={phaseColor} dataTestId="session-clock">{session.phase === "exercise-complete" ? "✓" : formatClock(remaining)}</Heading><Text weight="semibold">{copy.set} {session.setIndex + 1} {copy.of} {exercise.sets}</Text></Stack>
      </Stack>
      {session.phase === "execution" && remaining === 0 ? <Text color="danger" size="sm" accessibilityLiveRegion="polite">{copy.timerEnded}</Text> : null}
      {session.phase === "ready" ? <Button size="lg" onPress={() => command({ type: "start-set", now: Date.now() })} dataTestId="start-set">{copy.startSet}</Button> : null}
      {session.phase === "execution" || session.phase === "rest" ? <Stack gap={1} width="100%">
        <Button variant="outline" color="neutral" onPress={() => command({ type: "toggle-pause", now: Date.now() })} dataTestId="pause-timer">{session.paused ? copy.continueTimer : copy.pause}</Button>
        {session.phase === "execution" ? <Button color="primary" onPress={() => command({ type: "complete-set", now: Date.now() })} dataTestId="complete-set">{copy.completeSet}</Button> : <Stack direction="row" gap={1}><Box flex={1}><Button variant="outline" onPress={() => command({ type: "extend-rest", milliseconds: 15000 })}>{copy.moreRest}</Button></Box><Box flex={1}><Button color="success" onPress={() => command({ type: "skip-rest" })}>{copy.skipRest}</Button></Box></Stack>}
      </Stack> : null}
    </Stack></Card>
    <Muted>{copy.timerHint}</Muted>
    <Stack gap={1.5}><SectionTitle>{copy.loads}</SectionTitle>{logs.map((set, index) => <Card key={index} variant="outlined" borderRadius="lg"><Stack p={1.5} gap={1}>
      <Stack direction="row" justify="between" align="center" gap={1}>
        <Button variant={set.completed ? "solid" : "outline"} color={set.completed ? "success" : "neutral"} size="sm" onPress={() => command({ type: "toggle-set", exerciseId: exercise.id, setIndex: index })} accessibilityLabel={`${copy.set} ${index + 1}: ${set.completed ? copy.completed : copy.pending}`} dataTestId={`toggle-set-${index}`}>{set.completed ? "✓" : String(index + 1)}</Button>
        <Stack flex={1} gap={0.5}><Text weight="semibold">{formatNumber(set.kg)} kg × {set.repetitions}</Text><Muted>{copy.set} {index + 1} · {set.completed ? copy.completed : copy.pending}</Muted></Stack>
        <Button variant="ghost" size="sm" onPress={() => router.push({ pathname: "/set/[exerciseId]/[setIndex]", params: { exerciseId: exercise.id, setIndex: String(index), sessionId: session.id } })} accessibilityLabel={`${copy.edit} ${copy.set.toLowerCase()} ${index + 1}`} dataTestId={`edit-set-${index}`}>{copy.edit}</Button>
      </Stack>
    </Stack></Card>)}</Stack>
    <Stack gap={1}>
      {session.exerciseIndex < session.workout.exercises.length - 1 ? <Button onPress={() => { command({ type: "exercise", index: session.exerciseIndex + 1 }); }} dataTestId="next-exercise">{copy.nextExercise}</Button> : null}
      {session.exerciseIndex > 0 ? <Button variant="outline" onPress={() => { command({ type: "exercise", index: session.exerciseIndex - 1 }); }}>{copy.previousExercise}</Button> : null}
      <Button variant="outline" color="neutral" onPress={() => setConfirmEnd(true)} dataTestId="finish-workout">{copy.finish}</Button>
    </Stack>
    <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)} title={copy.finishTitle} dataTestId="finish-dialog">
      <DialogContent><Stack gap={2}><Text>{summary.completedSets} {copy.of} {summary.plannedSets} {copy.sets} · {formatNumber(summary.volumeKg)} kg</Text><Muted>{copy.finishHint}</Muted>
        <Button disabled={summary.completedSets === 0} onPress={() => finish()} dataTestId="save-finish">{copy.saveFinish}</Button>
        <Button variant="outline" color="danger" onPress={() => finish(true)}>{copy.discard}</Button>
        <Button variant="ghost" onPress={() => setConfirmEnd(false)}>{copy.keepTraining}</Button>
      </Stack></DialogContent>
    </Dialog>
  </Page>;
}
