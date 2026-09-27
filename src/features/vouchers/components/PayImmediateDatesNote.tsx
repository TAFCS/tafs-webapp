"use client";

/**
 * PAY IMMEDIATELY notice for a voucher-settings date block (TAFSD-174).
 *
 * The backend decides whether a voucher is PAY IMMEDIATELY and, by default,
 * forces due = valid till = issue date + 4 days (Monday if that's a Sunday).
 * This shows that default and lets the issuer keep their own dates instead;
 * the caller sends `pay_immediately_custom_dates: true` when `custom` is on.
 * The watermark applies either way.
 */
export function PayImmediateDatesNote({
    defaultDate,
    custom,
    onCustomChange,
    disabled,
    subject = "this voucher",
}: {
    defaultDate: string;
    custom: boolean;
    onCustomChange: (custom: boolean) => void;
    disabled?: boolean;
    subject?: string;
}) {
    return (
        <div className="text-[11px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2 leading-snug space-y-2">
            <p>
                PAY IMMEDIATELY — this student hasn&apos;t paid their last two vouchers.{" "}
                {custom ? (
                    <>Using your own due and valid-till dates (default would be {defaultDate}).</>
                ) : (
                    <>
                        By default {subject} is due and expires on {defaultDate}: issue date + 4 days, moved
                        to Monday if that&apos;s a Sunday.
                    </>
                )}
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-rose-600"
                    checked={custom}
                    disabled={disabled}
                    onChange={(e) => onCustomChange(e.target.checked)}
                />
                Use my own due and valid-till dates
            </label>
        </div>
    );
}
