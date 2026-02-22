export interface CalculationVector {
  id: string;
  input: string;
  expected: string;
}

// Deterministic evaluation order used by API and tests.
export const EVALUATION_ORDER = [
  "resolve_context",
  "normalize_input",
  "validate_structural",
  "validate_calendar",
  "calculate_minutes",
  "validate_post_calc",
  "apply_approval_requirements",
  "aggregate_week",
  "aggregate_period"
] as const;

export const TEST_VECTORS: CalculationVector[] = [
  {
    id: "TV-01",
    input: "WORKDAY 08:00-16:30 break 30",
    expected: "normal=480 ot=0 ph_worked=0 leave=0"
  },
  {
    id: "TV-02",
    input: "WORKDAY 08:00-18:00 break 30",
    expected: "normal=480 ot=90 ph_worked=0 manager_approval_required=true"
  },
  {
    id: "TV-03",
    input: "PUBLIC_HOLIDAY no work absence PH",
    expected: "leave(PH)=480 normal=0 ot=0"
  },
  {
    id: "TV-04",
    input: "absence AL plus time 09:00-17:00",
    expected: "error=CODE_TIME_CONFLICT blocking=true"
  },
  {
    id: "TV-05",
    input: "FRIDAY_SHORT_DAY worked 7.5h",
    expected: "normal=friday_normal_minutes ot=remaining"
  }
];
