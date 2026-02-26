import { useState } from "react";
import type { NavPage } from "./lib/types.ts";
import { useWebSocket } from "./stores/useWebSocket.ts";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { StatusBar } from "./components/layout/StatusBar.tsx";
import { DashboardPage } from "./components/dashboard/index.ts";
import { TasksPage } from "./components/tasks/index.ts";
import { BudgetPage } from "./components/budget/index.ts";
import { PRsPage } from "./components/prs/index.ts";
import { SwarmPage } from "./components/swarm/index.ts";
import { SettingsPage } from "./components/settings/index.ts";

const PAGE_COMPONENTS: Record<NavPage, React.ComponentType> = {
  dashboard: DashboardPage,
  tasks: TasksPage,
  budget: BudgetPage,
  prs: PRsPage,
  swarm: SwarmPage,
  settings: SettingsPage,
};

export function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>("dashboard");
  const { isConnected } = useWebSocket();

  const PageComponent = PAGE_COMPONENTS[currentPage];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        connected={isConnected}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <PageComponent />
        </main>

        <StatusBar />
      </div>
    </div>
  );
}
