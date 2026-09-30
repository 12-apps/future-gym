import { renderRouter, screen } from "expo-router/testing-library";
import RootLayout from "../app/_layout";
import TabLayout from "../app/(tabs)/_layout";
import FoundationScreen from "../app/(tabs)/index";

it("boots the real router into the native foundation route", async () => {
  const router = renderRouter({
    _layout: RootLayout,
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": FoundationScreen,
  }, { initialUrl: "/" });
  expect(await screen.findByTestId("gym-foundation")).toBeOnTheScreen();
  expect(router.getPathname()).toBe("/");
});
