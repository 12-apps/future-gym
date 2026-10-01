import { fireEvent, within } from "@testing-library/react-native";
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
  it("builds Monday-Sunday dates across year boundaries without UTC day drift", () => {
    const week = calendarWeek(new Date(2027, 0, 1, 12));
    expect(week.map(date => date.getDate())).toEqual([28, 29, 30, 31, 1, 2, 3]);
    expect(isoWeekNumber(new Date(2027, 0, 1, 12))).toBe(53);
    expect(isoWeekNumber(new Date(2027, 0, 4, 12))).toBe(1);
  });
});
