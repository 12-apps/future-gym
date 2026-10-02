import { renderRouter, screen } from "expo-router/testing-library";
import RootLayout from "../app/_layout";
import TabLayout from "../app/(tabs)/_layout";
import WorkoutsScreen from "../app/(tabs)/workouts";
import HistoryScreen from "../app/(tabs)/history";
import FoundationScreen from "../app/(tabs)/index";

it("boots the real router into the native client home route", async () => {
  const router = renderRouter({
    _layout: RootLayout,
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": FoundationScreen,
    "(tabs)/workouts": WorkoutsScreen,
    "(tabs)/history": HistoryScreen,
  }, { initialUrl: "/" });
  expect(await screen.findByTestId("gym-home")).toBeOnTheScreen();
  expect(router.getPathname()).toBe("/");
  expect(screen.getByText("Início")).toBeOnTheScreen();
});
