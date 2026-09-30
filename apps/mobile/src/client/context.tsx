import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from "react";
import type { DemoClientState } from "./model";
import { createDemoState } from "./sample-data";

interface ClientContextValue {
  state: DemoClientState;
  setState: Dispatch<SetStateAction<DemoClientState>>;
}
const ClientContext = createContext<ClientContextValue | null>(null);

/** Deliberately session-only mock adapter. Replace at the authenticated API boundary. */
export function DemoClientProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createDemoState);
  return <ClientContext.Provider value={{ state, setState }}>{children}</ClientContext.Provider>;
}
export function useClient() {
  const context = useContext(ClientContext);
  if (!context) throw new Error("DemoClientProvider is missing");
  return context;
}
