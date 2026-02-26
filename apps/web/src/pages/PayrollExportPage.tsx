import { useState } from "react";
import { BRANDING } from "@timesheet/shared";
import { Panel } from "../components/Panel";
import { StatusChip } from "../components/StatusChip";
import workbookLogoLockup from "../assets/workbook-logo-lockup.png";
import { minutesToHoursString, sumProjectHours } from "../lib/timesheetEngine";
import { statusTone } from "../lib/ui";
import { useAppState } from "../state/AppStateContext";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function PayrollExportPage() {
  const { status, exportBatches, createExportBatch, periodDisplayLabel, dayEntries, computed } = useAppState();
  const [message, setMessage] = useState("");

  const canExport = status === "PAYROLL_VALIDATED" || status === "LOCKED";
  const latestBatch = exportBatches[0] ?? null;

  const openPdfPrintView = () => {
    if (!latestBatch) {
      setMessage("Create an export batch first, then generate the PDF.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");

    if (!printWindow) {
      setMessage("Popup blocked. Allow popups for this app to generate the PDF view.");
      return;
    }

    const printableEntries = dayEntries.filter((entry) => sumProjectHours(entry) > 0 || entry.absenceCode.trim().length > 0);
    const rowsHtml = printableEntries
      .map((entry) => {
        const projects =
          entry.projectLines
            .filter((line) => line.hours > 0 || line.projectDescription.trim().length > 0)
            .map((line) => `${line.projectDescription || "(No description)"} (${line.hours.toFixed(2)}h)`)
            .join(", ") || "--";

        return `
          <tr>
            <td>${escapeHtml(entry.date)}</td>
            <td>${escapeHtml(projects)}</td>
            <td>${sumProjectHours(entry).toFixed(2)}</td>
            <td>${escapeHtml(entry.absenceCode || "--")}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(BRANDING.product)} Payroll Export ${escapeHtml(periodDisplayLabel)}</title>
          <style>
            :root { color-scheme: light; }
            body {
              margin: 0;
              padding: 32px 34px;
              color: #1b2f47;
              font-family: "Avenir Next", "Segoe UI", sans-serif;
              background: #fff;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
              border-bottom: 2px solid #d2dcea;
              padding-bottom: 14px;
              margin-bottom: 18px;
            }
            .report-header img {
              width: 300px;
              height: auto;
            }
            .report-title h1 {
              margin: 0;
              font-size: 1.4rem;
              line-height: 1.2;
            }
            .report-title p {
              margin: 6px 0 0;
              color: #425b7a;
              font-size: 0.95rem;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(150px, 1fr));
              gap: 10px;
              margin-bottom: 18px;
            }
            .meta-card {
              border: 1px solid #d1dbe8;
              border-radius: 10px;
              padding: 10px;
              background: #f5f8fc;
            }
            .meta-card p {
              margin: 0;
              font-size: 0.78rem;
              color: #4e6888;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .meta-card strong {
              margin-top: 6px;
              display: block;
              font-size: 1rem;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th, td {
              border: 1px solid #cfd9e7;
              text-align: left;
              vertical-align: top;
              padding: 8px 10px;
              font-size: 0.83rem;
            }
            th {
              background: #e8eef7;
              color: #2c4463;
            }
            .footer {
              border-top: 1px solid #d6deea;
              padding-top: 10px;
              font-size: 0.82rem;
              color: #5b6f88;
              display: flex;
              justify-content: space-between;
            }
            @media print {
              body { padding: 10mm 8mm; }
            }
          </style>
        </head>
        <body>
          <header class="report-header">
            <img src="${escapeHtml(workbookLogoLockup)}" alt="${escapeHtml(BRANDING.product)} logo" />
            <div class="report-title">
              <h1>Payroll Export Summary</h1>
              <p>${escapeHtml(periodDisplayLabel)} | Batch ${escapeHtml(latestBatch.batchId)}</p>
              <p>Generated at ${escapeHtml(new Date().toLocaleString())}</p>
            </div>
          </header>

          <section class="meta-grid">
            <article class="meta-card">
              <p>Status</p>
              <strong>${escapeHtml(status.replaceAll("_", " "))}</strong>
            </article>
            <article class="meta-card">
              <p>Batch Lines</p>
              <strong>${latestBatch.lineCount}</strong>
            </article>
            <article class="meta-card">
              <p>Total Paid Hours</p>
              <strong>${escapeHtml(minutesToHoursString(computed.periodTotals.paidMinutes))}</strong>
            </article>
            <article class="meta-card">
              <p>Checksum</p>
              <strong>${escapeHtml(latestBatch.checksum)}</strong>
            </article>
          </section>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Projects</th>
                <th>Total Hours</th>
                <th>Absence</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4">No exportable lines in this period.</td></tr>'}
            </tbody>
          </table>

          <footer class="footer">
            <span>${escapeHtml(BRANDING.footer)}</span>
            <span>Use browser Print > Save as PDF</span>
          </footer>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);

    setMessage("Opened branded print view. Choose Save as PDF in the print dialog.");
  };

  return (
    <Panel
      title="Payroll Export"
      subtitle={`Create deterministic export batches for ${periodDisplayLabel} and print a branded PDF`}
      actions={<StatusChip label={status.replaceAll("_", " ")} tone={statusTone(status)} />}
    >
      {message ? <p className="alert">{message}</p> : null}

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canExport}
          onClick={() => {
            const result = createExportBatch();
            setMessage(result.message);
          }}
        >
          Create Export Batch
        </button>
        <button type="button" className="btn" disabled={!canExport} onClick={openPdfPrintView}>
          Export Branded PDF
        </button>
      </div>

      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Created At</th>
              <th>Lines</th>
              <th>Checksum</th>
            </tr>
          </thead>
          <tbody>
            {exportBatches.length === 0 ? (
              <tr>
                <td colSpan={4}>No batches generated yet.</td>
              </tr>
            ) : (
              exportBatches.map((batch) => (
                <tr key={batch.batchId}>
                  <td>{batch.batchId}</td>
                  <td>{new Date(batch.createdAt).toLocaleString()}</td>
                  <td>{batch.lineCount}</td>
                  <td>{batch.checksum}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
