import { useState, useCallback } from "react";
import clsx from "clsx";
import {
  Globe,
  Users,
  Wallet,
  Key,
  Puzzle,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  Save,
  RotateCcw,
  Circle,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settings.ts";
import { useWorkersStore } from "../../stores/workers.ts";
import { useConnectionStore } from "../../stores/useWebSocket.ts";

// --- types -------------------------------------------------------------------

type SettingsSection =
  | "gateway"
  | "workers"
  | "budget"
  | "api-keys"
  | "integrations"
  | "security";

interface NavItem {
  key: SettingsSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: "gateway", label: "Gateway Connection", icon: Globe },
  { key: "workers", label: "Workers", icon: Users },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "integrations", label: "Integrations", icon: Puzzle },
  { key: "security", label: "Security", icon: Shield },
];

// --- helper components -------------------------------------------------------

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}

function TextInput({ label, value, onChange, placeholder, type = "text", mono }: TextInputProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          "w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accent-blue focus:outline-none",
          mono && "font-mono",
        )}
      />
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberInput({ label, value, onChange, min, max, step }: NumberInputProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary transition-colors focus:border-accent-blue focus:outline-none"
      />
    </div>
  );
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function SelectInput({ label, value, onChange, options }: SelectInputProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors focus:border-accent-blue focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent-green" : "bg-border-default",
        )}
      >
        <span
          className={clsx(
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          )}
        />
      </button>
    </div>
  );
}

// --- gateway section ---------------------------------------------------------

function GatewaySection() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const connected = useConnectionStore((state) => state.connected);
  const [showToken, setShowToken] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);

  const handleTestConnection = useCallback(() => {
    setConnectionTested(true);
    setTimeout(() => setConnectionTested(false), 3000);
  }, []);

  return (
    <div className="space-y-8">
      {/* Gateway heading with badge */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">OpenClaw Gateway</h2>
          <span className={clsx(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            connected
              ? "bg-accent-green/15 text-accent-green"
              : "bg-accent-yellow/15 text-accent-yellow",
          )}>
            <CheckCircle2 size={12} />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Configure the connection to your OpenClaw Gateway instance
        </p>
      </div>

      {/* Connection settings */}
      <div className="space-y-4 rounded-lg border border-border-default bg-bg-secondary p-4">
        <TextInput
          label="Gateway URL"
          value={settings.gatewayUrl}
          onChange={(v) => updateSettings({ gatewayUrl: v })}
          placeholder="ws://localhost:3002"
          mono
        />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Auth Token
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={settings.authToken}
              onChange={(e) => updateSettings({ authToken: e.target.value })}
              placeholder="Enter authentication token"
              className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 pr-10 font-mono text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accent-blue focus:outline-none"
            />
            <button
              onClick={() => setShowToken((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleTestConnection}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              connectionTested
                ? "border-accent-green text-accent-green"
                : "border-accent-blue text-accent-blue hover:bg-accent-blue/10",
            )}
          >
            {connectionTested ? (
              <>
                <CheckCircle2 size={14} />
                Connected
              </>
            ) : (
              <>
                <Zap size={14} />
                Test Connection
              </>
            )}
          </button>

          <button className="inline-flex items-center gap-1.5 rounded-md border border-accent-blue px-3 py-1.5 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue/10">
            <RefreshCw size={14} />
            Reconnect
          </button>
        </div>
      </div>

      {/* Worker configuration */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Worker Configuration</h3>
        <div className="space-y-4 rounded-lg border border-border-default bg-bg-secondary p-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Active Workers"
              value={settings.workerCount}
              onChange={(v) => updateSettings({ workerCount: v })}
              min={1}
              max={12}
            />

            <SelectInput
              label="Default Model"
              value={settings.defaultModel}
              onChange={(v) => updateSettings({ defaultModel: v })}
              options={[
                { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
                { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
                { value: "codex", label: "Codex" },
              ]}
            />
          </div>

          <TextInput
            label="Workspace Path"
            value={settings.workspaceBase}
            onChange={(v) => updateSettings({ workspaceBase: v })}
            placeholder="~/swarm-workspaces"
            mono
          />

          <div className="space-y-3 border-t border-border-muted pt-4">
            <ToggleSwitch
              label="Auto-sandbox"
              description="Run all workers in Docker sandbox containers"
              checked={settings.autoSandbox}
              onChange={(v) => updateSettings({ autoSandbox: v })}
            />

            <ToggleSwitch
              label="Enable Orchestrator"
              description="Allow Orchestrator agent to manage task decomposition"
              checked={settings.enableOrchestrator}
              onChange={(v) => updateSettings({ enableOrchestrator: v })}
            />
          </div>
        </div>
      </div>

      {/* Save / Reset */}
      <div className="flex items-center gap-3">
        <button className="inline-flex items-center gap-1.5 rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green/90">
          <Save size={16} />
          Save Changes
        </button>

        <button
          onClick={resetSettings}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// --- workers section ---------------------------------------------------------

const STATUS_DOT: Record<string, string> = {
  idle: "bg-text-muted",
  planning: "bg-accent-yellow",
  coding: "bg-accent-green",
  testing: "bg-accent-blue",
  pr: "bg-accent-blue",
  error: "bg-accent-red",
};

function WorkersSection() {
  const { workers } = useWorkersStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Workers</h2>
        <p className="mt-1 text-sm text-text-secondary">
          View and manage active worker agents
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-default bg-bg-secondary">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-muted text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">Worker</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Current Task</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr
                key={worker.id}
                className="border-b border-border-muted transition-colors last:border-b-0 hover:bg-bg-tertiary"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-text-primary">{worker.id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Circle
                      size={8}
                      className={clsx("fill-current", STATUS_DOT[worker.status] ?? "bg-text-muted")}
                      style={{ color: "currentColor" }}
                    />
                    <span
                      className={clsx(
                        "text-xs font-medium capitalize",
                        worker.status === "idle" && "text-text-muted",
                        worker.status === "coding" && "text-accent-green",
                        worker.status === "planning" && "text-accent-yellow",
                        worker.status === "testing" && "text-accent-blue",
                        worker.status === "pr" && "text-accent-blue",
                        worker.status === "error" && "text-accent-red",
                      )}
                    >
                      {worker.status}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">
                  {worker.workspace}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">
                  {worker.model}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-xs text-text-secondary">
                  {worker.currentTask?.title ?? (
                    <span className="text-text-muted">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- budget section ----------------------------------------------------------

function BudgetSection() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Budget Limits</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Set spending limits to control AI costs
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border-default bg-bg-secondary p-4">
        <div className="grid grid-cols-3 gap-4">
          <NumberInput
            label="Daily Budget ($)"
            value={settings.dailyBudget}
            onChange={(v) => updateSettings({ dailyBudget: v })}
            min={0}
            step={5}
          />
          <NumberInput
            label="Weekly Budget ($)"
            value={settings.weeklyBudget}
            onChange={(v) => updateSettings({ weeklyBudget: v })}
            min={0}
            step={10}
          />
          <NumberInput
            label="Monthly Budget ($)"
            value={settings.monthlyBudget}
            onChange={(v) => updateSettings({ monthlyBudget: v })}
            min={0}
            step={50}
          />
        </div>

        <div className="border-t border-border-muted pt-4">
          <ToggleSwitch
            label="Auto PR"
            description="Automatically create pull requests when tasks complete"
            checked={settings.autoPR}
            onChange={(v) => updateSettings({ autoPR: v })}
          />
        </div>

        <div className="border-t border-border-muted pt-4">
          <NumberInput
            label="Default Budget per Task ($)"
            value={3}
            onChange={() => {
              // Placeholder for per-task budget — not yet in settings type
            }}
            min={0}
            step={0.5}
          />
        </div>
      </div>

      <button className="inline-flex items-center gap-1.5 rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green/90">
        <Save size={16} />
        Save Budget Settings
      </button>
    </div>
  );
}

// --- placeholder sections ----------------------------------------------------

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-16 text-sm text-text-muted">
        Coming soon
      </div>
    </div>
  );
}

// --- section renderer --------------------------------------------------------

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "gateway":
      return <GatewaySection />;
    case "workers":
      return <WorkersSection />;
    case "budget":
      return <BudgetSection />;
    case "api-keys":
      return (
        <PlaceholderSection
          title="API Keys"
          description="Manage API keys for AI providers"
        />
      );
    case "integrations":
      return (
        <PlaceholderSection
          title="Integrations"
          description="Connect to GitHub, Linear, and other services"
        />
      );
    case "security":
      return (
        <PlaceholderSection
          title="Security"
          description="Configure security policies and access controls"
        />
      );
  }
}

// --- main component ----------------------------------------------------------

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("gateway");

  return (
    <div className="flex h-full">
      {/* Left sub-nav */}
      <nav className="w-[200px] shrink-0 border-r border-border-default bg-bg-secondary p-3">
        <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Settings
        </h2>
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                activeSection === key
                  ? "bg-accent-blue/15 text-accent-blue"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-6">
        <SectionContent section={activeSection} />
      </div>
    </div>
  );
}
