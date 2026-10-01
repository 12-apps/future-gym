import { useLocaleCopy } from "@12-apps/i18n/react";
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
import { useEffect, useState } from "react";
import { CLIENT_COPY, formatClock } from "./copy";
import { useClient } from "./context";
import { useSingleNavigation } from "./navigation";
import { Muted, Page, SectionTitle } from "./components";
import { useWorkoutAudio } from "./workout-audio";
import { SetRow } from "./set-row";
import { commandForTenant, finishSession, remainingMilliseconds, summarizeSession, trainingForMember, type SessionCommand } from "./model";

export function SessionScreen() {
  const copy = useLocaleCopy(CLIENT_COPY); const theme = useUiTheme(); const router = useSingleNavigation();
  const { state, setState, soundEnabled, setSoundEnabled } = useClient();
  const tenantId = state.selectedTenantId;
  const session = trainingForMember(state).activeSession;
  const sessionId = session?.id;
  const [now, setNow] = useState(Date.now);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const playback = useWorkoutAudio(session, now, soundEnabled);
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
  const phaseColor = session.phase === "rest" || session.phase === "exercise-complete" ? "success" : session.phase === "execution" ? "danger" : "neutral";
  const phaseName = ({ ready: copy.ready, execution: copy.working, rest: copy.resting, "exercise-complete": copy.exerciseDone })[session.phase];
  const phaseLabel = session.paused ? `${copy.paused} · ${phaseName}` : phaseName;
  const caption = session.phase === "ready" ? `${exercise.sets} ${copy.sets} ${copy.of} ${exercise.repetitions}` : session.phase === "exercise-complete" ? `${copy.completedSets}: ${logs.filter((set) => set.completed).length}` : `${session.phase === "rest" ? copy.nextSet : copy.set} ${session.setIndex + 1} ${copy.of} ${exercise.sets}`;
  const summary = summarizeSession(session, now);
  const command = (action: SessionCommand) => setState((current) => commandForTenant(current, tenantId, session.id, action));
  const finish = (discard = false) => router.run((currentRouter) => {
    setState((current) => finishSession(current, tenantId, session.id, Date.now(), discard)); setConfirmEnd(false);
    currentRouter.replace(discard ? "/" : { pathname: "/summary/[id]", params: { id: session.id } });
  });
  const navigation = <Stack gap={1}><Stack direction="row" gap={1}>
    {session.exerciseIndex > 0 ? <Button variant="outline" onPress={() => command({ type: "exercise", index: session.exerciseIndex - 1 })} accessibilityLabel={copy.previousExercise} icon={<Icon name="ArrowBack" />} /> : null}
    <Box flex={1}>{session.exerciseIndex < session.workout.exercises.length - 1 ? <Button style={{ width: "100%" }} onPress={() => command({ type: "exercise", index: session.exerciseIndex + 1 })} dataTestId="next-exercise">{copy.nextExercise}</Button> : <Button style={{ width: "100%" }} onPress={() => setConfirmEnd(true)} dataTestId="finish-last-exercise">{copy.finish}</Button>}</Box>
  </Stack><Button variant="text" size="sm" onPress={() => router.replace("/")} accessibilityLabel={copy.goHome}>{copy.goHome}</Button></Stack>;
  return <Page testID="gym-session" footer={navigation}>
    <Stack direction="row" gap={1} align="center" justify="between">
      <Button variant="outline" color="neutral" onPress={() => setConfirmEnd(true)} accessibilityLabel={copy.endSession} icon={<Icon name="Close" />} dataTestId="finish-workout" />
      <Stack flex={1} gap={0.5}><Text weight="semibold">{copy.workout} {session.workout.letter} · {session.workout.name}</Text><Muted>{copy.total} {formatClock(now - session.startedAt)}</Muted></Stack>
      <Button variant="outline" color="neutral" onPress={() => setSoundEnabled((enabled) => !enabled)} accessibilityLabel={soundEnabled ? copy.soundOff : copy.soundOn} icon={<Icon name={soundEnabled ? "VolumeUp" : "VolumeOff"} />} dataTestId="toggle-sound" />
    </Stack>
    <Progress value={(session.exerciseIndex + 1) / session.workout.exercises.length * 100} variant="segmented" segments={session.workout.exercises.length} color="primary" />
    <Stack gap={1}><Muted>{copy.exercises} {session.exerciseIndex + 1} {copy.of} {session.workout.exercises.length} · {exercise.muscle}</Muted>
      <Heading level="h1" size="h3">{exercise.name}</Heading><Muted>{exercise.sets} × {exercise.repetitions} · {exercise.executionSeconds}{copy.seconds} {copy.execution} · {exercise.restSeconds}{copy.seconds} {copy.interval}</Muted>
    </Stack>
    <Stack gap={2} align="center">
      <Progress variant="circular" color={phaseColor} value={session.phase === "ready" || session.phase === "exercise-complete" ? 100 : session.durationMs ? remaining / session.durationMs * 100 : 0} circularSize={theme.spacing(32)} thickness={theme.spacing(0.25)} accessibilityLabel={`${phaseLabel}: ${formatClock(remaining)}`} dataTestId="session-dial"
        centerContent={<Stack gap={1} align="center"><Text size="xs" weight="bold" color={phaseColor}>{phaseLabel}</Text><Heading level="h2" size="display" color={phaseColor} dataTestId="session-clock">{session.phase === "exercise-complete" ? "✓" : formatClock(remaining)}</Heading><Text weight="semibold">{caption}</Text></Stack>} />
      {session.phase === "execution" && remaining === 0 ? <Text color="danger" size="sm" accessibilityLiveRegion="polite">{copy.timerEnded}</Text> : null}
      {session.phase === "ready" ? <Button size="lg" color="neutral" style={{ width: "100%" }} onPress={() => command({ type: "start-set", now: Date.now() })} dataTestId="start-set">{copy.startSet}</Button> : null}
      {session.phase === "execution" || session.phase === "rest" ? <Stack direction="row" gap={1} width="100%">
        <Button variant="outline" color="neutral" onPress={() => command({ type: "toggle-pause", now: Date.now() })} dataTestId="pause-timer">{session.paused ? copy.continueTimer : copy.pause}</Button>
        {session.phase === "execution" ? <Box flex={1}><Button style={{ width: "100%" }} color="danger" onPress={() => command({ type: "complete-set", now: Date.now() })} dataTestId="complete-set">{copy.completeSet}</Button></Box> : <><Button variant="outline" onPress={() => command({ type: "extend-rest", milliseconds: 15000 })} accessibilityLabel={copy.moreRest} dataTestId="extend-rest">+15s</Button><Box flex={1}><Button style={{ width: "100%" }} color="success" onPress={() => command({ type: "skip-rest" })} dataTestId="skip-rest">{copy.skipRest}</Button></Box></>}
      </Stack> : null}
      {playback.error ? <Text color="danger" size="sm" accessibilityRole="alert">{copy.audioUnavailable}</Text> : null}
    </Stack>
    <Muted>{copy.timerHint}</Muted>
    <Stack gap={1.5}><SectionTitle>{copy.loads}</SectionTitle><Card variant="outlined" borderRadius="lg"><Stack gap={0}>{logs.map((set, index) => <SetRow key={`${session.id}:${exercise.id}:${index}`} set={set} index={index} target={exercise.repetitions} active={session.setIndex === index && !set.completed}
      onSave={(values) => command({ type: "set-log", exerciseId: exercise.id, setIndex: index, ...values })}
      onToggle={() => command({ type: "toggle-set", exerciseId: exercise.id, setIndex: index })}
      onEdit={() => router.push({ pathname: "/set/[exerciseId]/[setIndex]", params: { exerciseId: exercise.id, setIndex: String(index), sessionId: session.id } })} />)}</Stack></Card></Stack>
    <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)} variant="bottom-sheet" size="sm" borderRadius="xl" style={{ maxWidth: theme.spacing(60) }} showCloseButton={false} title={copy.finishTitle} dataTestId="finish-dialog">
      <DialogContent><Stack gap={2}><Text>{summary.completedSets ? `${copy.finishCompleted} ${summary.completedSets} ${summary.completedSets === 1 ? copy.oneSet : copy.sets}. ${copy.finishRecorded}` : copy.emptyFinishHint}</Text>
        <Button style={{ width: "100%" }} disabled={summary.completedSets === 0} onPress={() => finish()} dataTestId="save-finish">{copy.saveFinish}</Button>
        <Button style={{ width: "100%" }} variant="outline" color="danger" onPress={() => finish(true)}>{copy.discard}</Button>
        <Button style={{ width: "100%" }} variant="ghost" onPress={() => setConfirmEnd(false)}>{copy.keepTraining}</Button>
      </Stack></DialogContent>
    </Dialog>
  </Page>;
}
