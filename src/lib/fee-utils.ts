
export const MONTH_TO_NUM: Record<string, number> = {
    August: 8, September: 9, October: 10, November: 11, December: 12,
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7,
};

export const MONTHS = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July"
];

export const getMonthYearLabel = (m: number, academicYear: string) => {
    const monthName = MONTHS.find((_, i) => MONTH_TO_NUM[MONTHS[i]] === m) || "";
    if (!academicYear) return monthName.slice(0, 3);
    
    const parts = academicYear.split('-').map(y => y.trim());
    const startYear = parts[0];
    const endYear = parts[1] || parts[0];
    
    const year = m >= 8 ? startYear : endYear;
    const yearShort = year.slice(-2);
    return `${monthName.slice(0, 3)} ${yearShort}`;
};

export interface FeeItemData {
    id?: number;
    amount_before_discount: number | string;
    amount: number | string; // amount after system discount but before ad-hoc
    month?: number | null;
    target_month?: number | null;
    academic_year?: string | null;
    fee_types?: {
        id: number;
        description: string;
        freq?: string;
    };
}

export interface AdHocDiscount {
    amount: number;
    title: string;
}

export function groupFees(
    items: any[],
    appliedDiscounts: Record<number, AdHocDiscount[]> = {},
    options: { 
        groupTuitionFees: boolean; 
        isVoucherHeads?: boolean;
        feeGroups?: { id: string; name: string; feeIds: number[] }[];
    } = { groupTuitionFees: true, isVoucherHeads: false }
) {
    const results: any[] = [];
    const alreadyHandledIds = new Set<number>();

    const getDiscount = (item: any): number => {
        if (options.isVoucherHeads) {
            return Number(item.discount_amount || 0);
        }
        const adHocDiscount = (appliedDiscounts[item.id] || []).reduce((sum, d) => sum + d.amount, 0);
        const systemDiscount = Math.max(0, Number(item.amount_before_discount) - Number(item.amount || item.amount_before_discount));
        return adHocDiscount + systemDiscount;
    };

    const getNetAmount = (item: any): number => {
        if (options.isVoucherHeads) {
            return Number(item.net_amount || 0);
        }
        const adHocDiscount = (appliedDiscounts[item.id] || []).reduce((sum, d) => sum + d.amount, 0);
        const currentAmount = Number(item.amount || item.amount_before_discount);
        return currentAmount - adHocDiscount;
    };

    const getGrossAmount = (item: any): number => {
        if (options.isVoucherHeads) {
            return Number(item.net_amount || 0) + Number(item.discount_amount || 0);
        }
        return Number(item.amount_before_discount || 0);
    };

    // Helper to get fee type and date info safely
    const getFeeData = (item: any) => {
        if (options.isVoucherHeads) {
            return {
                fee_types: item.student_fees?.fee_types,
                month: item.student_fees?.month,
                target_month: item.student_fees?.target_month,
                academic_year: item.student_fees?.academic_year,
                discount_label: item.discount_label
            };
        }
        return {
            fee_types: item.fee_types,
            month: item.month,
            target_month: item.target_month,
            academic_year: item.academic_year,
            discount_label: (appliedDiscounts[item.id] || []).map(d => d.title).join(", ")
        };
    };

    // 0. Add Explicitly Grouped Fees (from feeGroups option)
    if (options.feeGroups && options.feeGroups.length > 0) {
        options.feeGroups.forEach(group => {
            let groupGross = 0;
            let groupNet = 0;
            let groupDiscount = 0;
            let groupLabels: string[] = [];

            group.feeIds.forEach(feeId => {
                const item = items.find(f => f.id === feeId);
                if (item) {
                    const data = getFeeData(item);
                    groupGross += getGrossAmount(item);
                    groupNet += getNetAmount(item);
                    groupDiscount += getDiscount(item);

                    if (data.discount_label) groupLabels.push(data.discount_label);
                    if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                        groupLabels.push("Profile Disc");
                    }
                    alreadyHandledIds.add(item.id);
                }
            });

            results.push({
                description: group.name,
                amount: groupGross,
                netAmount: groupNet,
                discount: groupDiscount,
                discountLabel: [...new Set(groupLabels.filter(Boolean))].join(", "),
            });
        });
    }

    // 1. Group Tuition Fees if enabled
    if (options.groupTuitionFees) {

        const tuitionFees = items.filter(f => {
            const data = getFeeData(f);
            return data.fee_types?.description?.toLowerCase().includes("tuition");
        });

        if (tuitionFees.length > 0) {
            const tuitionGroups = new Map<number, any[]>();
            tuitionFees.forEach(f => {
                const data = getFeeData(f);
                const feeTypeId = data.fee_types?.id || 0;
                const list = tuitionGroups.get(feeTypeId) || [];
                list.push(f);
                tuitionGroups.set(feeTypeId, list);
            });

            tuitionGroups.forEach((group, feeTypeId) => {
                if (group.length > 1) {
                    let groupGross = 0;
                    let groupNet = 0;
                    let groupDiscount = 0;
                    let labels: string[] = [];
                    
                    group.sort((a, b) => {
                        const da = getFeeData(a);
                        const db = getFeeData(b);
                        const ma = da.target_month || da.month || 0;
                        const mb = db.target_month || db.month || 0;
                        const orderA = ma >= 8 ? ma : ma + 12;
                        const orderB = mb >= 8 ? mb : mb + 12;
                        return orderA - orderB;
                    });

                    const firstData = getFeeData(group[0]);
                    const lastData = getFeeData(group[group.length - 1]);

                    const firstLabel = getMonthYearLabel(firstData.target_month || firstData.month || 0, firstData.academic_year || "");
                    const lastLabel = getMonthYearLabel(lastData.target_month || lastData.month || 0, lastData.academic_year || "");
                    
                    group.forEach(f => {
                        const data = getFeeData(f);
                        groupGross += getGrossAmount(f);
                        groupNet += getNetAmount(f);
                        groupDiscount += getDiscount(f);
                        if (data.discount_label) labels.push(data.discount_label);
                        if (!options.isVoucherHeads && Number(f.amount_before_discount) > Number(f.amount || f.amount_before_discount)) {
                            labels.push("Profile Disc");
                        }
                        alreadyHandledIds.add(f.id);
                    });

                    results.push({
                        description: `${firstData.fee_types?.description} (${firstLabel} - ${lastLabel})`,
                        amount: groupGross,
                        netAmount: groupNet,
                        discount: groupDiscount,
                        discountLabel: [...new Set(labels.filter(Boolean))].join(", "),
                    });
                }
            });
        }
    }

    // 2. Individual fees
    items.forEach(item => {
        if (!alreadyHandledIds.has(item.id)) {
            const data = getFeeData(item);
            const headLabels: string[] = [];
            if (data.discount_label) headLabels.push(data.discount_label);
            if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                headLabels.push("Profile Disc");
            }

            let desc = data.fee_types?.description || 'Unknown Fee';
            const m = data.target_month || data.month;
            if (m) {
                const monthLabel = getMonthYearLabel(m, data.academic_year || "");
                desc = `${desc} ${monthLabel}`;
            }

            results.push({
                description: desc,
                amount: getGrossAmount(item),
                netAmount: getNetAmount(item),
                discount: getDiscount(item),
                discountLabel: [...new Set(headLabels.filter(Boolean))].join(", "),
            });
        }
    });

    return results;
}

