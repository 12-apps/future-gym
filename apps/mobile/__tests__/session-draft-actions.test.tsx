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
  "workout/[id]": WorkoutScreen, session: SessionScreen,
  "set/[exerciseId]/[setIndex]": SetEditorScreen, "summary/[id]": SummaryScreen,
};

async function startExecution() {
  renderRouter(routes, { initialUrl: "/workout/gym-a" });
  fireEvent.press(await screen.findByTestId("start-workout"));
  await screen.findByTestId("gym-session");
  fireEvent.press(screen.getByTestId("start-set"));
}

describe("inline draft and main completion composition", () => {
  it.each([
    ["inline-load-0", "40kg"],
    ["inline-reps-0", "0"],
  ])("refuses the main completion action while %s has a visible invalid draft", async (inputId, draft) => {
    await startExecution();
    const input = screen.getByTestId(inputId);
    fireEvent(input, "focus");
    fireEvent.changeText(input, draft);
    fireEvent(input, "blur");
    expect(screen.getByText(/Use carga de 0/)).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByTestId(inputId)).toHaveDisplayValue(draft);
    expect(screen.getByLabelText("Série 1: Pendente")).toBeOnTheScreen();
    expect(screen.getByText("EXECUÇÃO")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(inputId), inputId === "inline-load-0" ? "42,5" : "9");
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
    expect(screen.queryByText(/Use carga de 0/)).toBeNull();
  });

  it("records the committed decimal load and repetitions through the main completion action", async () => {
    await startExecution();
    fireEvent(screen.getByTestId("inline-load-0"), "focus");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "42,5");
    fireEvent(screen.getByTestId("inline-load-0"), "blur");
    fireEvent(screen.getByTestId("inline-reps-0"), "focus");
    fireEvent.changeText(screen.getByTestId("inline-reps-0"), "9");
    fireEvent(screen.getByTestId("inline-reps-0"), "blur");
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getByText("382,5")).toBeOnTheScreen();
  });

  it("commits a valid focused draft before main completion without depending on a native blur", async () => {
    await startExecution();
    fireEvent(screen.getByTestId("inline-load-0"), "focus");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "42,5");
    fireEvent(screen.getByTestId("inline-load-0"), "blur");
    fireEvent(screen.getByTestId("inline-reps-0"), "focus");
    fireEvent.changeText(screen.getByTestId("inline-reps-0"), "9");
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getByText("382,5")).toBeOnTheScreen();
  });

  it("keeps the session open when finishing would omit an invalid draft on an already completed set", async () => {
    await startExecution();
    fireEvent.press(screen.getByTestId("complete-set"));
    const load = screen.getByTestId("inline-load-0");
    fireEvent(load, "focus");
    fireEvent.changeText(load, "40kg");
    fireEvent(load, "blur");
    expect(screen.getByText(/Use carga de 0/)).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout"));
    expect(screen.getByTestId("gym-session")).toBeOnTheScreen();
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("40kg");
    expect(screen.queryByTestId("save-finish")).toBeNull();
    fireEvent.press(screen.getByText("Cancelar"));
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("40");
    expect(screen.queryByText(/Use carga de 0/)).toBeNull();
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByText("Descartar treino"));
    await screen.findByTestId("gym-home");
    fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    expect(screen.getByText("Nenhum treino concluído ainda")).toBeOnTheScreen();
  });

  it("commits the focused valid draft of a completed set before opening the finish sheet", async () => {
    await startExecution();
    fireEvent.press(screen.getByTestId("complete-set"));
    fireEvent(screen.getByTestId("inline-load-0"), "focus");
    fireEvent.changeText(screen.getByTestId("inline-load-0"), "60");
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByTestId("save-finish"));
    await screen.findByTestId("gym-summary");
    expect(screen.getByText("600")).toBeOnTheScreen();
  });
});
