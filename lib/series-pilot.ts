const DECISION_PILOT_IDS = new Set(['95480', '42009', '84773']);

export function isDecisionPilot(seriesId: string): boolean {
  return DECISION_PILOT_IDS.has(seriesId);
}