import { useEffect, useMemo, useState } from "react";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { useAppState } from "../state/AppStateContext";

const DECLARATIONS = {
  EMPLOYEE: "I certify this monthly timesheet is true and complete to the best of my knowledge.",
  MANAGER:
    "I approve this monthly timesheet after review and confirm approvals for overtime/public holiday work where required."
} as const;

export function SignatureSetupPage() {
  const {
    role,
    signatureProfiles,
    upsertSignatureProfile,
    clearSignatureProfile,
    employeeSignature,
    managerSignature
  } = useAppState();
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  const signRole = role === "EMPLOYEE" || role === "MANAGER" ? role : null;
  const profile = signRole ? signatureProfiles[signRole] : undefined;

  const declaration = useMemo(() => {
    if (!signRole) {
      return "";
    }
    return profile?.declaration || DECLARATIONS[signRole];
  }, [profile?.declaration, signRole]);

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
  }, [profile?.fullName, signRole]);

  if (!signRole) {
    return (
      <Panel title="Electronic Signature Setup" subtitle="Not available for this role">
        <p>This setup is available only for Employee and Manager roles.</p>
      </Panel>
    );
  }

  const activeRevisionSignature = signRole === "EMPLOYEE" ? employeeSignature : managerSignature;

  return (
    <Panel title="Electronic Signature Setup" subtitle={`Configure your persistent ${signRole.toLowerCase()} signature profile`}>
      {message ? <p className="alert">{message}</p> : null}

      <div className="signature-panel">
        <div className="signature-panel-head">
          <h3>Profile</h3>
          <StatusChip label={profile ? "Configured" : "Not Configured"} tone={profile ? "good" : "warn"} />
        </div>

        <label className="field">
          Full legal name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Type full legal name" />
        </label>

        <label className="field">
          Signature declaration
          <textarea value={declaration} readOnly rows={3} />
        </label>

        <div className="inline-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const result = upsertSignatureProfile(signRole, fullName);
              setMessage(result.message);
            }}
          >
            Save Signature Profile
          </button>
          <button
            type="button"
            className="btn"
            disabled={!profile}
            onClick={() => {
              clearSignatureProfile(signRole);
              setMessage(`${signRole} signature profile cleared.`);
            }}
          >
            Clear Signature Profile
          </button>
        </div>

        {profile ? (
          <p className="subtle-note">
            Saved profile: {profile.fullName} | setup {new Date(profile.setupAt).toLocaleString()} | hash {profile.profileHash}
          </p>
        ) : null}
      </div>

      {activeRevisionSignature ? (
        <p className="subtle-note">
          Current revision signature: {activeRevisionSignature.signedBy} at{" "}
          {new Date(activeRevisionSignature.signedAt).toLocaleString()} | hash {activeRevisionSignature.signatureHash}
        </p>
      ) : (
        <p className="subtle-note">No signature applied to the current revision yet.</p>
      )}
    </Panel>
  );
}

