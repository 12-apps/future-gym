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

describe("native client flows through the real router", () => {
  it("opens the prescribed workout and returns to its home", async () => {
    boot();
    expect(await screen.findByTestId("gym-home")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("workout-gym-a"));
    expect(await screen.findByTestId("gym-workout-detail")).toBeOnTheScreen();
    expect(screen.getByText("Supino reto com barra")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Voltar"));
    expect(await screen.findByTestId("gym-home")).toBeOnTheScreen();
  });
  it("rejects a cross-tenant workout deep link", async () => {
    boot("/workout/personal-a");
    expect(await screen.findByTestId("gym-unavailable")).toBeOnTheScreen();
    expect(screen.queryByTestId("start-workout")).toBeNull();
  });
  it("rejects a stale set editor link without exposing another session", async () => {
    boot("/set/supino-reto/0?sessionId=stale");
    expect(await screen.findByTestId("gym-set-unavailable")).toBeOnTheScreen();
    expect(screen.queryByTestId("set-load-input")).toBeNull();
  });
  it("validates input, cancels without saving, then accepts a decimal load", async () => {
    await start();
    fireEvent.press(screen.getByTestId("edit-set-0"));
    await screen.findByTestId("set-editor");
    fireEvent.changeText(screen.getByTestId("set-load-input"), "40kg");
    fireEvent.press(screen.getByTestId("save-set"));
    expect(screen.getByText(/Use carga de 0/)).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Cancelar"));
    await screen.findByTestId("gym-session");
    fireEvent.press(screen.getByTestId("edit-set-0"));
    await screen.findByTestId("set-editor");
    expect(screen.getByTestId("set-load-input")).toHaveDisplayValue("40");
    fireEvent.changeText(screen.getByTestId("set-load-input"), "42,5");
    fireEvent.changeText(screen.getByTestId("set-reps-input"), "9");
    fireEvent.press(screen.getByTestId("save-set"));
    await screen.findByTestId("gym-session");
    expect(screen.getByTestId("inline-load-0")).toHaveDisplayValue("42,5");
    expect(screen.getByTestId("inline-reps-0")).toHaveDisplayValue("9");
  });
  it("runs, pauses, completes a set, extends and skips rest", async () => {
    await start();
    fireEvent.press(screen.getByTestId("start-set"));
    fireEvent.press(screen.getByTestId("pause-timer"));
    expect(screen.getByText("PAUSADO · EXECUÇÃO")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("pause-timer"));
    fireEvent.press(screen.getByTestId("complete-set"));
    expect(screen.getByText("INTERVALO")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("extend-rest"));
    expect(screen.getByTestId("session-clock")).toHaveTextContent("1:45");
    fireEvent.press(screen.getByText("Pular intervalo"));
    expect(screen.getByText("PRONTO")).toBeOnTheScreen();
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
  });
  it("keeps a session through home navigation and provider round trips", async () => {
    await start();
    fireEvent.press(screen.getByTestId("toggle-set-0"));
    fireEvent.press(screen.getByLabelText("Voltar à ficha"));
    await screen.findByTestId("gym-home");
    fireEvent.press(screen.getByTestId("provider-switch"));
    fireEvent.press(screen.getByTestId("provider-sample-personal"));
    expect(screen.queryByText("TREINO EM ANDAMENTO")).toBeNull();
    expect(screen.getByTestId("workout-personal-a")).toBeOnTheScreen();
    expect(screen.queryByTestId("workout-gym-a")).toBeNull();
    fireEvent.press(screen.getByTestId("provider-switch"));
    fireEvent.press(screen.getByTestId("provider-sample-gym"));
    fireEvent.press(screen.getByTestId("home-open-workout"));
    expect(await screen.findByTestId("gym-session")).toBeOnTheScreen();
    expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
  });
  it("keeps training when dismissal is cancelled and saves performed totals", async () => {
    await start();
    fireEvent.press(screen.getByTestId("toggle-set-0"));
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByText("Continuar treinando"));
    expect(screen.getByTestId("gym-session")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("finish-workout"));
    fireEvent.press(screen.getByTestId("save-finish"));
    expect(await screen.findByTestId("gym-summary")).toBeOnTheScreen();
    expect(screen.getByText("400")).toBeOnTheScreen();
    expect(screen.getByText("Treino concluído")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Voltar à ficha"));
    await screen.findByTestId("gym-home");
    expect(screen.queryByText("TREINO EM ANDAMENTO")).toBeNull();
    fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    expect(screen.getByText("400 kg")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("provider-switch"));
    fireEvent.press(screen.getByTestId("provider-sample-physio"));
    await screen.findByTestId("gym-home");
    fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    expect(screen.getByText("Nenhum treino concluído ainda")).toBeOnTheScreen();
    expect(screen.queryByText("400 kg")).toBeNull();
  });
  it("selects either of two personal trainers and keeps their sessions and histories separate", async () => {
    boot(); await screen.findByTestId("gym-home");
    const changeProvider = async (id: string) => {
      fireEvent.press(screen.getByTestId("provider-switch"));
      expect(screen.getByTestId("provider-sample-personal")).toBeOnTheScreen();
      expect(screen.getByTestId("provider-sample-personal-rafael")).toBeOnTheScreen();
      fireEvent.press(screen.getByTestId(`provider-${id}`));
      await screen.findByTestId("gym-home");
    };
    const begin = async (id: string) => {
      fireEvent.press(screen.getByTestId(`workout-${id}`));
      fireEvent.press(await screen.findByTestId("start-workout"));
      await screen.findByTestId("gym-session");
      fireEvent.press(screen.getByTestId("toggle-set-0"));
      fireEvent.press(screen.getByLabelText("Voltar à ficha"));
      await screen.findByTestId("gym-home");
    };
    const resumeAndSave = async (volume: string) => {
      fireEvent.press(screen.getByTestId("home-open-workout"));
      await screen.findByTestId("gym-session");
      expect(screen.getByLabelText("Série 1: Concluída")).toBeOnTheScreen();
      fireEvent.press(screen.getByTestId("finish-workout"));
      fireEvent.press(screen.getByTestId("save-finish"));
      await screen.findByTestId("gym-summary");
      expect(screen.getByText(volume)).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Voltar à ficha"));
      await screen.findByTestId("gym-home");
      fireEvent.press(screen.getByText("Histórico"));
      await screen.findByTestId("gym-history");
      expect(screen.getByText(`${volume} kg`)).toBeOnTheScreen();
    };
    await changeProvider("sample-personal");
    expect(screen.queryByTestId("workout-personal-rafael-a")).toBeNull();
    await begin("personal-a");
    await changeProvider("sample-personal-rafael");
    expect(screen.queryByTestId("workout-personal-a")).toBeNull();
    expect(screen.queryByText("TREINO EM ANDAMENTO")).toBeNull();
    await begin("personal-rafael-a");
    await changeProvider("sample-personal");
    await resumeAndSave("120");
    expect(screen.queryByText("96 kg")).toBeNull();
    await changeProvider("sample-personal-rafael");
    fireEvent.press(screen.getByText("Histórico"));
    await screen.findByTestId("gym-history");
    expect(screen.getByText("Nenhum treino concluído ainda")).toBeOnTheScreen();
    expect(screen.queryByText("120 kg")).toBeNull();
    fireEvent.press(screen.getByText("Início"));
    await screen.findByTestId("gym-home");
    await resumeAndSave("96");
    expect(screen.queryByText("120 kg")).toBeNull();
  });
  it("disables empty save, discards, and can start fresh", async () => {
    await start();
    fireEvent.press(screen.getByTestId("finish-workout"));
    expect(screen.getByTestId("save-finish")).toBeDisabled();
    fireEvent.press(screen.getByText("Descartar treino"));
    expect(await screen.findByTestId("gym-home")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("workout-gym-a"));
    fireEvent.press(await screen.findByTestId("start-workout"));
    expect(await screen.findByTestId("gym-session")).toBeOnTheScreen();
    expect(screen.getByLabelText("Série 1: Pendente")).toBeOnTheScreen();
  });
});
