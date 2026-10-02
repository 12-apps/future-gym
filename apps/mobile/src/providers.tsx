import { DEFAULT_LOCALE } from "@12-apps/i18n";
import { LocaleProvider } from "@12-apps/i18n/react";
import { UiProvider } from "@12-apps/ui/provider";
import type { PropsWithChildren } from "react";
import { DemoClientProvider } from "./client/context";

/** One shared UI and explicit pt-BR locale boundary for every future route. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <UiProvider>
      <LocaleProvider locale={DEFAULT_LOCALE}><DemoClientProvider>{children}</DemoClientProvider></LocaleProvider>
    </UiProvider>
  );
}
