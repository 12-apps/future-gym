import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useRef } from "react";

type NativeRouter = ReturnType<typeof useRouter>;

/** Keep a queued press from navigating again after this screen has already left. */
export function useSingleNavigation() {
  const router = useRouter();
  const locked = useRef(false);
  useFocusEffect(useCallback(() => {
    locked.current = false;
    return () => { locked.current = true; };
  }, []));
  const run = useCallback((action: (router: NativeRouter) => void) => {
    if (locked.current) return;
    locked.current = true;
    try { action(router); }
    catch (error) { locked.current = false; throw error; }
  }, [router]);
  return {
    run,
    push: (...args: Parameters<NativeRouter["push"]>) => run((current) => current.push(...args)),
    replace: (...args: Parameters<NativeRouter["replace"]>) => run((current) => current.replace(...args)),
    back: (fallback: Href = "/") => run((current) => {
      if (current.canGoBack()) current.back(); else current.replace(fallback);
    }),
  };
}
