export const ENQUIRY_STAGES = ["new", "demo_booked", "demo_attended", "fee_discussed", "admitted", "lost"] as const;
export type EnquiryStage = (typeof ENQUIRY_STAGES)[number];

export const STAGE_LABEL: Record<EnquiryStage, string> = {
  new: "New",
  demo_booked: "Demo booked",
  demo_attended: "Demo attended",
  fee_discussed: "Fee discussed",
  admitted: "Admitted",
  lost: "Lost",
};

const NEXT: Record<EnquiryStage, EnquiryStage[]> = {
  new: ["demo_booked", "fee_discussed", "admitted", "lost"],
  demo_booked: ["demo_attended", "admitted", "new", "lost"],
  demo_attended: ["fee_discussed", "admitted", "lost"],
  fee_discussed: ["admitted", "lost"],
  admitted: [],
  lost: ["new"],
};

export function canMoveEnquiry(from: EnquiryStage, to: EnquiryStage): boolean {
  return NEXT[from].includes(to);
}

export function nextStages(from: EnquiryStage): EnquiryStage[] {
  return NEXT[from];
}

export interface Funnel {
  total: number;
  demoBooked: number;
  admitted: number;
  lost: number;
  conversionPercent: number | null;
  byStage: Record<EnquiryStage, number>;
}

/** Conversion = admitted / all enquiries. Demo booked counts everything that reached a demo or beyond. */
export function funnel(stages: EnquiryStage[]): Funnel {
  const byStage = Object.fromEntries(ENQUIRY_STAGES.map((s) => [s, 0])) as Record<EnquiryStage, number>;
  for (const s of stages) byStage[s]++;
  const total = stages.length;
  const admitted = byStage.admitted;
  return {
    total,
    demoBooked: byStage.demo_booked + byStage.demo_attended + byStage.fee_discussed + admitted,
    admitted,
    lost: byStage.lost,
    conversionPercent: total === 0 ? null : Math.round((admitted * 100) / total),
    byStage,
  };
}
