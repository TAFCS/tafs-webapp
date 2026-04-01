
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
            const bundleName = group[0].student_fee_bundles?.bundle_name || `Bundle ${bundleId}`;

            group.forEach(item => {
                const data = getFeeData(item);
                groupGross += getGrossAmount(item);
                groupNet += getNetAmount(item);
                groupDiscount += getDiscount(item);

                if (data.discount_label) groupLabels.push(data.discount_label);
                if (!options.isVoucherHeads && Number(item.amount_before_discount) > Number(item.amount || item.amount_before_discount)) {
                    groupLabels.push("Profile Disc");
                }
                alreadyHandledIds.add(item.id);
            });

            results.push({
                description: bundleName,
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

                    // Build range labels
                    const rangeLabels = ranges.map(r => {
                        const first = getFeeData(r[0]);
                        const last = getFeeData(r[r.length - 1]);
                        const firstLabel = getMonthYearLabel(first.target_month || first.month || 0, first.academic_year || "");
                        
                        if (r.length === 1) return firstLabel;
                        
                        const lastLabel = getMonthYearLabel(last.target_month || last.month || 0, last.academic_year || "");
                        return `${firstLabel} - ${lastLabel}`;
                    });

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
                        description: `${(getFeeData(group[0]).fee_types?.description || "").toUpperCase()} (${rangeLabels.join(", ").toUpperCase()})`,
                        amount: groupGross,
                        netAmount: groupNet,
                        discount: groupDiscount,
                        discountLabel: [...new Set(labels.filter(Boolean))].join(", "),
                        priority: Math.min(...group.map(f => getFeeData(f).fee_types?.priority_order ?? 999)),
                        feeIds: group.map(f => f.id),
                        isGrouped: true,
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
                desc = `${desc.toUpperCase()} (${monthLabel.toUpperCase()})`;
            }

            results.push({
                description: desc,
                amount: getGrossAmount(item),
                netAmount: getNetAmount(item),
                discount: getDiscount(item),
                discountLabel: [...new Set(headLabels.filter(Boolean))].join(", "),
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

