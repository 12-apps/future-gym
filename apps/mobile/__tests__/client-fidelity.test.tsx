import { act, fireEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { setAudioModeAsync } from "expo-audio";
import RootLayout from "../app/_layout";
import TabLayout from "../app/(tabs)/_layout";
import HomeScreen from "../app/(tabs)/index";
import WorkoutsScreen from "../app/(tabs)/workouts";
import HistoryScreen from "../app/(tabs)/history";
import WorkoutScreen from "../app/workout/[id]";
import SessionScreen from "../app/session";
import SetEditorScreen from "../app/set/[exerciseId]/[setIndex]";
import SummaryScreen from "../app/summary/[id]";
import { calendarWeek, isoWeekNumber } from "../src/client/calendar";

const routes = {
  _layout: RootLayout, "(tabs)/_layout": TabLayout, "(tabs)/index": HomeScreen,
  "(tabs)/workouts": WorkoutsScreen, "(tabs)/history": HistoryScreen,
  "workout/[id]": WorkoutScreen, session: SessionScreen, "summary/[id]": SummaryScreen,
  "set/[exerciseId]/[setIndex]": SetEditorScreen,
};
const boot = (initialUrl = "/") => renderRouter(routes, { initialUrl });
afterEach(() => jest.useRealTimers());

describe("original prototype information and persistent actions", () => {
  it("keeps date numbers and a dated weekly schedule, including repeated workouts and rest", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] }); jest.setSystemTime(new Date(2026, 9, 1, 12));
    boot(); await screen.findByTestId("gym-home");
    expect(screen.getByTestId("calendar-date-0")).toHaveTextContent("28");
    expect(screen.getByTestId("calendar-date-3")).toHaveTextContent("1");
    expect(screen.getByTestId("calendar-date-6")).toHaveTextContent("4");
    expect(screen.getByTestId("workout-gym-a-day-4")).toBeOnTheScreen();
    expect(screen.getByTestId("rest-day-3")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("home-next-workout"));
    await screen.findByTestId("gym-workout-detail");
    expect(screen.getByText("Peito e Tríceps")).toBeOnTheScreen();
  });
  it("does not invent a next-workout action after the week's final planned day", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] }); jest.setSystemTime(new Date(2026, 9, 4, 12));
    boot(); await screen.findByTestId("gym-home");
    expect(screen.queryByTestId("home-next-workout")).toBeNull();
    expect(screen.getByText("Semana encerrada. Bom trabalho.")).toBeOnTheScreen();
  });
  it("opens the existing planned-volume section directly from home", async () => {
    boot(); await screen.findByTestId("gym-home");
    fireEvent.press(screen.getByTestId("home-volume"));
    await screen.findByTestId("gym-workouts");
    expect(screen.getByTestId("planned-volume")).toBeOnTheScreen();
  });
  it("keeps workout start outside the scrolling exercise list", async () => {
    boot("/workout/gym-a"); await screen.findByTestId("gym-workout-detail");
    expect(screen.getByText(/5 exercícios · 16 séries · ~30 min/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("gym-workout-detail-footer")).getByTestId("start-workout")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gym-workout-detail-body")).queryByTestId("start-workout")).toBeNull();
  });
  it("retains unperformed summary rows, pinned return, and tenant history aggregates", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session"); fireEvent.press(screen.getByTestId("toggle-set-0"));
    fireEvent.press(screen.getByTestId("finish-workout")); fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getAllByText("Não realizado")).toHaveLength(4);
    fireEvent.press(within(screen.getByTestId("gym-summary-footer")).getByText("Voltar à ficha"));
    await screen.findByTestId("gym-home"); fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    expect(screen.getByText("Toneladas")).toBeOnTheScreen();
    expect(screen.getByText(/min · 1 séries/)).toBeOnTheScreen();
  });
  it("records valid inline loads and repetitions and refuses invalid completion", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "40kg");
    fireEvent.press(screen.getByTestId("toggle-set-0"));
    expect(screen.getByText(/Use carga de 0/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Série 1: Pendente")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Cancelar"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("40");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "42,5");
    fireEvent.changeText(screen.getByTestId("inline-reps-0"), "9");
    fireEvent.press(screen.getByTestId("toggle-set-0"));
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout")); fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getByText("382,5")).toBeOnTheScreen();
  });
  it("abandons an invalid inline draft when entering the existing routed editor", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session");
    const input = screen.getByTestId("inline-load-0");
    fireEvent(input, "focus"); fireEvent.changeText(input, "40kg");
    fireEvent.press(screen.getByTestId("toggle-set-0"));
    expect(screen.getByText(/Use carga de 0/)).toBeOnTheScreen();
    const lateBlur = screen.getByTestId("inline-load-0").props.onBlur;
    fireEvent.press(screen.getByTestId("edit-set-0"));
    // A late native blur after navigation must not restore the discarded error.
    act(() => lateBlur());
    await screen.findByTestId("set-editor");
    expect(screen.getByTestId("set-load-input")).toHaveDisplayValue("40");
    fireEvent.press(screen.getByTestId("save-set"));
    await screen.findByTestId("gym-session");
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("40");
    expect(screen.queryByText(/Use carga de 0/)).toBeNull();
    expect(screen.getByLabelText("Série 1: Pendente")).toBeOnTheScreen();
  });
  it("steps inline loads by 2.5 kg without permitting negative or excessive load", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session"); fireEvent.press(screen.getByTestId("decrease-load-0"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("37,5");
    fireEvent.press(screen.getByTestId("increase-load-0"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("40");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "0"); fireEvent.press(screen.getByTestId("decrease-load-0"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("0");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "1000"); fireEvent.press(screen.getByTestId("increase-load-0"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("1000");
  });
  it("keeps the timer caption inside the shared dial and next-exercise action outside scrolling", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session");
    const center = within(screen.getByTestId("session-dial-center"));
    expect(center.getByTestId("session-clock")).toHaveTextContent("0:40");
    expect(center.getByText("4 séries de 10")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gym-session-footer")).getByTestId("next-exercise")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gym-session-body")).queryByTestId("next-exercise")).toBeNull();
    fireEvent.press(screen.getByTestId("start-set")); fireEvent.press(screen.getByTestId("pause-timer"));
    expect(center.getByText("PAUSADO · EXECUÇÃO")).toBeOnTheScreen();
  });
  it("retains the sound setting across navigation and keeps ordinary finish dismissal", async () => {
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByTestId("gym-session");
    fireEvent.press(screen.getByTestId("toggle-sound"));
    expect(screen.getByLabelText("Ligar som")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Voltar à ficha")); await screen.findByTestId("gym-home");
    fireEvent.press(screen.getByTestId("home-open-workout")); await screen.findByTestId("gym-session");
    expect(screen.getByLabelText("Ligar som")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout"));
    expect(screen.queryByTestId("finish-dialog-close")).toBeNull();
    fireEvent.press(screen.getByText("Continuar treinando"));
    expect(screen.queryByTestId("save-finish")).toBeNull();
  });
  it("shows a playback configuration failure without blocking explicit set recording", async () => {
    jest.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error("Audio session unavailable"));
    boot("/workout/gym-a"); fireEvent.press(await screen.findByTestId("start-workout"));
    await screen.findByText("Som indisponível. O timer e os registros continuam funcionando.");
    fireEvent.press(screen.getByTestId("start-set"));
    expect(screen.getByText("EXECUÇÃO")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout")); fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getByText("400")).toBeOnTheScreen();
  });
  it("builds Monday-Sunday dates across year boundaries without UTC day drift", () => {
    const week = calendarWeek(new Date(2027, 0, 1, 12));
    expect(week.map(date => date.getDate())).toEqual([28, 29, 30, 31, 1, 2, 3]);
    expect(isoWeekNumber(new Date(2027, 0, 1, 12))).toBe(53);
    expect(isoWeekNumber(new Date(2027, 0, 4, 12))).toBe(1);
  });
});
