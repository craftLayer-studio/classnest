import type { ComponentProps } from "react";
import type { DateInput } from "@astryxdesign/core/DateInput";

export type IsoDate = NonNullable<ComponentProps<typeof DateInput>["value"]>;

/** Our DateKey strings are already YYYY-MM-DD; this narrows them for DateInput. */
export const iso = (d: string) => d as IsoDate;
