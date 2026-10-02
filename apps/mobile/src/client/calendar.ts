import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

export function calendarWeek(date: Date): Date[] {
  const offset = (date.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset + index));
}

export function isoWeekNumber(date: Date): number {
  const thursday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

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
