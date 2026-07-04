export const PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "cash", label: "Cash" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" },
    { value: "online", label: "Online Payment" },
    { value: "pos", label: "POS" },
    { value: "pay_order", label: "Pay Order" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
    PAYMENT_METHODS.map(m => [m.value, m.label])
);

export function formatPaymentMethod(value: string): string {
    if (!value) return value;
    return PAYMENT_METHOD_LABELS[value] ?? value;
}
