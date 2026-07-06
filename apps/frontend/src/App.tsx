import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ElysiaClientProvider } from "@/providers/Eden";
import { Landing } from "./pages/Landing";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";
import { Dashboard } from "./pages/Dashboard";
import { Credits } from "./pages/Credits";
import { ApiKeys } from "./pages/ApiKeys";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ElysiaClientProvider>
        <BrowserRouter>
          <Routes>
            <Route>
              <Route path={"/"} element={<Landing />} />
              <Route path={"/signup"} element={<Signup />} />
              <Route path={"/signin"} element={<Signin />} />
              <Route path={"/dashboard"} element={<Dashboard />} />
              <Route path={"/credits"} element={<Credits />} />
              <Route path={"/api-keys"} element={<ApiKeys />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ElysiaClientProvider>
    </QueryClientProvider>
  )
}
export default App;
