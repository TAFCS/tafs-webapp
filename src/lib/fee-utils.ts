
export const MONTH_TO_NUM: Record<string, number> = {
    August: 8, September: 9, October: 10, November: 11, December: 12,
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7,
};

export const MONTHS = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July"
];

export const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 is January, 7 is August
    const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    return `${startYear}-${startYear + 1}`;
};

export const getAcademicYearForDate = (dateStr: string) => {
    try {
        const parts = dateStr.split('-');
        if (parts.length >= 2) {
            const yr = parseInt(parts[0], 10);
            const mon = parseInt(parts[1], 10) - 1; // 0-indexed month
            const startYear = mon >= 7 ? yr : yr - 1;
            return `${startYear}-${startYear + 1}`;
        }
    } catch {}
    return getCurrentAcademicYear();
};

export const getAcademicYears = (back = 1, forward = 2) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const centerYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    
    const years = [];
    for (let i = -back; i <= forward; i++) {
        const start = centerYear + i;
        years.push(`${start}-${start + 1}`);
    }
    return years;
};

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

export const getConsolidatedMonthsLabel = (items: { month: number; academicYear: string }[]) => {
    if (!items || items.length === 0) return "";

    const getSeq = (m: number, ay: string) => {
        const startYear = parseInt(ay.split('-')[0]) || 0;
        return startYear * 12 + (m >= 8 ? m - 8 : m + 4);
    };

    // Extract unique month/year pairs and sort by sequence
    const uniqueMonths = Array.from(new Set(items.map(f => JSON.stringify({ m: f.month, ay: f.academicYear }))))
        .map(s => JSON.parse(s))
        .sort((a, b) => getSeq(a.m, a.ay) - getSeq(b.m, b.ay));

    const ranges: { m: number; ay: string }[][] = [];
    let currentRange: { m: number; ay: string }[] = [];

    uniqueMonths.forEach((item, idx) => {
        if (idx === 0) {
            currentRange.push(item);
        } else {
            const prevSeq = getSeq(uniqueMonths[idx - 1].m, uniqueMonths[idx - 1].ay);
            const currSeq = getSeq(item.m, item.ay);
            if (currSeq === prevSeq + 1) {
                currentRange.push(item);
            } else {
                ranges.push(currentRange);
                currentRange = [item];
            }
        }
    });
    ranges.push(currentRange);

    return ranges.map(range => {
        const first = range[0];
        const last = range[range.length - 1];
        const firstLabel = getMonthYearLabel(first.m, first.ay).toUpperCase();
        if (range.length === 1) return firstLabel;
        const lastLabel = getMonthYearLabel(last.m, last.ay).toUpperCase();
        return `${firstLabel} - ${lastLabel}`;
    }).join(", ");
};

export function groupFees(
    items: any[],
    appliedDiscounts: Record<number, AdHocDiscount[]> = {},
    options: { 
        groupTuitionFees: boolean; 
        isVoucherHeads?: boolean;
        ignoreBundles?: boolean;
        feeGroups?: { id: string; name: string; feeIds: number[] }[];
    } = { groupTuitionFees: true, isVoucherHeads: false, ignoreBundles: false }
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
        const amountPaid = Number(item.amount_paid || 0);
        return currentAmount - adHocDiscount - amountPaid;
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
            let groupMonths: { month: number, academicYear: string }[] = [];

            group.feeIds.forEach(feeId => {
                const item = items.find(f => f.id === feeId);
                if (item) {
                    const data = getFeeData(item);
                    groupGross += getGrossAmount(item);
                    groupNet += getNetAmount(item);
                    groupDiscount += getDiscount(item);

                    const m = data.target_month || data.month;
                    if (m) groupMonths.push({ month: m, academicYear: data.academic_year || "" });

                    if (data.discount_label) groupLabels.push(data.discount_label);
                    if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                        groupLabels.push("Profile Disc");
                    }
                    alreadyHandledIds.add(item.id);
                }
            });

            const monthSuffix = groupMonths.length > 0 ? ` (${getConsolidatedMonthsLabel(groupMonths)})` : "";

            results.push({
                description: `${group.name}${monthSuffix}`,
                amount: groupGross,
                netAmount: groupNet,
                discount: groupDiscount,
                discountLabel: [...new Set(groupLabels.filter(Boolean))].join(", "),
                priority: Math.min(...group.feeIds.map(id => items.find(f => f.id === id)?.fee_types?.priority_order ?? 999)),
                feeIds: group.feeIds,
                isGrouped: true,
            });
        });
    }

    // 0.1 Handle Database Bundles
    if (!options.ignoreBundles) {
        const bundleGroups = new Map<number, any[]>();
        items.forEach(item => {
            if (item.bundle_id && !alreadyHandledIds.has(item.id)) {
                const list = bundleGroups.get(item.bundle_id) || [];
                list.push(item);
                bundleGroups.set(item.bundle_id, list);
            }
        });

        bundleGroups.forEach((group, bundleId) => {
            let groupGross = 0;
            let groupNet = 0;
            let groupDiscount = 0;
            let groupLabels: string[] = [];
            let groupMonths: { month: number, academicYear: string }[] = [];
            const bundleName = group[0].student_fee_bundles?.bundle_name || `Bundle ${bundleId}`;

            group.forEach(item => {
                const data = getFeeData(item);
                groupGross += getGrossAmount(item);
                groupNet += getNetAmount(item);
                groupDiscount += getDiscount(item);

                const m = data.target_month || data.month;
                if (m) groupMonths.push({ month: m, academicYear: data.academic_year || "" });

                if (data.discount_label) groupLabels.push(data.discount_label);
                if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                    groupLabels.push("Profile Disc");
                }
                alreadyHandledIds.add(item.id);
            });

            const monthSuffix = groupMonths.length > 0 ? ` (${getConsolidatedMonthsLabel(groupMonths)})` : "";

            results.push({
                description: `${bundleName}${monthSuffix}`,
                amount: groupGross,
                netAmount: groupNet,
                discount: groupDiscount,
                discountLabel: [...new Set(groupLabels.filter(Boolean))].join(", "),
                priority: Math.min(...group.map(f => getFeeData(f).fee_types?.priority_order ?? 999)),
                feeIds: group.map(f => f.id),
                isGrouped: true,
                bundleId: bundleId
            });
        });
    }

    // 1. Group Tuition Fees if enabled
    const showTuitionGroup = options.groupTuitionFees && !options.isVoucherHeads;
    if (showTuitionGroup) {

        const tuitionFees = items.filter(f => {
            if (alreadyHandledIds.has(f.id)) return false;
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
                // Helper to get raw month and year for sequencing
                const getSequenceValue = (item: any) => {
                    const data = getFeeData(item);
                    const m = data.target_month || data.month || 0;
                    const academicYear = data.academic_year || "";
                    const startYear = parseInt(academicYear.split('-')[0]) || 0;
                    const relativeMonth = m >= 8 ? m - 8 : m + 4; // Aug=0, Sep=1... Jul=11
                    return startYear * 12 + relativeMonth;
                };

                group.sort((a, b) => getSequenceValue(a) - getSequenceValue(b));

                // Identify consecutive ranges
                const ranges: any[][] = [];
                let currentRange: any[] = [];
                
                group.forEach((item, index) => {
                    if (index === 0) {
                        currentRange.push(item);
                    } else {
                        const prevVal = getSequenceValue(group[index - 1]);
                        const currVal = getSequenceValue(item);
                        
                        if (currVal === prevVal + 1) {
                            currentRange.push(item);
                        } else {
                            ranges.push(currentRange);
                            currentRange = [item];
                        }
                    }
                });
                ranges.push(currentRange);

                // Process each range as a separate result row
                ranges.forEach(range => {
                    let rangeGross = 0;
                    let rangeNet = 0;
                    let rangeDiscount = 0;
                    let rangeLabels: string[] = [];
                    let rangeOrigAmount = 0;
                    let rangeMonths: { month: number, academicYear: string }[] = [];

                    range.forEach(f => {
                        const data = getFeeData(f);
                        const net = getNetAmount(f);
                        if (net <= 0) return; // skip fully paid

                        rangeGross += getGrossAmount(f);
                        rangeNet += net;
                        rangeDiscount += getDiscount(f);
                        rangeOrigAmount += Number(f.amount || f.amount_before_discount || 0);

                        const m = data.target_month || data.month;
                        if (m) rangeMonths.push({ month: m, academicYear: data.academic_year || "" });

                        if (data.discount_label) rangeLabels.push(data.discount_label);
                        if (!options.isVoucherHeads && Number(f.amount_before_discount) > Number(f.amount || f.amount_before_discount)) {
                            rangeLabels.push("Profile Disc");
                        }
                        alreadyHandledIds.add(f.id);
                    });

                    if (rangeNet <= 0) return;

                    const rangeMonthStr = getConsolidatedMonthsLabel(rangeMonths);
                    const isPartial = rangeNet < rangeOrigAmount;
                    const balancePrefix = isPartial ? 'BALANCE PAYMENT OF — ' : '';

                    results.push({
                        description: `${balancePrefix}${(getFeeData(range[0]).fee_types?.description || "").toUpperCase()} (${rangeMonthStr})`,
                        amount: isPartial ? rangeNet : rangeGross,
                        netAmount: rangeNet,
                        discount: isPartial ? 0 : rangeDiscount,
                        discountLabel: isPartial ? "" : [...new Set(rangeLabels.filter(Boolean))].join(", "),
                        priority: Math.min(...range.map(f => getFeeData(f).fee_types?.priority_order ?? 999)),
                        feeIds: range.map(f => f.id),
                        isGrouped: true,
                    });
                });
            });

        }
    }

    // 2. Individual fees
    items.forEach(item => {
        if (!alreadyHandledIds.has(item.id)) {
            const netAmount = getNetAmount(item);
            if (netAmount <= netAmount * 0.001 && netAmount > 0) { /* edge case */ }
            if (netAmount <= 0) return; // skip fully paid

            const data = getFeeData(item);
            const headLabels: string[] = [];
            if (data.discount_label) headLabels.push(data.discount_label);
            if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                headLabels.push("Profile Disc");
            }

            let desc = data.fee_types?.description?.toUpperCase() || 'UNKNOWN FEE';
            const m = data.target_month || data.month;
            if (m) {
                const monthLabel = getMonthYearLabel(m, data.academic_year || "");
                desc = `${desc} (${monthLabel.toUpperCase()})`;
            }

            const isPartial = netAmount < Number(item.amount || item.amount_before_discount);
            const balancePrefix = isPartial ? 'BALANCE PAYMENT OF — ' : '';

            results.push({
                description: `${balancePrefix}${desc}`,
                amount: isPartial ? netAmount : getGrossAmount(item),
                netAmount: netAmount,
                discount: isPartial ? 0 : getDiscount(item),
                discountLabel: isPartial ? "" : [...new Set(headLabels.filter(Boolean))].join(", "),
                priority: data.fee_types?.priority_order ?? 999,
                feeIds: [item.id],
                isGrouped: false,
            });
        }
    });

    // 3. Final Sort by Priority
    results.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return results;
}


