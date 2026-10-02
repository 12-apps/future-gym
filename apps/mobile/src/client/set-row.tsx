import { useLocaleCopy } from "@12-apps/i18n/react";
import { Checkbox } from "@12-apps/ui/form/Checkbox";
import { Button } from "@12-apps/ui/form/Button";
import { Input } from "@12-apps/ui/form/Input";
import { Box } from "@12-apps/ui/layout/Box";
import { Card } from "@12-apps/ui/layout/Card";
import { Stack } from "@12-apps/ui/layout/Stack";
import { useUiTheme } from "@12-apps/ui/provider";
import { Text } from "@12-apps/ui/typography/Text";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CLIENT_COPY, formatInputNumber } from "./copy";
import { parseSetInput, type SetLog } from "./model";

export type SetRowHandle = { commit: () => boolean };

/** Inline prototype controls keep invalid drafts out of the session model. */
export function SetRow({ ref, set, index, target, active, onSave, onToggle, onEdit }: {
  ref?: Ref<SetRowHandle>;
  set: SetLog; index: number; target: number; active: boolean;
  onSave: (values: { kg: number; repetitions: number }) => void;
  onToggle: () => void; onEdit: () => void;
}) {
  const copy = useLocaleCopy(CLIENT_COPY); const theme = useUiTheme();
  const [kg, setKg] = useState(() => formatInputNumber(set.kg));
  const [reps, setReps] = useState(() => String(set.repetitions));
  const [invalid, setInvalid] = useState(false); const focused = useRef(false); const ignoreNextBlur = useRef(false);
  useEffect(() => {
    if (!focused.current) { setKg(formatInputNumber(set.kg)); setReps(String(set.repetitions)); setInvalid(false); }
  }, [set.kg, set.repetitions]);
  const commit = () => {
    const parsed = parseSetInput(kg, reps);
    if (!parsed) { setInvalid(true); return false; }
    setInvalid(false); onSave(parsed); return true;
  };
  useImperativeHandle(ref, () => ({ commit }));
  const focus = () => { focused.current = true; ignoreNextBlur.current = false; };
  const blur = () => {
    focused.current = false;
    if (ignoreNextBlur.current) { ignoreNextBlur.current = false; return; }
    commit();
  };
  const resetDraft = () => {
    ignoreNextBlur.current = true; focused.current = false;
    setKg(formatInputNumber(set.kg)); setReps(String(set.repetitions)); setInvalid(false);
  };
  const step = (amount: number) => {
    const parsed = parseSetInput(kg, reps);
    if (!parsed) { setInvalid(true); return; }
    const next = { ...parsed, kg: Math.min(1000, Math.max(0, Math.round((parsed.kg + amount) * 100) / 100)) };
    setKg(formatInputNumber(next.kg)); setInvalid(false); onSave(next);
  };
  return <Card variant="outlined" borderRadius="none" style={{ backgroundColor: active ? theme.palette.action.selected : theme.palette.background.paper }} dataTestId={`set-row-${index}`}>
    <Stack p={1} gap={1}>
      <Stack direction="row" gap={0.5} align="center">
        <Checkbox variant="rounded" checked={set.completed} onChange={() => { if (commit()) onToggle(); }} accessibilityLabel={`${copy.set} ${index + 1}: ${set.completed ? copy.completed : copy.pending}`} dataTestId={`toggle-set-${index}`} />
        <Stack flex={1} gap={0.5}><Button variant="text" size="xs" onPress={() => { resetDraft(); onEdit(); }} accessibilityLabel={`${copy.edit} ${copy.set.toLowerCase()} ${index + 1}`} dataTestId={`edit-set-${index}`}>{copy.set} {index + 1}</Button><Text size="xs">{copy.target} {target}</Text></Stack>
        <Box width={theme.spacing(7)}><Input size="xs" label="reps" accessibilityLabel={`${copy.reps}, ${copy.set} ${index + 1}`} value={reps} onChangeText={setReps} onFocus={focus} onBlur={blur} inputMode="numeric" error={invalid} dataTestId={`inline-reps-${index}`} /></Box>
        <Button size="xs" variant="outline" color="neutral" style={{ width: theme.spacing(4) }} onPress={() => step(-2.5)} accessibilityLabel={`${copy.decreaseLoad}, ${copy.set} ${index + 1}`} dataTestId={`decrease-load-${index}`}>−</Button>
        <Box width={theme.spacing(8)}><Input size="xs" label="kg" accessibilityLabel={`${copy.kg}, ${copy.set} ${index + 1}`} value={kg} onChangeText={setKg} onFocus={focus} onBlur={blur} inputMode="decimal" error={invalid} dataTestId={`inline-load-${index}`} /></Box>
        <Button size="xs" variant="outline" color="neutral" style={{ width: theme.spacing(4) }} onPress={() => step(2.5)} accessibilityLabel={`${copy.increaseLoad}, ${copy.set} ${index + 1}`} dataTestId={`increase-load-${index}`}>+</Button>
      </Stack>
      {invalid ? <Stack gap={1}><Text color="danger" size="sm" accessibilityRole="alert">{copy.invalidSet}</Text><Button variant="ghost" size="sm" onPress={resetDraft}>{copy.cancel}</Button></Stack> : null}
    </Stack>
  </Card>;
}
