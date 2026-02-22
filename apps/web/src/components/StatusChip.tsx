interface StatusChipProps {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}

export function StatusChip({ label, tone = "neutral" }: StatusChipProps) {
  return <span className={`chip chip-${tone}`}>{label}</span>;
}
