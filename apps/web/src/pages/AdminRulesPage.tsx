import { useState } from "react";
import { Panel } from "../components/Panel";
import { useAppState } from "../state/AppStateContext";

export function AdminRulesPage() {
  const { ruleSettings, updateRuleSettings } = useAppState();
  const [message, setMessage] = useState("");

  return (
    <Panel title="Admin Calendar and Rules" subtitle="Effective settings for paid-hours and day-type behavior">
      {message ? <p className="alert">{message}</p> : null}

      <div className="form-grid">
        <label className="field">
          Full day paid minutes
          <input
            type="number"
            value={ruleSettings.fullDayMinutes}
            onChange={(event) => updateRuleSettings({ fullDayMinutes: Number(event.target.value) || 0 })}
          />
        </label>

        <label className="field">
          Leave default paid minutes/day
          <input
            type="number"
            value={ruleSettings.leavePaidMinutesDefault}
            onChange={(event) => updateRuleSettings({ leavePaidMinutesDefault: Number(event.target.value) || 0 })}
          />
        </label>

        <label className="field">
          Friday short day normal minutes
          <input
            type="number"
            value={ruleSettings.fridayShortDayMinutes}
            onChange={(event) => updateRuleSettings({ fridayShortDayMinutes: Number(event.target.value) || 0 })}
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={ruleSettings.earlyKnockOffPaidFullDay}
            onChange={(event) => updateRuleSettings({ earlyKnockOffPaidFullDay: event.target.checked })}
          />
          Early knock-off paid as full day
        </label>
      </div>

      <label className="field">
        Public holiday dates (comma-separated)
        <input
          value={ruleSettings.publicHolidays.join(",")}
          onChange={(event) =>
            updateRuleSettings({
              publicHolidays: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            })
          }
        />
      </label>

      <label className="field">
        Early knock-off dates (comma-separated)
        <input
          value={ruleSettings.earlyKnockOffDates.join(",")}
          onChange={(event) =>
            updateRuleSettings({
              earlyKnockOffDates: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            })
          }
        />
      </label>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setMessage("Rules saved. Timesheet calculations have been recalculated in this session.")}
        >
          Save Rules
        </button>
      </div>
    </Panel>
  );
}
