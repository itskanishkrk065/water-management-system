export const INSTALLMENT_PERCENTAGES = [
  { stage: 1, percentage: 2.5, milestone: 'Initial Administrative Fee', daysAfter: 15 },
  { stage: 2, percentage: 20.0, milestone: 'Pipeline Excavation & Laying', daysAfter: 45 },
  { stage: 3, percentage: 25.0, milestone: 'Main Storage Delivery', daysAfter: 90 },
  { stage: 4, percentage: 25.0, milestone: 'Distribution Valves Installation', daysAfter: 135 },
  { stage: 5, percentage: 27.5, milestone: 'Final Commissioning & Water Release', daysAfter: 180 },
] as const;

/**
 * Calculates the total water quota based on land area and tariff rate
 */
export function calculateWaterQuota(litresPerAcre: number, landAcres: number): number {
  const quota = litresPerAcre * landAcres;
  return Math.round(quota * 100) / 100;
}

/**
 * Calculates development bill amount from approved litres and unit cost
 */
export function calculateDevelopmentBill(
  approvedLitres: number,
  developmentCostPerLitre: number
): number {
  const bill = approvedLitres * developmentCostPerLitre;
  return Math.round(bill * 100) / 100;
}

/**
 * Calculates the exact 5-stage installment breakdown for a total bill amount
 */
export function calculateInstallments(totalBillAmount: number) {
  return INSTALLMENT_PERCENTAGES.map((inst) => {
    const amount = Math.round(((totalBillAmount * inst.percentage) / 100) * 100) / 100;
    return {
      stage: inst.stage,
      percentage: inst.percentage,
      milestone: inst.milestone,
      amountDue: amount,
    };
  });
}

/**
 * Validates whether parcel areas sum up to the declared holding area.
 * Returns decimal-safe difference and validity status.
 */
export function reconcileHoldingArea(
  declaredArea: number,
  parcelAreas: number[]
): {
  isMatch: boolean;
  parcelTotal: number;
  difference: number;
  statusText: string;
} {
  const parcelTotal = parcelAreas.reduce((sum, a) => sum + (Number(a) || 0), 0);
  const roundedParcelTotal = Math.round(parcelTotal * 1000) / 1000;
  const roundedDeclared = Math.round((Number(declaredArea) || 0) * 1000) / 1000;
  const difference = Math.round((roundedDeclared - roundedParcelTotal) * 1000) / 1000;

  const isMatch = Math.abs(difference) < 0.001;

  let statusText = '✓ Area verified';
  if (difference > 0.001) {
    statusText = `Remaining: ${difference.toFixed(2)} acres`;
  } else if (difference < -0.001) {
    statusText = `Exceeds by: ${Math.abs(difference).toFixed(2)} acres`;
  }

  return {
    isMatch,
    parcelTotal: roundedParcelTotal,
    difference,
    statusText,
  };
}

/**
 * Checks for duplicate parcel composite key in-memory
 */
export function checkParcelDuplicateInMemory(
  parcels: Array<{ survey_number: string; subdivision_number: string }>,
  newSurvey: string,
  newSubdiv: string,
  excludeIndex: number = -1
): boolean {
  const targetSurvey = newSurvey.trim().toUpperCase();
  const targetSubdiv = newSubdiv.trim().toUpperCase();

  return parcels.some((p, idx) => {
    if (idx === excludeIndex) return false;
    return (
      p.survey_number.trim().toUpperCase() === targetSurvey &&
      p.subdivision_number.trim().toUpperCase() === targetSubdiv
    );
  });
}
