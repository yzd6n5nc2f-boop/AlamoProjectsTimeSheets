import { useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { useAppState, type AppRole } from "../state/AppStateContext";

const ROLE_DESTINATION: Record<AppRole, string> = {
  EMPLOYEE: "/employee",
  MANAGER: "/manager/queue",
  PAYROLL: "/payroll/dashboard",
  ADMIN: "/admin/rules"
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  EMPLOYEE: "Enter daily rows, validate, and submit",
  MANAGER: "Approve/reject OT and PH worked",
  PAYROLL: "Resolve exceptions, validate, export, lock",
  ADMIN: "Manage calendar rules and leave settings"
};

export function LoginPage() {
  const navigate = useNavigate();
  const { role, setRole } = useAppState();

  return (
    <Panel title="Login" subtitle="Select a role to simulate the MVP workflow.">
      <div className="role-picker">
        {(Object.keys(ROLE_DESTINATION) as AppRole[]).map((option) => (
          <button
            type="button"
            key={option}
            className={`role-card ${option === role ? "role-card-active" : ""}`}
            onClick={() => setRole(option)}
          >
            <div className="role-card-top">
              <h3>{option}</h3>
              {option === role ? <StatusChip label="Current" tone="info" /> : null}
            </div>
            <p>{ROLE_DESCRIPTIONS[option]}</p>
          </button>
        ))}
      </div>

      <div className="inline-actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate(ROLE_DESTINATION[role])}>
          Continue as {role}
        </button>
      </div>
    </Panel>
  );
}
