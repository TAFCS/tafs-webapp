export const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "cash", label: "CASH" },
    { value: "bank_transfer", label: "BANK TRANSFER" },
    { value: "cheque", label: "CHEQUE" },
    { value: "online", label: "ONLINE PAYMENT" },
    { value: "pos", label: "POS" },
    { value: "pay_order", label: "PAY ORDER" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
    PAYMENT_METHODS.map(m => [m.value, m.label])
);

export function formatPaymentMethod(value: string): string {
    if (!value) return value;
    return PAYMENT_METHOD_LABELS[value] ?? value;
}
