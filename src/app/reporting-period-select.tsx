"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

export type ReportingPeriod =
  | "this_week"
  | "last_week"
  | "this_month"
  | "year_to_date"
  | "all_time";

type ReportingPeriodSelectProps = {
  value: ReportingPeriod;
};

export function ReportingPeriodSelect({
  value,
}: ReportingPeriodSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams =
    useSearchParams();

  return (
    <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-400 sm:w-52">
      Reporting period

      <select
        value={value}
        onChange={(event) => {
          const params =
            new URLSearchParams(
              searchParams.toString(),
            );

          params.set(
            "period",
            event.target.value,
          );

          router.push(
            `${pathname}?${params.toString()}`,
          );
        }}
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-sky-400"
      >
        <option value="this_week">
          This week
        </option>

        <option value="last_week">
          Last week
        </option>

        <option value="this_month">
          This month
        </option>

        <option value="year_to_date">
          Year to date
        </option>

        <option value="all_time">
          All time
        </option>
      </select>
    </label>
  );
}
