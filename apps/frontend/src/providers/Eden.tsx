import { treaty } from "@elysiajs/eden";
import type { App } from "backend";
import { createContext, useContext, type ReactNode } from "react";

const client = treaty<App>('localhost:3000', {
  fetch: {
    credentials: "include"
  }
});

const ElysiaClientContext = createContext(client);

export function ElysiaClientProvider({ children }: { children: ReactNode }) {
  return (
    <ElysiaClientContext.Provider value={client}>
      {children}
    </ElysiaClientContext.Provider>
  );
}

export const useElysiaClient = () => {
  const client = useContext(ElysiaClientContext);
  return client;
}
