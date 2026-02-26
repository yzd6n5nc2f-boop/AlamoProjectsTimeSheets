export interface CalculationVector {
    id: string;
    input: string;
    expected: string;
}
export declare const EVALUATION_ORDER: readonly ["resolve_context", "normalize_input", "validate_structural", "validate_calendar", "calculate_minutes", "validate_post_calc", "apply_approval_requirements", "aggregate_week", "aggregate_period"];
export declare const TEST_VECTORS: CalculationVector[];
