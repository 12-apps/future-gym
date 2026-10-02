import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from "react";
import type { DemoClientState } from "./model";
import { createDemoState } from "./sample-data";

interface ClientContextValue {
  state: DemoClientState;
  setState: Dispatch<SetStateAction<DemoClientState>>;
  soundEnabled: boolean;
  setSoundEnabled: Dispatch<SetStateAction<boolean>>;
}
const ClientContext = createContext<ClientContextValue | null>(null);

/** Deliberately session-only mock adapter. Replace at the authenticated API boundary. */
export function DemoClientProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createDemoState);
  const [soundEnabled, setSoundEnabled] = useState(true);
  return <ClientContext.Provider value={{ state, setState, soundEnabled, setSoundEnabled }}>{children}</ClientContext.Provider>;
}
export function useClient() {
  const context = useContext(ClientContext);
  if (!context) throw new Error("DemoClientProvider is missing");
  return context;
}
