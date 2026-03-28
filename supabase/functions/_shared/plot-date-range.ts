const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRangeInput {
  dateFrom?: string;
  dateTo?: string;
}

export interface PlotDateContext {
  sowingDate?: string | null;
}

export interface ResolvedDateRange {
  dateFrom: string;
  dateTo: string;
  source: {
    usedPlotSowingDate: boolean;
    usedTodayDate: boolean;
  };
}

export type DateRangeResolution =
  | {
    ok: true;
    value: ResolvedDateRange;
  }
  | {
    ok: false;
    status: number;
    message: string;
  };

export function resolvePlotDateRange(
  input: DateRangeInput,
  plot: PlotDateContext,
  todayDate: string = getTodayDateString(),
): DateRangeResolution {
  const requestedDateFrom = normalizeOptionalString(input.dateFrom);
  const requestedDateTo = normalizeOptionalString(input.dateTo);

  if (requestedDateFrom != null && !isValidDateString(requestedDateFrom)) {
    return {
      ok: false,
      status: 400,
      message: "dateFrom must use YYYY-MM-DD format.",
    };
  }

  if (requestedDateTo != null && !isValidDateString(requestedDateTo)) {
    return {
      ok: false,
      status: 400,
      message: "dateTo must use YYYY-MM-DD format.",
    };
  }

  const plotSowingDate = normalizeOptionalString(plot.sowingDate);
  const resolvedDateFrom = requestedDateFrom ?? plotSowingDate;
  const resolvedDateTo = requestedDateTo ?? todayDate;

  if (!resolvedDateFrom) {
    return {
      ok: false,
      status: 422,
      message:
        "Plot does not have a valid sowing_date and dateFrom was not provided.",
    };
  }

  if (resolvedDateFrom > resolvedDateTo) {
    return {
      ok: false,
      status: requestedDateFrom != null || requestedDateTo != null ? 400 : 422,
      message: requestedDateFrom != null || requestedDateTo != null
        ? "dateFrom must be less than or equal to dateTo."
        : "Plot sowing_date must be less than or equal to the resolved dateTo.",
    };
  }

  return {
    ok: true,
    value: {
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      source: {
        usedPlotSowingDate: requestedDateFrom == null && plotSowingDate != null,
        usedTodayDate: requestedDateTo == null,
      },
    },
  };
}

export function getTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
