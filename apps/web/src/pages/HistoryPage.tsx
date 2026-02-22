import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

export function HistoryPage() {
  const { status, revisionNo, approvals } = useAppState();

  return (
    <Panel
      title="History"
      subtitle="Revision chain and approval/audit timeline"
      actions={<StatusChip label={`Revision ${revisionNo}`} tone="info" />}
    >
      <p>
        Current status: <StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />
      </p>

      <div className="timeline">
        {approvals.length === 0 ? <p>No approval events yet.</p> : null}
        {approvals.map((event) => (
          <article className="timeline-item" key={`${event.at}-${event.action}`}>
            <h3>{event.action}</h3>
            <p>
              {new Date(event.at).toLocaleString()} by {event.actor}
            </p>
            <p>{event.note}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
