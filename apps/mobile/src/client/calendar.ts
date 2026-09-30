import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/** Refresh at local midnight, on focus, and after delayed/background timer delivery. */
export function useCalendarDate(): Date {
  const [today, setToday] = useState(() => new Date());
  const refresh = useCallback(() => {
    const current = new Date();
    setToday((previous) => previous.toDateString() === current.toDateString() ? previous : current);
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      refresh();
      const current = new Date();
      const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
      timer = setTimeout(check, Math.max(1, Math.min(60000, midnight.getTime() - current.getTime())));
    };
    check();
    return () => clearTimeout(timer);
  }, [refresh]);
  return today;
}
