import {
  LayoutGrid,
  ListTodo,
  Wallet,
  GitPullRequest,
  Network,
  Settings,
} from "lucide-react";
import clsx from "clsx";
import type { NavPage } from "../../lib/types.ts";

interface NavItem {
  page: NavPage;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { page: "tasks", label: "Tasks", icon: ListTodo },
  { page: "budget", label: "Budget", icon: Wallet },
  { page: "prs", label: "PRs", icon: GitPullRequest },
  { page: "swarm", label: "Swarm", icon: Network },
  { page: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  connected: boolean;
}

export function Sidebar({ currentPage, onNavigate, connected }: SidebarProps) {
  return (
    <aside className="flex h-full w-14 flex-col items-center border-r border-border-default bg-bg-secondary py-3">
      {/* Logo */}
      <button
        onClick={() => onNavigate("dashboard")}
        className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-green/20 text-sm font-bold text-accent-green transition-colors hover:bg-accent-green/30"
        aria-label="Pawral home"
      >
        P
      </button>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
          const isActive = currentPage === page;
          return (
            <div key={page} className="group relative">
              <button
                onClick={() => onNavigate(page)}
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-accent-blue/15 text-accent-blue"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                )}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} />
              </button>

              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-bg-tertiary px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-bg-tertiary" />
              </div>
            </div>
          );
        })}
      </nav>

      {/* Connection status indicator */}
      <div className="group relative mt-auto pt-3">
        <div
          className={clsx(
            "h-2.5 w-2.5 rounded-full",
            connected ? "bg-accent-green shadow-[0_0_6px_rgba(63,185,80,0.4)]" : "bg-accent-red shadow-[0_0_6px_rgba(248,81,73,0.4)]"
          )}
          aria-label={connected ? "Connected" : "Disconnected"}
        />

        {/* Tooltip */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-tertiary px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {connected ? "Gateway Connected" : "Gateway Disconnected"}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-bg-tertiary" />
        </div>
      </div>
    </aside>
  );
}
