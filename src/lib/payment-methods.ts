export const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "cash", label: "CASH" },
    { value: "bank_transfer", label: "BANK TRANSFER" },
    { value: "cheque", label: "CHEQUE" },
    { value: "online", label: "IBFT" },
    { value: "pos", label: "POS" },
    { value: "pay_order", label: "PAY ORDER" },
    { value: "meezan", label: "MEEZAN BANK" },
];

// Methods that only ever originate from an automated collection channel — not
// selectable when a user records a deposit by hand.
export const AUTOMATED_PAYMENT_METHODS = ["meezan"];

// Manual deposit forms should offer everything except the automated-only channels.
export const MANUAL_PAYMENT_METHODS = PAYMENT_METHODS.filter(
    m => !AUTOMATED_PAYMENT_METHODS.includes(m.value)
);

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
    PAYMENT_METHODS.map(m => [m.value, m.label])
);

export function formatPaymentMethod(value: string): string {
    if (!value) return value;
    return PAYMENT_METHOD_LABELS[value] ?? value;
}
