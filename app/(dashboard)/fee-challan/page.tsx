"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Search,
    Loader2,
    Calendar,
    Building2,
    CreditCard,
    FileText,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Printer,
    Download,
    UserCircle,
    UserSearch,
    ChevronDown,
    Settings2 as SettingsIcon,
    X,
    ChevronLeft,
    ChevronRight,
    GripVertical,
    FileSearch,
    Info,
    Lock as LockIcon,
    Link as LinkIcon,
    Layers,
} from "lucide-react";
import Link from "next/link";

import { useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import dynamic from "next/dynamic";
const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
    { ssr: false }
);
import { pdf } from "@react-pdf/renderer";
import { FeeChallanPDF } from "@/components/fees/FeeChallanPDF";
import { bankAccountsService, BankAccount } from "@/lib/bank-accounts.service";
import { groupFees, MONTHS, MONTH_TO_NUM, getMonthYearLabel, getCurrentAcademicYear } from "@/lib/fee-utils";
// --- Types ---
interface StudentProfile {
    cc: number;
    student_full_name: string;
    gr_number: string;
    campus: string;
    class_id: number;
    grade_and_section: string;
    campus_id?: number;
    section_id?: number;
    gender?: string;
    father_name?: string;
    classes?: { description: string };
    sections?: { description: string };
}

interface VoucherHead {
    id: number;
    discount_amount: number | string | null;
    net_amount: number | string;
}

interface StudentFee {
    id: number;
    fee_type_id: number;
    amount_before_discount: number;
    amount: number;
    month: number;
    target_month?: number;
    academic_year: string;
    due_date: string;
    status: boolean;
    fee_types?: {
        id: number;
        description: string;
        freq: string;
    };
    voucher_heads?: VoucherHead[];
    bundle_id?: number | null;
    student_fee_bundles?: {
        id: number;
        bundle_name: string;
    } | null;
}

export default function FeeChallanGenerator() {
    const dispatch = useDispatch<AppDispatch>();

    // --- Form States ---
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    const classes = useSelector((state: RootState) => state.classes.items);
    const sections = useSelector((state: RootState) => state.sections.items);
    const user = useSelector((state: RootState) => state.auth.user);

    const [student, setStudent] = useState<StudentProfile | null>(null);

    const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear);
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [baseYear, setBaseYear] = useState(new Date().getFullYear() - 2);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const [month, setMonth] = useState(MONTHS[new Date().getMonth() === 0 ? 5 : (new Date().getMonth() >= 8 ? new Date().getMonth() - 8 : new Date().getMonth() + 4)]);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");

    // --- Bank States ---
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [isBanksLoading, setIsBanksLoading] = useState(true);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const bankDropdownRef = useRef<HTMLDivElement>(null);

    // Editable Bank Fields
    const [accTitle, setAccTitle] = useState("");
    const [accNo, setAccNo] = useState("");
    const [branchCode, setBranchCode] = useState("");
    const [bankAddress, setBankAddress] = useState("");
    const [iban, setIban] = useState("");

    const [applyLateFee, setApplyLateFee] = useState(true);
    const [lateFeeAmount, setLateFeeAmount] = useState(1000);
    const [showBundles, setShowBundles] = useState(true);

    // --- Date Range Selection ---
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // --- Fees States ---
    const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    const [voucherSaved, setVoucherSaved] = useState(false);
    const [isSavingVoucher, setIsSavingVoucher] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [siblings, setSiblings] = useState<any[]>([]);

    // Grouped fees by fee_date (from backend)
    const [feeGroupsByDate, setFeeGroupsByDate] = useState<{ fee_date: string; fees: StudentFee[] }[]>([]);
    const [generatingGroupDate, setGeneratingGroupDate] = useState<string | null>(null);
    const [generatedGroupDates, setGeneratedGroupDates] = useState<Set<string>>(new Set());
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    // --- Saved Voucher IDs (set after successful creation, used for correct PDF numbering) ---
    const [savedVoucherId, setSavedVoucherId] = useState<number | null>(null);
    const [savedGroupVoucherIds, setSavedGroupVoucherIds] = useState<Record<string, number>>({});
    const [savedVoucherPdfUrl, setSavedVoucherPdfUrl] = useState<string | null>(null);
    const [savedGroupVoucherPdfUrls, setSavedGroupVoucherPdfUrls] = useState<Record<string, string>>({});

    // --- Arrears State ---
    const [arrearsData, setArrearsData] = useState<{
        total_arrears: number;
        arrear_fee_ids: number[];
        rows: { student_fee_id: number; fee_type: string; fee_date: string; amount: string; amount_paid: string; outstanding: string }[];
    } | null>(null);
    const [isFetchingArrears, setIsFetchingArrears] = useState(false);
    // Track which fee_date we last fetched arrears for (group view)
    const [arrearsFetchedForDate, setArrearsFetchedForDate] = useState<string | null>(null);

    // --- Bulk Voucher States ---
    const [bulkCampusId, setBulkCampusId] = useState<string>("");
    const [bulkClassId, setBulkClassId] = useState<string>("");
    const [bulkSectionId, setBulkSectionId] = useState<string>("");
    const [bulkPreview, setBulkPreview] = useState<any>(null);
    const [bulkResult, setBulkResult] = useState<any>(null);
    const [isBulkPreviewing, setIsBulkPreviewing] = useState(false);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // --- Voucher Display Options ---
    const [showDiscount, setShowDiscount] = useState(true);
    const [voucherLayout, setVoucherLayout] = useState<'detailed' | 'consolidated'>('detailed');
    const [showBundleHeads, setShowBundleHeads] = useState(false);

    useEffect(() => {
        setVoucherSaved(false);
        setArrearsData(null);
        setArrearsFetchedForDate(null);
    }, [
        issueDate,
        dueDate,
        validityDate,
        dateFrom,
        dateTo,
        applyLateFee,
        lateFeeAmount,
        selectedBank,
        accTitle,
        accNo,
        branchCode,
        bankAddress,
        iban,
        academicYear,
        month,
        studentFees
    ]);

    useEffect(() => {
        setIsClient(true);
        fetchBanks();
        dispatch(fetchClasses());
        dispatch(fetchSections());

        const handleClickOutside = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setShowYearDropdown(false);
            }
            if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
                setShowBankDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Search effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await api.get(`/v1/students/search-simple?q=${searchQuery}`);
                setSearchResults(data?.data || []);
                setShowSearchDropdown(true);
            } catch (err) {
                console.error("Search failed:", err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setVoucherSaved(false);
        setStudentFees([]);

        if (student && month && academicYear) {
            fetchStudentFees(student.cc, month, academicYear);
        }
    }, [student, month, academicYear]);

    useEffect(() => {
        setBulkPreview(null);
        setBulkResult(null);
    }, [bulkCampusId, bulkClassId, bulkSectionId, month, academicYear, issueDate, dueDate, validityDate, selectedBank, applyLateFee, lateFeeAmount, dateFrom, dateTo]);

    const fetchStudentFees = async (cc: number, selectedMonth: string, selectedYear: string) => {
        setIsFetchingFees(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            const queryStr = params.toString() ? `?${params.toString()}` : '';

            const { data } = await api.get(`/v1/student-fees/by-student/${cc}${queryStr}`);
            const responseData = data?.data;
            const familyStudents = responseData?.family?.students || [];

            const groups: { fee_date: string; fees: StudentFee[] }[] = responseData?.groups || [];
            setFeeGroupsByDate(groups);

            const allFees: StudentFee[] = responseData?.fees || [];

            if (!dateFrom && !dateTo) {
                const monthNum = MONTH_TO_NUM[selectedMonth];
                const applicableFees = allFees.filter(f =>
                    (f.month === monthNum || f.target_month === monthNum) &&
                    (f.academic_year === selectedYear)
                );
                setStudentFees(applicableFees);
                // Sync academicYear from actual fee data so the PDF always reflects the DB value
                const feeAcademicYear = applicableFees.find(f => f.academic_year)?.academic_year;
                if (feeAcademicYear) setAcademicYear(feeAcademicYear);
            } else {
                setStudentFees(allFees);
                // Sync academicYear from actual fee data so the PDF always reflects the DB value
                const feeAcademicYear = allFees.find(f => f.academic_year)?.academic_year;
                if (feeAcademicYear) setAcademicYear(feeAcademicYear);
            }

            setSiblings(familyStudents.filter((s: any) => s.cc !== cc));
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch applicable fees.");
        } finally {
            setIsFetchingFees(false);
        }
    };

    const handleApplyDateFilter = () => {
        if (!student || !month || !academicYear) {
            toast.error("Select a student, month, and academic year first.");
            return;
        }
        if (dateFrom && dateTo && dateFrom > dateTo) {
            toast.error("Start date cannot be after end date.");
            return;
        }
        setArrearsData(null);
        setArrearsFetchedForDate(null);
        fetchStudentFees(student.cc, month, academicYear);
    };

    const fetchBanks = async () => {
        setIsBanksLoading(true);
        try {
            const data = await bankAccountsService.getAll();
            setBanks(data);
            if (data.length > 0) {
                selectBank(data[0]);
            }
        } catch (err) {
            toast.error("Failed to load bank accounts");
        } finally {
            setIsBanksLoading(false);
        }
    };

    const selectBank = (bank: BankAccount) => {
        setSelectedBank(bank);
        setAccTitle(bank.account_title);
        setAccNo(bank.account_number);
        setBranchCode(bank.branch_code || "");
        setBankAddress(bank.bank_address || "");
        setIban(bank.iban || "");
    };

    const handleSelectStudent = async (studentBrief: { cc: number; full_name: string; gr_number: string }) => {
        setIsSearching(true);
        try {
            const { data } = await api.get(`/v1/students/${studentBrief.cc}`);
            const foundStudent = data?.data;
            if (foundStudent) {
                setStudent(foundStudent);
                setSearchQuery("");
                setShowSearchDropdown(false);
                setCurrentStep(2);
                toast.success(`Student ${foundStudent.student_full_name} found!`);
            }
        } catch (e) {
            toast.error("Failed to load student details.");
        } finally {
            setIsSearching(false);
        }
    };

    // --- Default Dates ---
    useEffect(() => {
        const d = new Date();
        const next10 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10);
        const next15 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 15);
        if (!dueDate) setDueDate(next10.toISOString().split('T')[0]);
        if (!validityDate) setValidityDate(next15.toISOString().split('T')[0]);
    }, [dueDate, validityDate]);

    // Auto-fetch arrears when entering Review Step
    useEffect(() => {
        if (currentStep === 3 && student && (studentFees.length > 0 || feeGroupsByDate.length > 0) && !arrearsFetchedForDate && !isFetchingArrears) {
            const earliestFeeDate = feeGroupsByDate.length > 0 
                ? feeGroupsByDate[0].fee_date 
                : (dateFrom || issueDate);
            if (earliestFeeDate) fetchArrears(student.cc, earliestFeeDate);
        }
    }, [currentStep, student, studentFees, feeGroupsByDate, dateFrom, issueDate, arrearsFetchedForDate, isFetchingArrears]);

    const processFeesForPdf = (rawFees: any[]) => {
        let baseFees = [];

        if (voucherLayout === 'detailed') {
            // Build per-row entries, keeping tuition metadata for later merge
            const detailedRows = rawFees.map(f => {
                const baseDesc = f.description || f.fee_types?.description || f.student_fee_bundles?.bundle_name || "Fee";
                const isTuition = baseDesc.toLowerCase().includes('tuition');
                const m = f.target_month || f.month;
                return {
                    _baseDesc: baseDesc,
                    _isTuition: isTuition,
                    _monthNum: (isTuition && m) ? m as number : null,
                    _mergeKey: isTuition ? `${f.fee_type_id ?? 0}|${baseDesc}|${f.bundle_id ?? f.student_fee_bundles?.id ?? 'none'}` : null,
                    description: baseDesc,
                    amount: Number(f.amount_before_discount || f.amount || 0),
                    netAmount: Number(f.amount || f.amount_before_discount || 0),
                    discount: Math.max(0, Number(f.amount_before_discount || 0) - Number(f.amount || 0)),
                    discountLabel: undefined as undefined,
                    bundleId: f.bundle_id || f.student_fee_bundles?.id,
                    priority: f.fee_types?.priority_order ?? 999
                };
            });

            // Merge tuition rows that share the same fee type / base description
            const tuitionMergeMap: Record<string, { row: typeof detailedRows[0]; months: number[] }> = {};
            const nonTuitionRows: typeof detailedRows = [];

            detailedRows.forEach(row => {
                if (row._isTuition && row._mergeKey && row._monthNum !== null) {
                    if (!tuitionMergeMap[row._mergeKey]) {
                        tuitionMergeMap[row._mergeKey] = { row: { ...row }, months: [row._monthNum] };
                    } else {
                        tuitionMergeMap[row._mergeKey].row.amount += row.amount;
                        tuitionMergeMap[row._mergeKey].row.netAmount += row.netAmount;
                        tuitionMergeMap[row._mergeKey].row.discount += row.discount;
                        tuitionMergeMap[row._mergeKey].months.push(row._monthNum);
                    }
                } else {
                    nonTuitionRows.push(row);
                }
            });

            const mergedTuitionRows = Object.values(tuitionMergeMap).map(({ row, months }) => {
                const sortedMonths = [...new Set(months)].sort((a, b) => a - b);
                let desc: string;
                if (sortedMonths.length === 1) {
                    desc = `${row._baseDesc} (${getMonthYearLabel(sortedMonths[0], academicYear).toUpperCase()})`;
                } else {
                    const startLabel = getMonthYearLabel(sortedMonths[0], academicYear).toUpperCase();
                    const endLabel = getMonthYearLabel(sortedMonths[sortedMonths.length - 1], academicYear).toUpperCase();
                    desc = `${row._baseDesc} (${startLabel} - ${endLabel})`;
                }
                const { _baseDesc, _isTuition, _monthNum, _mergeKey, ...rest } = row;
                return { ...rest, description: desc };
            });

            baseFees = [...nonTuitionRows, ...mergedTuitionRows].map(({ _baseDesc, _isTuition, _monthNum, _mergeKey, ...rest }: any) => rest);
        } else {
            const grouped = rawFees.reduce((acc: Record<number, any>, f) => {
                const headId = f.fee_type_id || 0;
                if (!acc[headId]) {
                    acc[headId] = {
                        description: f.fee_types?.description || "Fee",
                        amount: 0,
                        netAmount: 0,
                        months: [] as number[],
                        bundleId: f.bundle_id || f.student_fee_bundles?.id,
                        priority: f.fee_types?.priority_order ?? 999
                    };
                }
                acc[headId].amount += Number(f.amount_before_discount || f.amount || 0);
                acc[headId].netAmount += Number(f.amount || f.amount_before_discount || 0);
                const m = f.target_month || f.month;
                if (m) acc[headId].months.push(m);
                return acc;
            }, {});

            baseFees = Object.values(grouped).map((g: any) => {
                const isTuition = (g.description as string).toLowerCase().includes('tuition');
                let monthStr = "";
                if (isTuition && g.months.length > 0) {
                    const sorted = [...new Set(g.months)].sort((a, b) => Number(a) - Number(b)) as number[];
                    const startMonth = MONTHS[sorted[0] - 1] || "N/A";
                    const endMonth = MONTHS[sorted[sorted.length - 1] - 1] || "N/A";
                    const yrShort = academicYear.split('-')[0].slice(-2);
                    monthStr = sorted.length > 1 ? ` (${startMonth.slice(0, 3)} ${yrShort} - ${endMonth.slice(0, 3)} ${yrShort})` : ` (${startMonth.slice(0, 3)} ${yrShort})`;
                }
                return {
                    description: `${g.description}${monthStr}`,
                    amount: g.amount,
                    netAmount: g.netAmount,
                    discount: Math.max(0, g.amount - g.netAmount),
                    bundleId: g.bundleId,
                    priority: g.priority
                };
            });
        }

        // Apply Bundle Grouping if showBundleHeads is false
        if (!showBundleHeads) {
            const bundledMap: Record<string, any> = {};
            const finalFees: any[] = [];

            baseFees.forEach(f => {
                if (f.bundleId) {
                    // Find original fee row to get bundle name if not already in description
                    const rawFee = rawFees.find(rf => (rf.bundle_id || rf.student_fee_bundles?.id) === f.bundleId);
                    const bName = rawFee?.student_fee_bundles?.bundle_name || f.description;
                    
                    if (!bundledMap[f.bundleId]) {
                        bundledMap[f.bundleId] = {
                            description: bName,
                            amount: 0,
                            netAmount: 0,
                            discount: 0,
                            priority: f.priority ?? 999
                        };
                        finalFees.push(bundledMap[f.bundleId]);
                    }
                    bundledMap[f.bundleId].amount += f.amount;
                    bundledMap[f.bundleId].netAmount += f.netAmount;
                    bundledMap[f.bundleId].discount += f.discount;
                    bundledMap[f.bundleId].priority = Math.min(bundledMap[f.bundleId].priority, f.priority ?? 999);
                } else {
                    finalFees.push(f);
                }
            });
            return finalFees.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
        }

        return baseFees.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    };

    const processedArrearPdfFees = useMemo(() => {
        return (arrearsData?.rows ?? []).map((r: any) => ({
            description: `${r.fee_type} (ARREAR – ${r.fee_date})`,
            amount: Number(r.amount),
            netAmount: Number(r.outstanding),
            discount: Number(r.amount_paid),
            discountLabel: r.amount_paid !== "0.00" ? `Paid: ${r.amount_paid}` : undefined,
            isArrear: true,
            feeDate: r.fee_date,
        }));
    }, [arrearsData]);

    const processedPdfFees = useMemo(() => {
        return processFeesForPdf(studentFees).map(f => ({ ...f, isArrear: false }));
    }, [studentFees, voucherLayout, academicYear, showBundleHeads]);

    // Combined fees for PDF = arrears first, then current
    const allPdfFeesForDisplay = useMemo(() => [
        ...processedArrearPdfFees,
        ...processedPdfFees,
    ], [processedArrearPdfFees, processedPdfFees]);

    const totalFeesAmount = useMemo(() => allPdfFeesForDisplay.reduce((sum, f) => sum + (f.netAmount || 0), 0), [allPdfFeesForDisplay]);
    const totalArrearsAmount = arrearsData?.total_arrears ?? 0;

    const voucherNumberStr = savedVoucherId ? `${savedVoucherId}` : "PENDING";
    const timestampStr = new Date().toLocaleString();

    // Fetch arrears for a given fee_date (called when a group card loads or before single-voucher generation)
    const fetchArrears = async (studentCc: number, feeDate: string) => {
        setIsFetchingArrears(true);
        try {
            const { data } = await api.get('/v1/vouchers/arrears', {
                params: { student_id: studentCc, fee_date: feeDate, _t: Date.now() },
            });
            const result = data.data ?? null;
            setArrearsData(result);
            setArrearsFetchedForDate(feeDate);
            return result;
        } catch (err) {
            console.error('Failed to fetch arrears:', err);
            return null;
        } finally {
            setIsFetchingArrears(false);
        }
    };

    /** Derive "FOR MONTH(S) OF" label from the actual months present in the fee rows. */
    const getMonthLabelFromFees = (fees: any[]): string => {
        const monthNums = [...new Set(
            fees.map(f => f.target_month || f.month).filter(Boolean) as number[]
        )].sort((a, b) => a - b);
        if (monthNums.length === 0) return month; // fallback to UI picker
        return monthNums.map(m => {
            const label = getMonthYearLabel(m, academicYear);
            return label;
        }).join(" / ");
    };

    const handleSaveVoucher = async () => {
        if (!student || !selectedBank) return toast.error("Select student and bank.");
        setIsSavingVoucher(true);
        
        // FORCE fresh arrears catch to ensure PDF has latest data
        const fd = dateFrom || issueDate;
        const freshArrears = await fetchArrears(student.cc, fd);
        console.log(`[VOUCHER_DEBUG] Manual Fresh Arrears for ${fd}:`, freshArrears);

        try {
            // Determine fee_date for this voucher (use dateFrom if set, else today)
            const voucherFeeDate = fd;

            // Merge arrear IDs first so they appear first in the orderedFeeIds list
            const arrearIds = freshArrears?.arrear_fee_ids ?? [];
            const currentFeeIds = studentFees.map(f => f.id);
            const allFeeIds = [...arrearIds, ...currentFeeIds];

            console.log("Generating Single Voucher - Ordered Fee IDs (arrears+current):", allFeeIds);

            // 1. Create the voucher in DB first (without PDF) to get the real ID
            const formData = new FormData();
            formData.append('student_id', student.cc.toString());
            formData.append('campus_id', (student.campus_id || 1).toString());
            formData.append('class_id', student.class_id.toString());
            if (student.section_id) formData.append('section_id', student.section_id.toString());
            formData.append('bank_account_id', selectedBank.id.toString());
            formData.append('issue_date', issueDate);
            formData.append('due_date', dueDate);
            if (voucherFeeDate) formData.append('fee_date', voucherFeeDate);
            formData.append('academic_year', academicYear);
            formData.append('month', (MONTH_TO_NUM[month] || 1).toString());
            formData.append('late_fee_charge', applyLateFee.toString());
            formData.append('late_fee_amount', (lateFeeAmount || 0).toString());
            formData.append('precedence', '1');
            allFeeIds.forEach(id => formData.append('orderedFeeIds', id.toString()));

            // Build fee_lines: arrear lines use their outstanding balance, current use their discount calc
            const arrearLines = (freshArrears?.rows ?? []).map((r: any) => ({
                student_fee_id: r.student_fee_id,
                discount_amount: 0,
                discount_label: undefined,
            }));
            const currentLines = studentFees.map(f => ({
                student_fee_id: Number(f.id),
                discount_amount: Math.max(0, Number(f.amount_before_discount || 0) - Number(f.amount || 0)),
                discount_label: f.voucher_heads?.[0]?.discount_amount ? "Applied Discount" : undefined
            }));
            formData.append('fee_lines', JSON.stringify([...arrearLines, ...currentLines]));

            const { data: createRes } = await api.post('/v1/vouchers', formData);
            const voucherId: number = createRes.data.id;
            setSavedVoucherId(voucherId);
            setVoucherSaved(true);

            // Build arrear PDF items (isArrear: true)
            const arrearPdfFees = (freshArrears?.rows ?? []).map((r: any) => ({
                description: `${r.fee_type} (ARREAR – ${r.fee_date})`,
                amount: Number(r.outstanding),
                netAmount: Number(r.outstanding),
                discount: 0,
                isArrear: true,
                feeDate: r.fee_date,
            }));
            const currentPdfFees = processedPdfFees.map(f => ({ ...f, isArrear: false }));
            const allPdfFees = [...arrearPdfFees, ...currentPdfFees];
            const allPdfTotal = allPdfFees.reduce((s, f) => s + (f.netAmount || 0), 0);
            console.log(`[VOUCHER_DEBUG] Manual PDF: arrears=${arrearPdfFees.length}, current=${currentPdfFees.length}, total=${allPdfTotal}`);

            // 2. Generate PDF with the real voucher ID
            const blob = await pdf(
                <FeeChallanPDF
                    student={{
                        cc: student.cc,
                        student_full_name: student.student_full_name,
                        gr_number: student.gr_number,
                        campus: student.campus,
                        class_id: student.class_id,
                        section_id: student.section_id,
                        className: (classes.find(c => c.id === student.class_id) as any)?.description || "N/A",
                        sectionName: (sections.find(s => s.id === student.section_id) as any)?.description || "N/A",
                        grade_and_section: student.grade_and_section,
                        father_name: student.father_name,
                        gender: student.gender
                    }}
                    details={{
                        month: getMonthLabelFromFees(studentFees), academicYear, issueDate, dueDate, validityDate, applyLateFee, lateFeeAmount,
                        voucherNumber: voucherId,
                        generatedBy: { fullName: user?.fullName || user?.username || "N/A", timestampStr },
                        bank: { name: selectedBank.bank_name, title: accTitle, account: accNo, branch: branchCode, address: bankAddress, iban }
                    }}
                    fees={allPdfFees}
                    totalAmount={allPdfTotal}
                    showDiscount={showDiscount}
                    arrearsHistory={(freshArrears?.rows ?? []).map((r: any) => ({
                        date: r.fee_date,
                        head: r.fee_type,
                        amount: Number(r.outstanding).toLocaleString(),
                        totalAmount: (freshArrears?.total_arrears ?? 0).toLocaleString(),
                    }))}
                    siblings={siblings.map(s => ({
                        full_name: s.student_full_name || s.full_name,
                        cc: s.cc,
                        gr_number: s.gr_number,
                        className: s.classes?.description || s.grade_and_section?.split('-')[0] || "N/A",
                        sectionName: s.sections?.description || s.grade_and_section?.split('-')[1] || "N/A"
                    }))}
                    qrUrl={undefined}
                />
            ).toBlob();

            // 3. Upload the PDF with the correct voucher number
            const pdfFormData = new FormData();
            pdfFormData.append('pdf', new File([blob], `v-${student.cc}.pdf`, { type: 'application/pdf' }));
            const uploadRes = await api.patch(`/v1/vouchers/${voucherId}/paid-pdf`, pdfFormData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSavedVoucherPdfUrl(uploadRes.data?.data?.pdf_url || null);

            toast.success("Voucher generated!");
            setVoucherSaved(true);
        } catch (e: any) {
            const errorData = e.response?.data;
            console.error("Voucher Error Status:", e.response?.status);
            console.error("Voucher Error Body Full:", JSON.stringify(errorData, null, 2));
            
            const msg = errorData?.message || e.message;
            const finalMsg = Array.isArray(msg) ? msg.join(", ") : msg;
            toast.error(`Error: ${finalMsg}`, { duration: 6000 });
        } finally {
            setIsSavingVoucher(false);
        }
    };

    const handleSaveVoucherForGroup = async (group: { fee_date: string; fees: StudentFee[] }) => {
        if (!student || !selectedBank) return;
        setGeneratingGroupDate(group.fee_date);
        
        // FORCE fresh arrears fetch before generation for this group
        const freshArrears = await fetchArrears(student.cc, group.fee_date);
        console.log(`[VoucherGroup] Fresh Arrears for ${group.fee_date}:`, freshArrears);

        const feeDateMonth = (function() {
            try {
                const m = parseInt(group.fee_date.split('-')[1], 10);
                const sm = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                return sm[m - 1] || month;
            } catch { return month; }
        })();

        try {
            const groupPdfFees = processFeesForPdf(group.fees);
            const groupTotal = groupPdfFees.reduce((s, f) => s + f.netAmount, 0);

            // Merge arrear IDs (prepend) to current group IDs
            const arrearIds = freshArrears?.arrear_fee_ids ?? [];
            const currentGroupIds = group.fees.map(f => f.id);
            const allFeeIds = [...arrearIds, ...currentGroupIds];

            console.log("Generating Group Voucher - Ordered Fee IDs (arrears+current):", allFeeIds);

            // 1. Create the voucher in DB first to get the real ID
            const formData = new FormData();
            formData.append('student_id', student.cc.toString());
            formData.append('campus_id', (student.campus_id || 1).toString());
            formData.append('class_id', student.class_id.toString());
            if (student.section_id) formData.append('section_id', student.section_id.toString());
            formData.append('bank_account_id', selectedBank.id.toString());
            formData.append('issue_date', issueDate);
            formData.append('due_date', dueDate);
            formData.append('fee_date', group.fee_date);
            formData.append('academic_year', academicYear);
            formData.append('month', (MONTH_TO_NUM[month] || 1).toString());
            formData.append('late_fee_charge', applyLateFee.toString());
            formData.append('late_fee_amount', (lateFeeAmount || 0).toString());
            formData.append('precedence', '1');
            allFeeIds.forEach(id => formData.append('orderedFeeIds', id.toString()));

            const arrearLines = (freshArrears?.rows ?? []).map((r: any) => ({
                student_fee_id: r.student_fee_id,
                discount_amount: 0,
                discount_label: undefined,
            }));
            const currentLines = group.fees.map(f => ({
                student_fee_id: Number(f.id),
                discount_amount: Math.max(0, Number(f.amount_before_discount || 0) - Number(f.amount || 0)),
                discount_label: f.voucher_heads?.[0]?.discount_amount ? "Applied Discount" : undefined
            }));
            formData.append('fee_lines', JSON.stringify([...arrearLines, ...currentLines]));

            const { data: createRes } = await api.post('/v1/vouchers', formData);
            const voucherId: number = createRes.data.id;
            setSavedGroupVoucherIds(prev => ({ ...prev, [group.fee_date]: voucherId }));

            // Build arrear PDF items
            const arrearPdfFees = (freshArrears?.rows ?? []).map((r: any) => ({
                description: `${r.fee_type} (ARREAR – ${r.fee_date})`,
                amount: Number(r.outstanding),
                netAmount: Number(r.outstanding),
                discount: 0,
                isArrear: true,
                feeDate: r.fee_date,
            }));
            const currentPdfFees = groupPdfFees.map(f => ({ ...f, isArrear: false }));
            const allPdfFees = [...arrearPdfFees, ...currentPdfFees];
            const allPdfTotal = allPdfFees.reduce((s, f) => s + (f.netAmount || 0), 0);
            console.log(`[VOUCHER_DEBUG] Bulk PDF: arrears=${arrearPdfFees.length}, current=${currentPdfFees.length}, total=${allPdfTotal}`);

            // 2. Generate PDF with the real voucher ID
            const blob = await pdf(
                <FeeChallanPDF
                    student={{
                        cc: student.cc,
                        student_full_name: student.student_full_name,
                        gr_number: student.gr_number,
                        campus: student.campus,
                        class_id: student.class_id,
                        section_id: student.section_id,
                        className: (classes.find(c => c.id === student.class_id) as any)?.description || "N/A",
                        sectionName: (sections.find(s => s.id === student.section_id) as any)?.description || "N/A",
                        grade_and_section: student.grade_and_section,
                        father_name: student.father_name,
                        gender: student.gender
                    }}
                    details={{
                        month: getMonthLabelFromFees(group.fees), academicYear, issueDate, dueDate, validityDate, applyLateFee, lateFeeAmount,
                        voucherNumber: voucherId,
                        generatedBy: { fullName: user?.fullName || user?.username || "N/A", timestampStr },
                        bank: { name: selectedBank.bank_name, title: accTitle, account: accNo, branch: branchCode, address: bankAddress, iban }
                    }}
                    fees={allPdfFees}
                    totalAmount={allPdfTotal}
                    showDiscount={showDiscount}
                    arrearsHistory={(freshArrears?.rows ?? []).map((r: any) => ({
                        date: r.fee_date,
                        head: r.fee_type,
                        amount: Number(r.outstanding).toLocaleString(),
                        totalAmount: (freshArrears?.total_arrears ?? 0).toLocaleString(),
                    }))}
                    siblings={siblings.map(s => ({
                        full_name: s.student_full_name || s.full_name,
                        cc: s.cc,
                        gr_number: s.gr_number,
                        className: s.classes?.description || s.grade_and_section?.split('-')[0] || "N/A",
                        sectionName: s.sections?.description || s.grade_and_section?.split('-')[1] || "N/A"
                    }))}
                    qrUrl={undefined}
                />
            ).toBlob();

            // 3. Upload the PDF with the correct voucher number
            const pdfFormData = new FormData();
            pdfFormData.append('pdf', new File([blob], `vg-${group.fee_date}.pdf`, { type: 'application/pdf' }));
            const uploadRes = await api.patch(`/v1/vouchers/${voucherId}/paid-pdf`, pdfFormData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const uploadedPdfUrl = uploadRes.data?.data?.pdf_url || null;
            if (uploadedPdfUrl) setSavedGroupVoucherPdfUrls(prev => ({ ...prev, [group.fee_date]: uploadedPdfUrl }));

            setGeneratedGroupDates(p => new Set([...p, group.fee_date]));
            toast.success(`Generated for ${group.fee_date}`);
        } catch (e: any) {
            const errorData = e.response?.data;
            console.error("Voucher Error Status:", e.response?.status);
            console.error("Voucher Error Body Full:", JSON.stringify(errorData, null, 2));
            
            const msg = errorData?.message || e.message;
            const finalMsg = Array.isArray(msg) ? msg.join(", ") : msg;
            toast.error(`Error: ${finalMsg}`, { duration: 6000 });
        } finally {
            setGeneratingGroupDate(null);
        }
    };

    const handleGenerateAllGroups = async () => {
        setIsGeneratingAll(true);
        for (const g of feeGroupsByDate) if (!generatedGroupDates.has(g.fee_date)) await handleSaveVoucherForGroup(g);
        setIsGeneratingAll(false);
    };

    const YearPicker = () => {
        const years = Array.from({ length: 12 }, (_, i) => `${baseYear + i}-${baseYear + i + 1}`);
        return (
            <div className="relative" ref={yearDropdownRef}>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Academic Year</label>
                <button
                    onClick={() => setShowYearDropdown(!showYearDropdown)}
                    className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                >
                    <span className="text-zinc-900 dark:text-zinc-100">{academicYear}</span>
                    <Calendar className="h-4 w-4 text-zinc-400" />
                </button>
                {showYearDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]">
                        <div className="p-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <button onClick={() => setBaseYear(prev => prev - 12)} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{baseYear} - {baseYear + 11}</span>
                            <button onClick={() => setBaseYear(prev => prev + 12)} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-2">
                            {years.map(y => (
                                <button key={y} onClick={() => { setAcademicYear(y); setShowYearDropdown(false); }} className={`px-3 py-2.5 text-center text-[12px] font-bold rounded-xl transition-all border ${academicYear === y ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent"}`}>
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderFeesTable = (feesList: any[], totalValue: number) => {
        const stdFees = feesList.filter(f => !f.discount || f.discount <= 0);
        const discFees = feesList.filter(f => f.discount && f.discount > 0);
        const grossTotal = feesList.reduce((s,f) => s + f.amount, 0);

        return (
            <div className="px-8 py-6 space-y-8">
                {stdFees.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Standard Fees</h4>
                        <div className="space-y-4">
                            {stdFees.map((fee: any, idx: number) => (
                                <div key={`s-${idx}`} className="flex items-center justify-between text-[14px]">
                                    <div className="flex items-center gap-3">
                                        {fee.bundleId && <LinkIcon className="h-3 w-3 text-emerald-500" />}
                                        <p className="font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">{fee.description || "Fee item"}</p>
                                    </div>
                                    <div className="flex items-center gap-12">
                                        <span className="text-zinc-400 font-bold font-mono">{(fee.amount).toLocaleString()}</span>
                                        <span className="text-zinc-900 dark:text-zinc-100 font-black font-mono w-24 text-right">{(fee.amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {discFees.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Discounted Fees</h4>
                        <div className="space-y-4">
                            {discFees.map((fee: any, idx: number) => (
                                <div key={`d-${idx}`} className="flex items-center justify-between text-[14px]">
                                    <div className="flex items-center gap-3">
                                        {fee.bundleId && <LinkIcon className="h-3 w-3 text-emerald-500" />}
                                        <p className="font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-tight">{fee.description || "Fee item"}</p>
                                    </div>
                                    <div className="flex items-center gap-12">
                                        <span className="text-zinc-400 font-bold font-mono line-through">{(fee.amount).toLocaleString()}</span>
                                        <span className="text-emerald-600 font-black font-mono w-24 text-right">{(fee.netAmount).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {discFees.length > 0 && (
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[12px]">
                        <span className="font-black text-zinc-500 uppercase tracking-widest">Gross Details Total</span>
                        <span className="text-zinc-400 font-bold font-mono line-through">PKR {grossTotal.toLocaleString()}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-32 mt-6 px-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <CreditCard className="h-7 w-7" />
                        </div>
                        Fee Challan Generator
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        Issue and manage student fee vouchers with custom validity.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/bulk-voucher"
                        className="h-12 px-6 bg-primary text-white rounded-2xl flex items-center gap-3 font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Layers className="h-5 w-5" />
                        Bulk Voucher Generation
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column (Cards) */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Step 1 Card */}
                    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-8 space-y-10 shadow-xl shadow-zinc-100/50 dark:shadow-none transition-all ${currentStep === 1 ? "opacity-100 ring-4 ring-primary/5" : "opacity-40 grayscale pointer-events-none"}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="h-14 w-14 bg-primary/10 rounded-3xl flex items-center justify-center text-primary rotate-3 transition-transform hover:rotate-0 shadow-sm border border-primary/5">
                                    <UserSearch className="h-7 w-7" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">1. Select Student</h2>
                                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Search student profile</p>
                                </div>
                            </div>
                            {student && currentStep > 1 && <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 animate-in zoom-in"><CheckCircle2 className="h-5 w-5" /></div>}
                        </div>

                        <div className="space-y-6">
                            <div className="relative" ref={searchDropdownRef}>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Student Database</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Enter Name, CC ID, or GR Number..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full h-14 pl-14 pr-14 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                                    />
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                                    {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />}
                                </div>
                                {showSearchDropdown && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[28px] shadow-2xl z-[100] max-h-[400px] overflow-hidden overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
                                        {searchResults.map(res => (
                                            <button key={res.cc} onClick={() => handleSelectStudent(res)} className="w-full px-6 py-5 flex items-center gap-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left transition-all border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 group">
                                                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                                    <UserCircle className="h-7 w-7" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">{res.full_name}</p>
                                                        <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-zinc-500">GR: {res.gr_number}</span>
                                                    </div>
                                                    <p className="text-[11px] text-primary font-bold mt-0.5">COMPUTER CODE: {res.cc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {student && (
                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-[32px] relative overflow-hidden group hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-none transition-all duration-500">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                                        <UserSearch className="h-16 w-16 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className="h-16 w-16 rounded-[22px] bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700">
                                            <UserCircle className="h-10 w-10" />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100 leading-tight">{student.student_full_name}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-3 py-1 rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {student.campus}</span>
                                                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tight">CC: {student.cc}</span>
                                                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-tight">GR: {student.gr_number}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Invoicing Card */}
                    {student && (
                        <div className="bg-emerald-50/30 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/30 rounded-[32px] p-8 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="flex items-center gap-5">
                                <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                                    <CreditCard className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-emerald-700 dark:text-emerald-400 font-black text-sm uppercase tracking-wider">Active Invoicing</h3>
                                    <p className="text-emerald-600/60 dark:text-emerald-500/50 text-[11px] font-bold italic mt-0.5">Standard fee structure will be applied.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column (Parameters) */}
                <div className="lg:col-span-7 space-y-8">
                    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] shadow-2xl transition-all ${currentStep === 2 ? "opacity-100 scale-100" : "opacity-40 pointer-events-none scale-[0.98]"}`}>
                        <div className="p-10 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
                            <div className="flex items-center gap-5">
                                <div className="h-14 w-14 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shadow-sm border border-primary/5">
                                    <SettingsIcon className="h-7 w-7" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">2. Define Parameters</h2>
                                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Configure voucher constraints and banking</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 space-y-12">
                            {/* Fee Date Range Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Fee Date Range</h3>
                                </div>
                                <div className="flex flex-wrap items-end gap-6">
                                    <div className="flex-1 min-w-[200px] space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block">Start Date</label>
                                        <div className="relative">
                                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-12 px-5 pl-14 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-black focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
                                            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-[200px] space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block">End Date</label>
                                        <div className="relative">
                                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-12 px-5 pl-14 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-black focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
                                            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <button onClick={handleApplyDateFilter} className="h-12 px-8 bg-primary hover:bg-primary-hover text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50">Apply Date Filter</button>
                                </div>
                            </div>

                            {/* Collection Bank Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Collection Bank</h3>
                                </div>
                                <div className="relative" ref={bankDropdownRef}>
                                    <button
                                        onClick={() => setShowBankDropdown(!showBankDropdown)}
                                        className="w-full min-h-[64px] p-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-center justify-between hover:border-primary/50 transition-all group"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="h-10 w-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">{selectedBank ? `${selectedBank.bank_name}` : "Select Bank Account"}</p>
                                                {selectedBank && <p className="text-[11px] font-bold text-zinc-400">Account: {selectedBank.account_number}</p>}
                                            </div>
                                        </div>
                                        <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${showBankDropdown ? "rotate-180" : ""}`} />
                                    </button>
                                    {showBankDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                                            <div className="max-h-[300px] overflow-y-auto p-3">
                                                {banks.map(b => (
                                                    <button key={b.id} onClick={() => { selectBank(b); setShowBankDropdown(false); }} className={`w-full p-5 rounded-2xl flex items-center justify-between transition-all ${selectedBank?.id === b.id ? "bg-primary/5 border-2 border-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border-2 border-transparent"}`}>
                                                        <div className="text-left">
                                                            <p className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">{b.bank_name}</p>
                                                            <p className="text-[11px] font-bold text-zinc-400">{b.account_title} - {b.account_number}</p>
                                                        </div>
                                                        {selectedBank?.id === b.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Voucher Timeline Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Voucher Timeline</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { label: 'Date of Issue', val: issueDate, setter: setIssueDate, color: 'primary' },
                                        { label: 'Due Date', val: dueDate, setter: setDueDate, color: 'primary' },
                                        { label: 'Valid Till', val: validityDate, setter: setValidityDate, color: 'rose' }
                                    ].map((item, i) => (
                                        <div key={item.label} className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{item.label}</label>
                                            <input
                                                type="date"
                                                value={item.val}
                                                onChange={e => item.setter(e.target.value)}
                                                className={`w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-black focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all ${item.color === 'rose' ? "text-rose-600 dark:text-rose-400" : ""}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Late Surcharge Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="h-4 w-4 text-rose-500" />
                                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Late Surcharge</h3>
                                    </div>
                                    <div className="flex items-center gap-4 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[20px] border border-zinc-200/50 dark:border-zinc-800">
                                        <button
                                            onClick={() => setApplyLateFee(true)}
                                            className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${applyLateFee ? "bg-white dark:bg-zinc-800 text-rose-600 shadow-xl shadow-rose-500/10 border border-rose-100/50 dark:border-rose-900/20" : "text-zinc-400 hover:text-zinc-600"}`}
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => setApplyLateFee(false)}
                                            className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!applyLateFee ? "bg-white dark:bg-zinc-800 text-zinc-400 shadow-xl shadow-zinc-500/5" : "text-zinc-400 hover:text-zinc-600"}`}
                                        >
                                            None
                                        </button>
                                    </div>
                                    {applyLateFee && (
                                        <div className="relative animate-in zoom-in-95 fade-in duration-300">
                                            <input
                                                type="number"
                                                value={lateFeeAmount}
                                                onChange={e => setLateFeeAmount(Number(e.target.value))}
                                                className="w-full h-12 px-12 bg-rose-50/50 dark:bg-rose-900/10 border-2 border-rose-100 dark:border-rose-900/30 rounded-2xl text-[14px] font-black text-rose-600 dark:text-rose-400 focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500/30 transition-all"
                                            />
                                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <LinkIcon className="h-4 w-4 text-emerald-500" />
                                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Fee Bundling</h3>
                                    </div>
                                    <div className="flex items-center gap-4 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[20px] border border-zinc-200/50 dark:border-zinc-800">
                                        <button
                                            onClick={() => setShowBundleHeads(false)}
                                            className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!showBundleHeads ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-xl shadow-emerald-500/10 border border-emerald-100/50" : "text-zinc-400 hover:text-zinc-600"}`}
                                        >
                                            Bundle
                                        </button>
                                        <button
                                            onClick={() => setShowBundleHeads(true)}
                                            className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${showBundleHeads ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-xl shadow-emerald-500/5" : "text-zinc-400 hover:text-zinc-600"}`}
                                        >
                                            Heads
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-bold text-zinc-400 italic px-2">
                                        {showBundleHeads ? "Listing individual heads." : "Showing bundle as single item."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-10 border-t border-zinc-100 dark:border-zinc-900 flex justify-between bg-zinc-50/30 dark:bg-zinc-900/10 rounded-b-[40px]">
                            <button onClick={() => setCurrentStep(1)} className="px-8 h-14 text-[12px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all flex items-center gap-2 group">
                                <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                                Back
                            </button>
                            <button
                                onClick={() => { if (selectedBank) setCurrentStep(3); else toast.error("Select bank"); }}
                                className="px-10 h-14 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[22px] text-[12px] font-black uppercase tracking-widest shadow-2xl shadow-zinc-900/20 dark:shadow-zinc-100/10 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-3 group"
                            >
                                Preview Fees
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                    </div>

                    {/* Step 3 (Review) Overlay/Section */}
                    {currentStep === 3 && (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] shadow-2xl overflow-hidden min-h-[600px] flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-700">
                            <div className="p-10 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
                                <div className="flex items-center gap-5">
                                    <div className="h-14 w-14 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-500/10">
                                        <FileSearch className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">3. Review & Generate</h2>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-0.5">Final Verification & Voucher Generation</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[22px] border border-zinc-200/50 dark:border-zinc-800/50">
                                        <button
                                            onClick={() => setShowDiscount(!showDiscount)}
                                            className={`px-4 h-9 rounded-[18px] text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all flex items-center gap-2 ${showDiscount ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-xl shadow-emerald-500/5 border border-emerald-100/50" : "text-zinc-400 hover:text-zinc-500"}`}
                                        >
                                            <div className={`h-1.5 w-1.5 rounded-full ${showDiscount ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                                            Show Discount
                                        </button>
                                        <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setVoucherLayout('detailed')}
                                                className={`px-4 h-9 rounded-[18px] text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all ${voucherLayout === 'detailed' ? "bg-white dark:bg-zinc-800 text-zinc-900 shadow-xl shadow-zinc-500/5 border border-zinc-100 dark:border-zinc-700" : "text-zinc-400 hover:text-zinc-500"}`}
                                            >
                                                Row by Row
                                            </button>
                                            <button
                                                onClick={() => setVoucherLayout('consolidated')}
                                                className={`px-4 h-9 rounded-[18px] text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all ${voucherLayout === 'consolidated' ? "bg-white dark:bg-zinc-800 text-zinc-900 shadow-xl shadow-zinc-500/5 border border-zinc-100 dark:border-zinc-700" : "text-zinc-400 hover:text-zinc-500"}`}
                                            >
                                                Line
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="h-12 w-12 flex items-center justify-center rounded-[20px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm transition-all active:scale-95 hover:shadow-lg hover:shadow-zinc-200/50"
                                    >
                                        <ChevronLeft className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-10 overflow-y-auto bg-zinc-50/20 dark:bg-zinc-900/5">
                                {/* Arrears Card — shared location for both view types */}
                                {!voucherSaved && (
                                    <div className="max-w-4xl mx-auto w-full">
                                        {isFetchingArrears ? (
                                            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl mb-8 animate-pulse">
                                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                                                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-[0.2em]">Detecting academic arrears...</span>
                                            </div>
                                        ) : arrearsData && arrearsData.total_arrears > 0 ? (
                                            <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/20 rounded-[32px] mb-8 space-y-6 shadow-sm animate-in zoom-in-95 duration-500">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                                            <AlertCircle className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-[0.2em] block">Arrears Detected</span>
                                                            <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest mt-0.5">Fees outstanding from previous months</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black text-amber-600/40 uppercase tracking-widest block mb-1">Total Outstanding</span>
                                                        <span className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight">PKR {arrearsData.total_arrears.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {arrearsData.rows.map((r, i) => (
                                                        <div key={i} className="flex items-center justify-between p-4 bg-white/60 dark:bg-zinc-900/40 border border-amber-100/50 dark:border-amber-900/20 rounded-2xl shadow-sm">
                                                            <div>
                                                                <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 block">{r.fee_type}</span>
                                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{r.fee_date}</span>
                                                            </div>
                                                            <span className="text-[12px] font-black text-amber-700 dark:text-amber-400">PKR {Number(r.outstanding).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-3 pt-2">
                                                    <Info className="h-4 w-4 text-amber-400" />
                                                    <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-widest leading-relaxed">
                                                        These arrears will be automatically included in the voucher generated below.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : arrearsData && arrearsData.total_arrears === 0 ? (
                                            <div className="flex items-center justify-between p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl mb-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">No Arrears — Account Clear</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-emerald-600/40 uppercase tracking-widest">Verified {new Date().toLocaleTimeString()}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {isFetchingFees ? (
                                    <div className="py-20 flex flex-col items-center gap-4">
                                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                        <p className="text-zinc-400 font-bold text-[13px] uppercase tracking-widest">Scanning academic records...</p>
                                    </div>
                                ) : (
                                    feeGroupsByDate.length > 0 ? (
                                        <div className="space-y-10 max-w-4xl mx-auto pb-10">
                                            {/* Groups Summary Banner */}
                                            <div className="bg-primary/5 border-2 border-primary/10 p-8 rounded-[32px] flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/10">
                                                        <CreditCard className="h-7 w-7" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-primary uppercase tracking-tight">{feeGroupsByDate.length} Voucher Groups Found</h3>
                                                        <p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest mt-0.5">Each fee_date becomes a separate voucher</p>
                                                    </div>
                                                </div>
                                                {voucherSaved ? (
                                                    <PDFDownloadLink
                                                        document={
                                                            <FeeChallanPDF
                                                                student={{
                                                                    ...student!,
                                                                    className: (classes.find(c => c.id === student?.class_id) as any)?.description || "N/A",
                                                                    sectionName: (sections.find(s => s.id === student?.section_id) as any)?.description || "N/A"
                                                                }}
                                                                details={{
                                                                    month: getMonthLabelFromFees(studentFees), academicYear, issueDate, dueDate, validityDate, applyLateFee, lateFeeAmount, voucherNumber: voucherNumberStr,
                                                                    generatedBy: { fullName: user?.fullName || user?.username || "N/A", timestampStr },
                                                                    bank: { name: selectedBank?.bank_name || "", title: accTitle, account: accNo, branch: branchCode, address: bankAddress, iban: iban }
                                                                }}
                                                                fees={allPdfFeesForDisplay}
                                                                totalAmount={totalFeesAmount}
                                                                showDiscount={showDiscount}
                                                                arrearsHistory={processedArrearPdfFees.map(r => ({
                                                                    date: r.feeDate,
                                                                    head: r.description.split(" (")[0],
                                                                    amount: r.amount.toLocaleString(),
                                                                    totalAmount: r.netAmount.toLocaleString()
                                                                }))}
                                                                siblings={siblings.map(s => ({
                                                                    full_name: s.student_full_name || s.full_name,
                                                                    cc: s.cc,
                                                                    gr_number: s.gr_number,
                                                                    className: (classes.find(c => c.id === s.class_id) as any)?.description || "N/A",
                                                                    sectionName: (sections.find(sec => sec.id === s.section_id) as any)?.description || "N/A"
                                                                }))}
                                                                qrUrl={savedVoucherPdfUrl || undefined}
                                                            />
                                                        }
                                                        fileName={`Vouchers_${student?.cc}.pdf`}
                                                        className="h-14 px-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-4"
                                                    >
                                                        <Download className="h-5 w-5" /> Download All
                                                    </PDFDownloadLink>
                                                ) : (
                                                    <button
                                                        onClick={handleGenerateAllGroups}
                                                        disabled={isGeneratingAll}
                                                        className="h-14 px-10 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-4 disabled:opacity-50"
                                                    >
                                                        {isGeneratingAll ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                                                        Generate All
                                                    </button>
                                                )}
                                            </div>

                                            {/* Detailed Group Cards */}
                                            <div className="space-y-8">
                                                {feeGroupsByDate.map((g, idx) => {
                                                    const isEarliestGroup = idx === 0;
                                                    const groupArrears = isEarliestGroup ? processedArrearPdfFees : [];
                                                    const groupArrearsTotal = isEarliestGroup ? totalArrearsAmount : 0;
                                                    
                                                    const currentGroupPdfFees = processFeesForPdf(g.fees).map(f => ({ ...f, isArrear: false }));
                                                    const combinedGroupFees = [...groupArrears, ...currentGroupPdfFees];
                                                    const combinedGroupTotal = combinedGroupFees.reduce((acc, f) => acc + (f.netAmount || 0), 0);

                                                    return (
                                                        <div key={g.fee_date} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-xl shadow-zinc-100/50 dark:shadow-none animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                            {/* Card Header */}
                                                            <div className="p-8 border-b border-zinc-50 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
                                                                <div className="flex items-center gap-5">
                                                                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                                                                        <Calendar className="h-6 w-6" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-lg text-zinc-900 dark:text-zinc-100">FEE DATE: {g.fee_date}</h4>
                                                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{combinedGroupFees.length} fee heads • PKR {combinedGroupTotal.toLocaleString()}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {generatedGroupDates.has(g.fee_date) && (
                                                                        <PDFDownloadLink
                                                                            document={
                                                                                <FeeChallanPDF
                                                                                    student={{ ...student!, className: (classes.find(c => c.id === student?.class_id) as any)?.description || "N/A", sectionName: (sections.find(s => s.id === student?.section_id) as any)?.description || "N/A" }}
                                                                                    details={{
                                                                                        month: getMonthLabelFromFees(g.fees),
                                                                                        academicYear, issueDate, dueDate, validityDate, applyLateFee, lateFeeAmount,
                                                                                        voucherNumber: savedGroupVoucherIds[g.fee_date] ? `${savedGroupVoucherIds[g.fee_date]}` : voucherNumberStr,
                                                                                        generatedBy: { fullName: user?.fullName || user?.username || "N/A", timestampStr },
                                                                                        bank: { name: selectedBank?.bank_name || "", title: accTitle, account: accNo, branch: branchCode, address: bankAddress, iban: iban }
                                                                                    }}
                                                                                    fees={combinedGroupFees}
                                                                                    totalAmount={combinedGroupTotal}
                                                                                    showDiscount={showDiscount}
                                                                                    arrearsHistory={processedArrearPdfFees.map(r => ({
                                                                                        date: r.feeDate,
                                                                                        head: r.description.split(' (')[0],
                                                                                        amount: r.amount.toLocaleString(),
                                                                                        totalAmount: r.netAmount.toLocaleString()
                                                                                    }))}
                                                                                    siblings={siblings.map(s => ({
                                                                                        full_name: s.student_full_name || s.full_name,
                                                                                        cc: s.cc,
                                                                                        gr_number: s.gr_number,
                                                                                        className: (classes.find(c => c.id === s.class_id) as any)?.description || "N/A",
                                                                                        sectionName: (sections.find(sec => sec.id === s.section_id) as any)?.description || "N/A"
                                                                                    }))}
                                                                                    qrUrl={savedGroupVoucherPdfUrls[g.fee_date] || undefined}
                                                                                />
                                                                            }
                                                                            fileName={`Challan_${student?.cc}_${g.fee_date}.pdf`}
                                                                            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-95 transition-all"
                                                                        >
                                                                            <Download className="h-5 w-5" />
                                                                        </PDFDownloadLink>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleSaveVoucherForGroup(g)}
                                                                        disabled={generatingGroupDate === g.fee_date}
                                                                        className={`h-12 px-10 rounded-2xl text-[11px] uppercase font-black tracking-widest transition-all flex items-center gap-3 ${generatedGroupDates.has(g.fee_date) ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:-translate-y-0.5 active:scale-95"}`}
                                                                    >
                                                                        {generatingGroupDate === g.fee_date ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                                                        {generatedGroupDates.has(g.fee_date) ? "Regenerate" : "Generate"}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Detailed Line Items Grouped */}
                                                            {renderFeesTable(combinedGroupFees, combinedGroupTotal)}

                                                            {/* Card Footer */}
                                                            <div className="px-8 py-5 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-50 dark:border-zinc-900 flex items-center justify-between">
                                                                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Total</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">PKR</span>
                                                                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{combinedGroupTotal.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : studentFees.length > 0 ? (
                                        <div className="space-y-10 max-w-4xl mx-auto">
                                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-xl">
                                                <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/30">
                                                    <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Fee Review Listing</h3>
                                                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Manual generation for current selection</p>
                                                </div>
                                                {renderFeesTable(allPdfFeesForDisplay, totalFeesAmount)}
                                                <div className="px-8 py-8 bg-zinc-900 text-white flex items-center justify-between">
                                                    <span className="text-[12px] font-black uppercase tracking-[0.2em]">Total Payable</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-black text-zinc-400">PKR</span>
                                                        <span className="text-3xl font-black tracking-tighter">{totalFeesAmount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-6 pb-10">
                                                {voucherSaved ? (
                                                    <PDFDownloadLink
                                                        document={
                                                            <FeeChallanPDF
                                                                student={{
                                                                    cc: student!.cc,
                                                                    student_full_name: student!.student_full_name,
                                                                    gr_number: student!.gr_number,
                                                                    campus: student!.campus,
                                                                    class_id: student!.class_id,
                                                                    section_id: student!.section_id,
                                                                    className: (classes.find(c => c.id === student?.class_id) as any)?.description || "N/A",
                                                                    sectionName: (sections.find(s => s.id === student?.section_id) as any)?.description || "N/A",
                                                                    grade_and_section: student!.grade_and_section,
                                                                    father_name: student!.father_name,
                                                                    gender: student!.gender
                                                                }}
                                                                details={{
                                                                    month: getMonthLabelFromFees(studentFees),
                                                                    academicYear,
                                                                    issueDate,
                                                                    dueDate,
                                                                    validityDate,
                                                                    applyLateFee,
                                                                    lateFeeAmount,
                                                                    voucherNumber: voucherNumberStr,
                                                                    generatedBy: { fullName: user?.fullName || user?.username || "N/A", timestampStr },
                                                                    bank: { name: selectedBank?.bank_name || "", title: accTitle, account: accNo, branch: branchCode, address: bankAddress, iban: iban }
                                                                }}
                                                                fees={allPdfFeesForDisplay}
                                                                totalAmount={totalFeesAmount}
                                                                showDiscount={showDiscount}
                                                                arrearsHistory={processedArrearPdfFees.map(r => ({
                                                                    date: r.feeDate,
                                                                    head: r.description.split(" (")[0],
                                                                    amount: r.amount.toLocaleString(),
                                                                    totalAmount: r.netAmount.toLocaleString()
                                                                }))}
                                                                siblings={siblings.map(s => ({
                                                                    full_name: s.student_full_name || s.full_name,
                                                                    cc: s.cc,
                                                                    gr_number: s.gr_number,
                                                                    className: (classes.find(c => c.id === s.class_id) as any)?.description || "N/A",
                                                                    sectionName: (sections.find(sec => sec.id === s.section_id) as any)?.description || "N/A"
                                                                }))}
                                                                qrUrl={savedVoucherPdfUrl || undefined}
                                                            />
                                                        }
                                                        fileName={`Challan_${student?.cc}.pdf`}
                                                        className="h-16 px-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-4 shadow-2xl shadow-emerald-600/20 transition-all hover:-translate-y-1 active:scale-95"
                                                    >
                                                        <Download className="h-5 w-5" /> Download PDF
                                                    </PDFDownloadLink>
                                                ) : (
                                                    <button onClick={handleSaveVoucher} disabled={isSavingVoucher} className="h-16 px-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-4 shadow-2xl shadow-zinc-900/20 dark:shadow-zinc-100/20 transition-all hover:-translate-y-1 active:scale-95">
                                                        {isSavingVoucher ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} Generate Voucher
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-32 flex flex-col items-center gap-6 opacity-30">
                                            <AlertCircle className="h-20 w-20" />
                                            <p className="text-[16px] font-black uppercase tracking-[0.2em]">No fees identified in range</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
