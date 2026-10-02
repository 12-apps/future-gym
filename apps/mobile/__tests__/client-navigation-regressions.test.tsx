import { fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import RootLayout from "../app/_layout";
import TabLayout from "../app/(tabs)/_layout";
import HomeScreen from "../app/(tabs)/index";
import WorkoutsScreen from "../app/(tabs)/workouts";
import HistoryScreen from "../app/(tabs)/history";
import WorkoutScreen from "../app/workout/[id]";
import SessionScreen from "../app/session";
import SetEditorScreen from "../app/set/[exerciseId]/[setIndex]";
import SummaryScreen from "../app/summary/[id]";

const routes = {
  _layout: RootLayout, "(tabs)/_layout": TabLayout, "(tabs)/index": HomeScreen,
  "(tabs)/workouts": WorkoutsScreen, "(tabs)/history": HistoryScreen,
  "workout/[id]": WorkoutScreen, session: SessionScreen, "summary/[id]": SummaryScreen, "set/[exerciseId]/[setIndex]": SetEditorScreen,
};
const boot = (initialUrl = "/") => renderRouter(routes, { initialUrl });
const start = async () => {
  boot("/workout/gym-a");
  fireEvent.press(await screen.findByTestId("start-workout"));
  await screen.findByTestId("gym-session");
};


import { act } from "@testing-library/react-native";
import { router } from "expo-router";

// Simulate two native press callbacks already queued before React can unmount the control.
function pressTwice(testID: string) {
  let button = screen.getByTestId(testID);
  while (button && !button.props.onPress) button = button.parent!;
  const press = button.props.onPress;
  act(() => { press({}); press({}); });
}
const startFromHome = async () => {
  boot('/'); await screen.findByTestId('gym-home');
  fireEvent.press(screen.getByTestId('workout-gym-a')); await screen.findByTestId('gym-workout-detail');
  fireEvent.press(screen.getByTestId('start-workout')); await screen.findByTestId('gym-session');

};
afterEach(() => jest.useRealTimers());
describe('adversarial review regression cases', () => {
  it('R1: direct-link Back has a home fallback', async () => {
    boot('/workout/gym-a'); await screen.findByTestId('gym-workout-detail');
    expect(router.canGoBack()).toBe(false);
    fireEvent.press(screen.getByText('Voltar'));
    expect(screen.queryByTestId('gym-home')).not.toBeNull();
  });
  it('R2: midnight refreshes the daily workout without navigation', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    jest.setSystemTime(new Date(2026, 8, 28, 23, 59, 59));
    boot('/'); await screen.findByTestId('gym-home');
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.press(screen.getByTestId('home-open-workout'));
    await screen.findByTestId('gym-workout-detail');
    expect(screen.queryByText('Costas e Bíceps')).not.toBeNull();
  });
  it('R3a: workout cards expose an actionable accessibility role', async () => {
    boot('/'); await screen.findByTestId('gym-home');
    const card = screen.getByTestId('workout-gym-a');
    expect(card.props.accessibilityRole ?? card.props.role).toBe('button');
  });
  it('R3b: history cards expose an actionable accessibility role', async () => {
    await start(); fireEvent.press(screen.getByTestId('toggle-set-0'));
    fireEvent.press(screen.getByTestId('finish-workout')); fireEvent.press(screen.getByTestId('save-finish'));
    await screen.findByTestId('gym-summary'); fireEvent.press(screen.getByText('Voltar à ficha'));
    await screen.findByTestId('gym-home'); fireEvent.press(screen.getByText('Histórico'));
    await screen.findByTestId('gym-history');
    const card = screen.getByTestId(/^history-/);
    expect(card.props.accessibilityRole ?? card.props.role).toBe('button');
  });
  it('R4: duplicate Start creates only one session route', async () => {
    boot('/'); await screen.findByTestId('gym-home');
    fireEvent.press(screen.getByTestId('workout-gym-a')); await screen.findByTestId('gym-workout-detail');
    pressTwice('start-workout'); await screen.findByTestId('gym-session');
    act(() => router.back());
    expect(screen.queryByTestId('gym-workout-detail')).not.toBeNull();
  });
  it('R5a: duplicate Save dismisses the editor only once', async () => {
    await startFromHome();
    fireEvent.press(screen.getByTestId('edit-set-0')); await screen.findByTestId('set-editor');
    fireEvent.changeText(screen.getByTestId('set-load-input'),'42,5');
    pressTwice('save-set');
    expect(screen.queryByTestId('gym-session')).not.toBeNull();
  });
  it('R5b: duplicate Cancel dismisses the editor only once', async () => {
    await startFromHome();
    fireEvent.press(screen.getByTestId('edit-set-0')); await screen.findByTestId('set-editor');
    let button=screen.getByText('Cancelar');
    while(button && !button.props.onPress) button=button.parent!;
    const press=button.props.onPress; act(()=>{press({});press({});});
    expect(screen.queryByTestId('gym-session')).not.toBeNull();
  });
  it('R6: manual completion does not relabel the fully completed exercise as set 1', async () => {
    await start(); for(let i=0;i<4;i++) fireEvent.press(screen.getByTestId('toggle-set-'+i));
    expect(screen.getByText('EXERCÍCIO CONCLUÍDO')).toBeOnTheScreen();
    expect(screen.queryByText('Série 1 de 4')).toBeNull();
    expect(screen.getByText('Séries concluídas: 4')).toBeOnTheScreen();
  });
  it('navigation Back from editor discards the draft', async () => {
    await start(); fireEvent.press(screen.getByTestId('edit-set-0')); await screen.findByTestId('set-editor');
    fireEvent.changeText(screen.getByTestId('set-load-input'),'42,5');
    act(()=>router.back()); await screen.findByTestId('gym-session');
    fireEvent.press(screen.getByTestId('edit-set-0')); await screen.findByTestId('set-editor');
    expect(screen.getByTestId('set-load-input')).toHaveDisplayValue('40');
  });
  it('R4b: duplicate Edit creates only one editor route', async () => {
    await startFromHome();
    pressTwice('edit-set-0'); await screen.findByTestId('set-editor');
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByTestId('gym-session')).not.toBeNull();
  });
  it('R4c: duplicate workout card creates only one details route', async () => {
    boot('/'); await screen.findByTestId('gym-home');
    pressTwice('workout-gym-a'); await screen.findByTestId('gym-workout-detail');
    fireEvent.press(screen.getByText('Voltar'));
    expect(screen.queryByTestId('gym-home')).not.toBeNull();
  });

  it("a queued Save cannot commit after Cancel won the editor exit", async () => {
    await startFromHome();
    fireEvent.press(screen.getByTestId("edit-set-0")); await screen.findByTestId("set-editor");
    fireEvent.changeText(screen.getByTestId("set-load-input"), "42,5");
    let cancel = screen.getByText("Cancelar");
    while (cancel && !cancel.props.onPress) cancel = cancel.parent!;
    let save = screen.getByTestId("save-set");
    while (save && !save.props.onPress) save = save.parent!;
    const cancelPress = cancel.props.onPress, savePress = save.props.onPress;
    act(() => { cancelPress({}); savePress({}); });
    await screen.findByTestId("gym-session");
    fireEvent.press(screen.getByTestId("edit-set-0")); await screen.findByTestId("set-editor");
    expect(screen.getByTestId("set-load-input")).toHaveDisplayValue("40");
  });
  it("a queued Cancel cannot pop again after Save won the editor exit", async () => {
    await startFromHome();
    fireEvent.press(screen.getByTestId("edit-set-0")); await screen.findByTestId("set-editor");
    fireEvent.changeText(screen.getByTestId("set-load-input"), "42,5");
    let cancel = screen.getByText("Cancelar");
    while (cancel && !cancel.props.onPress) cancel = cancel.parent!;
    let save = screen.getByTestId("save-set");
    while (save && !save.props.onPress) save = save.parent!;
    const cancelPress = cancel.props.onPress, savePress = save.props.onPress;
    act(() => { savePress({}); cancelPress({}); });
    expect(screen.queryByTestId("gym-session")).not.toBeNull();
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("42,5");
    expect(screen.getByTestId("inline-reps-0")).toHaveDisplayValue("10");
  });
  it("navigation guards unlock when the workout becomes focused again", async () => {
    await startFromHome();
    act(() => router.back()); await screen.findByTestId("gym-workout-detail");
    fireEvent.press(screen.getByTestId("start-workout"));
    expect(await screen.findByTestId("gym-session")).toBeOnTheScreen();
  });
  it("a duplicate home hero opens one workout route", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] });
    jest.setSystemTime(new Date(2026, 8, 28, 12));
    boot("/"); await screen.findByTestId("gym-home");
    pressTwice("home-open-workout"); await screen.findByTestId("gym-workout-detail");
    fireEvent.press(screen.getByText("Voltar"));
    expect(screen.queryByTestId("gym-home")).not.toBeNull();
  });
  it("a duplicate history card opens one summary route", async () => {
    const rendered = boot("/workout/gym-a");
    fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session"); fireEvent.press(screen.getByTestId("toggle-set-0"));
    fireEvent.press(screen.getByTestId("finish-workout")); fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary"); fireEvent.press(screen.getByText("Voltar à ficha"));
    await screen.findByTestId("gym-home"); fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    let card = screen.getByTestId(/^history-/);
    while (card && !card.props.onPress) card = card.parent!;
    const press = card.props.onPress;
    act(() => { press({}); press({}); });
    await screen.findByTestId("gym-summary");
    act(() => router.back());
    expect({ path: rendered.getPathname(), history: Boolean(screen.queryByTestId("gym-history")), home: Boolean(screen.queryByTestId("gym-home")), summary: Boolean(screen.queryByTestId("gym-summary")) }).toEqual({ path: "/history", history: true, home: false, summary: false });
  });

});
