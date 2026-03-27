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
    Plus,
    Trash2,
    PercentCircle,
    FileSearch,
    Info,
    Lock as LockIcon,
    Link as LinkIcon
} from "lucide-react";

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
import { groupFees, MONTHS, MONTH_TO_NUM, getMonthYearLabel } from "@/lib/fee-utils";
import JSZip from "jszip";


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

    const [academicYear, setAcademicYear] = useState("2024-2025");
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [baseYear, setBaseYear] = useState(new Date().getFullYear() - 2);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const [month, setMonth] = useState(MONTHS[new Date().getMonth() === 0 ? 5 : (new Date().getMonth() >= 8 ? new Date().getMonth() - 8 : new Date().getMonth() + 4)]);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");

    // --- Bank States ---
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [isBanksLoading, setIsBanksLoading] = useState(true);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

    // Editable Bank Fields
    const [accTitle, setAccTitle] = useState("");
    const [accNo, setAccNo] = useState("");
    const [branchCode, setBranchCode] = useState("");
    const [bankAddress, setBankAddress] = useState("");
    const [iban, setIban] = useState("");


    const [applyLateFee, setApplyLateFee] = useState(true);
    const [lateFeeAmount, setLateFeeAmount] = useState(1000);

    // --- Date Range Selection (Voucher-style) ---
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // --- Fees States ---
    const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    const [voucherSaved, setVoucherSaved] = useState(false);
    const [isSavingVoucher, setIsSavingVoucher] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [siblings, setSiblings] = useState<any[]>([]);
    const [appliedDiscounts, setAppliedDiscounts] = useState<Record<number, { amount: number; title: string; id: string }[]>>({});

    // Inline Discount States
    const [selectedFeeId, setSelectedFeeId] = useState<number | "all">("all");
    const [discountAmount, setDiscountAmount] = useState("");
    const [discountTitle, setDiscountTitle] = useState("");

    // Grouping Fees States
    const [feeGroups, setFeeGroups] = useState<{ id: string; name: string; feeIds: number[] }[]>([]);
    const [selectedForGrouping, setSelectedForGrouping] = useState<number[]>([]);
    const [groupNameInput, setGroupNameInput] = useState("");
    const [groupTuitionFees, setGroupTuitionFees] = useState(false);
    const [showDiscounts, setShowDiscounts] = useState(true);
    const [isSavingBundle, setIsSavingBundle] = useState(false);

    // --- Bulk Voucher States ---
    const [bulkCampusId, setBulkCampusId] = useState<string>("");
    const [bulkClassId, setBulkClassId] = useState<string>("");
    const [bulkSectionId, setBulkSectionId] = useState<string>("");
    const [bulkPreview, setBulkPreview] = useState<any>(null);
    const [bulkResult, setBulkResult] = useState<any>(null);
    const [isBulkPreviewing, setIsBulkPreviewing] = useState(false);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Reset saved state when any voucher information changes
    useEffect(() => {
        if (student) {
            setVoucherSaved(false);
        }
    }, [
        appliedDiscounts,
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
        studentFees,
        showDiscounts,
        dateFrom,
        dateTo
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
            const { data } = await api.get(`/v1/student-fees/by-student/${cc}`);
            const allFees: any[] = data?.data?.fees || [];
            const familyStudents = data?.data?.family?.students || [];

            const monthNum = MONTH_TO_NUM[selectedMonth];
            const applicableFees = allFees.filter(f => {
                const dueDateObj = f.due_date ? new Date(f.due_date) : null;
                const isWithinDateRange = (!dateFrom || (dueDateObj && dueDateObj >= new Date(dateFrom))) &&
                    (!dateTo || (dueDateObj && dueDateObj <= new Date(dateTo)));

                if (dateFrom || dateTo) {
                    return isWithinDateRange && (f.academic_year === selectedYear);
                }

                // Fallback to month-based filtering
                return (f.month === monthNum || f.target_month === monthNum || f.student_fee_bundles?.target_month === monthNum) &&
                    (f.academic_year === selectedYear);
            });

            setStudentFees(applicableFees);
            setSiblings(familyStudents.filter((s: any) => s.cc !== cc));
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch applicable fees.");
        } finally {
            setIsFetchingFees(false);
        }
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

    const filteredSections = useMemo(() => {
        if (!bulkClassId) return sections;
        const classScoped = sections.filter((s: any) => {
            const sectionClassId = s.class_id ?? s.classId ?? s.classes?.id ?? null;
            return Number(sectionClassId) === Number(bulkClassId);
        });
        // Current sections endpoint may return global sections without class mapping.
        // In that case, keep showing all sections instead of an empty list.
        return classScoped.length > 0 ? classScoped : sections;
    }, [sections, bulkClassId]);

    const buildBulkPreviewPayload = () => {
        if (!selectedBank) return null;
        if (!bulkCampusId) return null;

        return {
            campus_id: Number(bulkCampusId),
            class_id: bulkClassId ? Number(bulkClassId) : undefined,
            section_id: bulkSectionId ? Number(bulkSectionId) : undefined,
            academic_year: academicYear,
            month: MONTH_TO_NUM[month] || 1,
            fee_date: dateFrom || undefined,
            issue_date: issueDate,
            due_date: dueDate,
            validity_date: validityDate || undefined,
            bank_account_id: selectedBank.id,
        };
    };

    const buildBulkCreatePayload = () => {
        const base = buildBulkPreviewPayload();
        if (!base) return null;

        return {
            ...base,
            late_fee_charge: applyLateFee,
            late_fee_amount: applyLateFee ? lateFeeAmount : 0,
        };
    };

    const handlePreviewBulk = async () => {
        const payload = buildBulkPreviewPayload();
        if (!payload) {
            toast.error("Please select campus and bank account first.");
            return;
        }

        setIsBulkPreviewing(true);
        setBulkResult(null);
        try {
            const { data } = await api.post("/v1/vouchers/bulk/preview", payload);
            setBulkPreview(data?.data || null);
            const eligible = Number(data?.data?.eligible_students || 0);
            toast.success(`Preview ready. ${eligible} student(s) eligible.`);
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to preview bulk vouchers.");
        } finally {
            setIsBulkPreviewing(false);
        }
    };

    const handleGenerateBulk = async () => {
        const payload = buildBulkCreatePayload();
        if (!payload) {
            toast.error("Please select campus and bank account first.");
            return;
        }
        if (!bulkPreview) {
            toast.error("Please run preview before generating.");
            return;
        }

        setIsBulkGenerating(true);
        try {
            const { data } = await api.post("/v1/vouchers/bulk/create", payload);
            const summary = data?.data || null;
            setBulkResult(summary);
            toast.success(`Bulk generation completed. ${summary?.generated_count || 0} voucher(s) generated.`);
            await downloadBulkVoucherZip(summary?.generated_voucher_ids || []);
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to generate bulk vouchers.");
        } finally {
            setIsBulkGenerating(false);
        }
    };

    const downloadBulkVoucherZip = async (voucherIds: number[]) => {
        if (!voucherIds || voucherIds.length === 0) {
            toast.error("No vouchers available for ZIP download.");
            return;
        }

        const zip = new JSZip();
        let addedCount = 0;
        const generatedByName = (user as any)?.full_name || (user as any)?.username || "SYSTEM USER";
        const generatedAt = new Date().toLocaleString();

        for (const voucherId of voucherIds) {
            try {
                const { data } = await api.get(`/v1/vouchers/${voucherId}`);
                const voucher = data?.data;
                if (!voucher) continue;

                const groupedVoucherFees = groupFees(
                    voucher.voucher_heads || [],
                    {},
                    { groupTuitionFees: true, isVoucherHeads: true }
                );

                const feesForPdf = groupedVoucherFees.map((f: any) => ({
                    description: f.description,
                    amount: Number(f.amount || 0),
                    netAmount: Number(f.netAmount || f.amount || 0),
                    discount: Number(f.discount || 0),
                    discountLabel: f.discountLabel,
                }));

                const totalAmount = Number(voucher.total_payable_before_due || 0);
                const voucherLateFee = Math.max(
                    0,
                    Number(voucher.total_payable_after_due || 0) - Number(voucher.total_payable_before_due || 0)
                );
                const issue = voucher.issue_date ? String(voucher.issue_date).split("T")[0] : issueDate;
                const due = voucher.due_date ? String(voucher.due_date).split("T")[0] : dueDate;
                const valid = voucher.validity_date ? String(voucher.validity_date).split("T")[0] : (validityDate || "N/A");
                const monthLabel = getMonthYearLabel(Number(voucher.month || 0), voucher.academic_year || academicYear) || month;

                const blob = await pdf(
                    <FeeChallanPDF
                        student={{
                            cc: voucher.students?.cc || voucher.student_id,
                            student_full_name: voucher.students?.full_name || "N/A",
                            gr_number: voucher.students?.gr_number || "N/A",
                            campus: voucher.campuses?.campus_name || "Main Campus",
                            class_id: voucher.class_id,
                            section_id: voucher.section_id,
                            className: voucher.classes?.description || "N/A",
                            sectionName: voucher.sections?.description || "N/A",
                            grade_and_section: "",
                            gender: undefined,
                            father_name: undefined,
                        }}
                        details={{
                            month: monthLabel,
                            academicYear: voucher.academic_year || academicYear,
                            issueDate: issue,
                            dueDate: due,
                            validityDate: valid,
                            applyLateFee: Boolean(voucher.late_fee_charge),
                            lateFeeAmount: voucherLateFee,
                            voucherNumber: `VCH-${voucher.id}`,
                            generatedBy: {
                                fullName: generatedByName,
                                timestampStr: generatedAt,
                            },
                            bank: {
                                name: voucher.bank_accounts?.bank_name || selectedBank?.bank_name || "N/A",
                                title: voucher.bank_accounts?.account_title || accTitle || "N/A",
                                account: voucher.bank_accounts?.account_number || accNo || "N/A",
                                branch: voucher.bank_accounts?.branch_code || branchCode || "N/A",
                                address: voucher.bank_accounts?.bank_address || bankAddress || "N/A",
                                iban: voucher.bank_accounts?.iban || iban || "",
                            }
                        }}
                        fees={feesForPdf}
                        totalAmount={totalAmount}
                        siblings={[]}
                    />
                ).toBlob();

                const cc = voucher.students?.cc || voucher.student_id || voucher.id;
                zip.file(`Challan_${cc}_${voucher.id}.pdf`, blob);
                addedCount++;
            } catch (error) {
                console.error(`Failed to build PDF for voucher ${voucherId}`, error);
            }
        }

        if (addedCount === 0) {
            toast.error("Could not create PDFs for ZIP download.");
            return;
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = `bulk-challans-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(zipUrl);
        toast.success(`ZIP downloaded with ${addedCount} challan PDF(s).`);
    };

    // Default dates logic
    useEffect(() => {
        const d = new Date();
        const next10 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10);
        const next15 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 15);
        if (!dueDate) setDueDate(next10.toISOString().split('T')[0]);
        if (!validityDate) setValidityDate(next15.toISOString().split('T')[0]);
    }, [dueDate, validityDate]);

    const handleSelectStudent = async (studentBrief: { cc: number; full_name: string; gr_number: string }) => {
        setIsSearching(true);
        try {
            const { data } = await api.get(`/v1/students/${studentBrief.cc}`);
            const foundStudent = data?.data;

            if (foundStudent) {
                setStudent(foundStudent);
                setSearchQuery("");
                setShowSearchDropdown(false);
                setCurrentStep(2); // Automatically advance to Step 2
                toast.success(`Student ${foundStudent.student_full_name || foundStudent.full_name} found!`);
            } else {
                toast.error("Student not found.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load student details.");
        } finally {
            setIsSearching(false);
        }
    };

    // DnD Handlers
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Required for Firefox
        e.dataTransfer.setData("text/html", (e.currentTarget as HTMLElement).innerHTML);
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newFees = [...studentFees];
        const draggedItem = newFees[draggedIndex];
        newFees.splice(draggedIndex, 1);
        newFees.splice(index, 0, draggedItem);

        setDraggedIndex(index);
        setStudentFees(newFees);
        setVoucherSaved(false);
    };

    const onDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleToggleFeeSelection = (id: number) => {
        setSelectedForGrouping(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleAddGroup = () => {
        if (selectedForGrouping.length < 2) {
            toast.error("Select at least 2 fees to group.");
            return;
        }
        if (!groupNameInput.trim()) {
            toast.error("Please enter a name for the group.");
            return;
        }

        // Ensure none of the selected fees are already in another group
        const allGroupedIds = new Set(feeGroups.flatMap(g => g.feeIds));
        const hasDoubleGroup = selectedForGrouping.some(id => allGroupedIds.has(id));
        if (hasDoubleGroup) {
            toast.error("Some selected fees are already in a group.");
            return;
        }

        const newGroup = {
            id: Math.random().toString(36).substr(2, 9),
            name: groupNameInput.trim(),
            feeIds: [...selectedForGrouping]
        };
        setFeeGroups([...feeGroups, newGroup]);
        setSelectedForGrouping([]);
        setGroupNameInput("");
        toast.success(`Group "${newGroup.name}" created!`);
    };

    const handleRemoveGroup = (groupId: string) => {
        setFeeGroups(feeGroups.filter(g => g.id !== groupId));
        toast.success("Group removed.");
    };

    const handlePersistBundle = async (name: string, feeIds: number[]) => {
        if (!student) return;
        setIsSavingBundle(true);
        try {
            await api.post('/v1/student-fees/bundles', {
                student_id: student.cc,
                bundle_name: name,
                academic_year: academicYear,
                fee_ids: feeIds
            });
            toast.success(`Bundle "${name}" saved to database!`);
            // Refresh fees to get the new bundle_id
            fetchStudentFees(student.cc, month, academicYear);
        } catch (err) {
            console.error(err);
            toast.error("Failed to save bundle to database.");
        } finally {
            setIsSavingBundle(false);
        }
    };

    // --- Discount/Net Amount Helpers (must be before handleSaveVoucher) ---
    const getAppliedDiscountTotal = (feeId: number): number => {
        return (appliedDiscounts[feeId] || []).reduce((sum, d) => sum + d.amount, 0);
    };

    const getNetAmount = (fee: StudentFee): number => {
        const adHocDiscount = getAppliedDiscountTotal(fee.id);
        const voucherHead = fee.voucher_heads?.[0];

        // Use student-specific amount if set, otherwise fallback to template amount
        const currentAmount = Number(fee.amount || fee.amount_before_discount);

        return currentAmount - adHocDiscount;
    };

    const getDiscount = (fee: StudentFee): number => {
        const adHocDiscount = getAppliedDiscountTotal(fee.id);
        const systemDiscount = Math.max(0, Number(fee.amount_before_discount) - Number(fee.amount || fee.amount_before_discount));
        return adHocDiscount + systemDiscount;
    };
    const groupedFeeIds = new Set(feeGroups.flatMap(g => g.feeIds));
    const processedPdfFees = groupFees(studentFees, appliedDiscounts, { groupTuitionFees, feeGroups });



    const pdfFees = processedPdfFees;
    const hasAnyDiscount = studentFees.some(f => getDiscount(f) > 0);
    const totalFeesAmount = pdfFees.reduce((sum, f) => sum + f.netAmount, 0);
    const totalBeforeDiscount = studentFees.reduce((sum, fee) => sum + Number(fee.amount_before_discount), 0);

    const handleSaveVoucher = async () => {
        if (!student || !selectedBank) {
            toast.error("Please select a student and a bank.");
            return;
        }
        if (studentFees.length === 0) {
            toast.error("No applicable fees found to generate a voucher.");
            return;
        }

        setIsSavingVoucher(true);
        try {
            // 1. Generate PDF Blob
            const selectedClass = classes.find(c => c.id === student.class_id);
            const selectedSection = sections.find(s => s.id === student.section_id);

            const blob = await pdf(
                <FeeChallanPDF
                    student={{
                        cc: student.cc,
                        student_full_name: student.student_full_name,
                        gr_number: student.gr_number,
                        campus: student.campus,
                        class_id: student.class_id,
                        section_id: student.section_id,
                        className: (selectedClass as any)?.class_name || "N/A",
                        sectionName: (selectedSection as any)?.section_name || "N/A",
                        grade_and_section: student.grade_and_section,
                        gender: student.gender,
                        father_name: student.father_name
                    }}
                    details={{
                        month: month,
                        academicYear: academicYear,
                        issueDate: issueDate,
                        dueDate: dueDate,
                        validityDate: validityDate || "N/A",
                        applyLateFee: applyLateFee,
                        lateFeeAmount: lateFeeAmount,
                        voucherNumber: voucherNumberStr,
                        generatedBy: {
                            fullName: user?.fullName || "System Admin",
                            timestampStr: timestampStr
                        },
                        bank: {
                            name: selectedBank.bank_name,
                            title: selectedBank.account_title,
                            account: selectedBank.account_number,
                            branch: selectedBank.bank_address || "N/A", // Use address as branch if specific branch name missing
                            address: selectedBank.bank_address || "N/A",
                            iban: selectedBank.iban || ""
                        }
                    }}
                    fees={pdfFees.map(f => ({
                        description: f.description,
                        amount: showDiscounts ? f.amount : f.netAmount,
                        netAmount: f.netAmount,
                        discount: showDiscounts ? f.discount : 0,
                        discountLabel: showDiscounts ? f.discountLabel : undefined
                    }))}
                    totalAmount={totalFeesAmount}
                    siblings={siblings.map(s => ({
                        full_name: s.student_full_name,
                        cc: s.cc,
                        gr_number: s.gr_number,
                        className: s.grade_and_section?.split('-')[0] || "N/A",
                        sectionName: s.grade_and_section?.split('-')[1] || "N/A"
                    }))}
                />
            ).toBlob();

            // 3. Prepare Fee Lines with Discounts
            const feeLines = studentFees.map(f => ({
                student_fee_id: f.id,
                discount_amount: getDiscount(f),
                discount_label: (appliedDiscounts[f.id] || []).map(d => d.title).join(", "),
            }));

            // 4. Prepare Multipart Form Data
            const formData = new FormData();
            formData.append('pdf', blob, `voucher-${student.cc}-${Date.now()}.pdf`);
            formData.append('student_id', student.cc.toString());
            formData.append('campus_id', (student.campus_id || 1).toString());
            formData.append('class_id', (student.class_id || 1).toString());
            if (student.section_id) formData.append('section_id', student.section_id.toString());
            formData.append('bank_account_id', selectedBank.id.toString());
            formData.append('issue_date', issueDate);
            formData.append('due_date', dueDate);
            if (validityDate) formData.append('validity_date', validityDate);
            formData.append('late_fee_charge', applyLateFee.toString());
            if (applyLateFee) formData.append('late_fee_amount', lateFeeAmount.toString());
            formData.append('academic_year', academicYear);
            formData.append('month', (MONTH_TO_NUM[month] || 1).toString());
            if (dateFrom) formData.append('fee_date', dateFrom);
            formData.append('precedence', '1');

            // Send fee lines as a JSON string
            formData.append('fee_lines', JSON.stringify(feeLines));

            // Keep ordered IDs for legacy/processing order
            studentFees.forEach(f => {
                formData.append('orderedFeeIds', f.id.toString());
            });

            await api.post('/v1/vouchers', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            toast.success("Voucher generated and PDF uploaded successfully!");
            setVoucherSaved(true);
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.message || "Failed to save voucher.");
        } finally {
            setIsSavingVoucher(false);
        }
    };


    const YearPicker = () => {
        const years = Array.from({ length: 12 }, (_, i) => {
            const start = baseYear + i;
            return `${start}-${start + 1}`;
        });

        return (
            <div className="relative" ref={yearDropdownRef}>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Academic Year</label>
                <div className="relative mt-0">
                    <button
                        onClick={() => setShowYearDropdown(!showYearDropdown)}
                        className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all flex items-center justify-between group"
                    >
                        <span className="text-zinc-900 dark:text-zinc-100">{academicYear}</span>
                        <Calendar className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                    </button>

                    {showYearDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]">
                            {/* Header with Navigation */}
                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                                <button
                                    onClick={() => setBaseYear(prev => prev - 12)}
                                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all active:scale-90"
                                >
                                    <ChevronLeft className="h-4 w-4 text-zinc-500" />
                                </button>
                                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                    {baseYear} - {baseYear + 11}
                                </span>
                                <button
                                    onClick={() => setBaseYear(prev => prev + 12)}
                                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all active:scale-90"
                                >
                                    <ChevronRight className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            {/* Year Grid */}
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {years.map((year) => (
                                    <button
                                        key={year}
                                        onClick={() => {
                                            setAcademicYear(year);
                                            setShowYearDropdown(false);
                                        }}
                                        className={`px-3 py-2.5 text-center text-[12px] font-bold rounded-xl transition-all border ${academicYear === year ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"}`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const addDiscount = () => {
        if (!discountAmount || isNaN(Number(discountAmount))) {
            toast.error("Please enter a valid amount");
            return;
        }

        const amount = Number(discountAmount);
        const title = discountTitle || "Manual Discount";
        const id = Math.random().toString(36).substr(2, 9);

        if (selectedFeeId === "all") {
            const newDiscounts = { ...appliedDiscounts };
            studentFees.forEach(f => {
                if (!newDiscounts[f.id]) newDiscounts[f.id] = [];
                newDiscounts[f.id].push({ amount: amount / studentFees.length, title, id });
            });
            setAppliedDiscounts(newDiscounts);
        } else {
            setAppliedDiscounts(prev => ({
                ...prev,
                [selectedFeeId]: [...(prev[selectedFeeId] || []), { amount, title, id }]
            }));
        }

        setDiscountAmount("");
        setDiscountTitle("");
        toast.success("Discount applied!");
    };

    const removeDiscount = (feeId: number, discId: string) => {
        setAppliedDiscounts(prev => ({
            ...prev,
            [feeId]: prev[feeId].filter(d => d.id !== discId)
        }));
    };

    const now = new Date();
    const timestampStr = `Day: ${now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} DATE: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()} TIME: ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase()}`;
    const voucherNumberStr = student ? `TAFS-${student.cc}-${now.getTime().toString().slice(-6)}` : "TAFS-XXXX-XXXXXX";

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <CreditCard className="h-8 w-8 text-primary" />
                        Fee Challan Generator
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">Issue and manage student fee vouchers with custom validity.</p>
                </div>


            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Student Search & Selection */}
                <div className="lg:col-span-5 space-y-6">
                    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 space-y-8 shadow-sm transition-all duration-500 ${currentStep === 1 ? "opacity-100 scale-100" : "opacity-40 grayscale pointer-events-none scale-[0.98]"}`}>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <UserSearch className="h-6 w-6" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">1. Select Student</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="relative" ref={searchDropdownRef}>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Search Student</label>
                                <div className="relative mt-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Enter Name, CC ID, or GR Number..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-12 pl-12 pr-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                    {searchQuery && !isSearching && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {showSearchDropdown && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {searchResults.map((res) => (
                                                <button
                                                    key={res.cc}
                                                    onClick={() => handleSelectStudent(res)}
                                                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-zinc-50 dark:border-zinc-900 last:border-0 text-left group"
                                                >
                                                    <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                        <UserCircle className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{res.full_name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-wider">CC: {res.cc}</span>
                                                            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">GR: {res.gr_number}</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Student Profile Preview */}
                        {student ? (
                            <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center overflow-hidden">
                                        <UserCircle className="h-10 w-10 text-zinc-200" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-base leading-tight">
                                            {student.student_full_name}
                                        </h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold mt-0.5 flex items-center gap-1.5 uppercase tracking-wide">
                                            <Building2 className="h-3 w-3" /> {student.campus || "Main Campus"}
                                        </p>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                {classes.find(c => c.id === student.class_id)?.description || "Unknown Class"} {student.section_id ? `- ${sections.find(s => s.id === student.section_id)?.description || ""}` : ""}
                                            </span>
                                            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wider">CC: {student.cc}</span>
                                        </div>
                                    </div>
                                    <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-8 py-10 border-2 border-dashed border-zinc-100 rounded-[28px] flex flex-col items-center justify-center gap-3">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full">
                                    <FileText className="h-6 w-6 text-zinc-300" />
                                </div>
                                <p className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">No student selected</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats/History */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-[28px] p-6 flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-emerald-900 font-black text-sm uppercase tracking-tight">Active Invoicing</p>
                            <p className="text-emerald-700/70 text-xs font-medium italic">Standard fee structure will be applied.</p>
                        </div>
                    </div>

                    {/* Inline Discount Section */}
                    {student && studentFees.length > 0 && (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-8 space-y-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
                                    <PercentCircle className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Quick Discounts</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Target Fee</label>
                                    <select
                                        value={selectedFeeId}
                                        onChange={(e) => setSelectedFeeId(e.target.value === "all" ? "all" : Number(e.target.value))}
                                        className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-bold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                                    >
                                        <option value="all">Apply to all (split)</option>
                                        {studentFees.map(f => (
                                            <option key={f.id} value={f.id}>{f.fee_types?.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Amount</label>
                                        <input
                                            type="number"
                                            placeholder="PKR"
                                            value={discountAmount}
                                            onChange={(e) => setDiscountAmount(e.target.value)}
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-bold focus:outline-none focus:border-emerald-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Label</label>
                                        <input
                                            type="text"
                                            placeholder="Label"
                                            value={discountTitle}
                                            onChange={(e) => setDiscountTitle(e.target.value)}
                                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-bold focus:outline-none focus:border-emerald-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={addDiscount}
                                    className="w-full h-11 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/10"
                                >
                                    Apply Discount
                                </button>
                            </div>

                            {/* Applied Discounts Mini List */}
                            {Object.keys(appliedDiscounts).some(k => appliedDiscounts[Number(k)].length > 0) && (
                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
                                    <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3">Active Adjustments</h4>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                        {Object.entries(appliedDiscounts).map(([feeId, discounts]) => (
                                            discounts.map(d => {
                                                const fee = studentFees.find(f => f.id === Number(feeId));
                                                return (
                                                    <div key={d.id} className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-zinc-400 uppercase truncate">{fee?.fee_types?.description}</p>
                                                            <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{d.title}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-3">
                                                            <span className="text-emerald-600 font-bold text-[11px] whitespace-nowrap">-{Number(d.amount).toLocaleString()}</span>
                                                            <button onClick={() => removeDiscount(Number(feeId), d.id)} className="p-1 text-zinc-300 hover:text-rose-500 transition-colors">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Challan Details Form */}
                <div className="lg:col-span-7 space-y-8">
                    {/* STEP 2: DEFINE PARAMETERS */}
                    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden transition-all duration-500 ${currentStep === 2 ? "opacity-100 translate-y-0" : "opacity-40 pointer-events-none translate-y-4 grayscale-[0.5]"}`}>
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 ${currentStep === 2 ? "bg-primary/10" : "bg-zinc-100"} rounded-xl flex items-center justify-center transition-colors`}>
                                    <SettingsIcon className={`h-5 w-5 ${currentStep === 2 ? "text-primary" : "text-zinc-400"}`} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">2. Define Parameters</h2>
                                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">Configure voucher constraints and banking</p>
                                </div>
                            </div>
                            {currentStep > 2 && (
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-200 transition-all"
                                >
                                    Edit Settings
                                </button>
                            )}
                        </div>

                        <div className="p-8 space-y-10">
                            {/* Date Range & Filtering */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-5 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Calendar className="h-3 w-3 text-primary" />
                                    </div>
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Fee Date Range</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Start Date</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={dateFrom}
                                                onChange={(e) => setDateFrom(e.target.value)}
                                                className={`w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all ${dateFrom ? "border-primary/40 text-primary" : "border-zinc-200 dark:border-zinc-800"}`}
                                            />
                                            <Calendar className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 ${dateFrom ? "text-primary/40" : "text-zinc-400"}`} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">End Date</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={dateTo}
                                                onChange={(e) => setDateTo(e.target.value)}
                                                className={`w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all ${dateTo ? "border-primary/40 text-primary" : "border-zinc-200 dark:border-zinc-800"}`}
                                            />
                                            <Calendar className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 ${dateTo ? "text-primary/40" : "text-zinc-400"}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Collection Bank */}
                            <div className="space-y-6 pt-8 border-t border-zinc-100 dark:border-zinc-900">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-5 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Building2 className="h-3 w-3 text-primary" />
                                    </div>
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Collection Bank</h3>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedBank?.id ?? ""}
                                        onChange={(e) => {
                                            const b = banks.find(x => x.id === Number(e.target.value));
                                            if (b) selectBank(b);
                                        }}
                                        disabled={isBanksLoading || banks.length === 0}
                                        className="w-full h-12 pl-12 pr-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        {isBanksLoading ? (
                                            <option>Loading banks...</option>
                                        ) : banks.length === 0 ? (
                                            <option>No banks configured</option>
                                        ) : (
                                            banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)
                                        )}
                                    </select>
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Voucher Timeline */}
                            <div className="space-y-6 pt-8 border-t border-zinc-100 dark:border-zinc-900">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-5 w-5 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <FileText className="h-3 w-3 text-primary" />
                                    </div>
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Voucher Timeline</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Date of Issue</label>
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                            className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Due Date</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Valid Till</label>
                                        <input
                                            type="date"
                                            value={validityDate}
                                            onChange={(e) => setValidityDate(e.target.value)}
                                            className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:border-primary transition-all text-rose-600 focus:text-zinc-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Surcharge & Options */}
                            <div className="pt-8 border-t border-zinc-100 dark:border-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Surcharge */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="h-5 w-5 bg-rose-50 rounded-lg flex items-center justify-center">
                                            <AlertCircle className="h-3 w-3 text-rose-500" />
                                        </div>
                                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Late Surcharge</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex h-11 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                            <button
                                                onClick={() => setApplyLateFee(true)}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${applyLateFee ? "bg-white dark:bg-zinc-950 text-rose-600 shadow-sm" : "text-zinc-400"}`}
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => setApplyLateFee(false)}
                                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${!applyLateFee ? "bg-white dark:bg-zinc-950 text-zinc-600 shadow-sm" : "text-zinc-400"}`}
                                            >
                                                None
                                            </button>
                                        </div>
                                        {applyLateFee && (
                                            <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                                                <input
                                                    type="number"
                                                    value={lateFeeAmount}
                                                    onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                                                    placeholder="Amount"
                                                    className="w-full h-11 pl-10 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/30 rounded-xl text-[12px] font-bold focus:outline-none focus:border-rose-500 transition-all text-rose-600"
                                                />
                                                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Configuration */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="h-5 w-5 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <SettingsIcon className="h-3 w-3 text-primary" />
                                        </div>
                                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Configuration</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] border border-zinc-100 dark:border-zinc-800">
                                            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Show Discounts</span>
                                            <button
                                                onClick={() => setShowDiscounts(!showDiscounts)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all ${showDiscounts ? 'bg-primary' : 'bg-zinc-300'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showDiscounts ? 'translate-x-[1.25rem]' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation for Step 2 */}
                        <div className="p-8 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900 flex justify-between">
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="h-12 px-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-50 transition-all flex items-center gap-3"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedBank) {
                                        toast.error("Please select a bank account.");
                                        return;
                                    }
                                    setCurrentStep(3);
                                }}
                                className="h-12 px-8 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-800 transition-all flex items-center gap-3 shadow-lg shadow-zinc-200"
                            >
                                Preview Fees
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* STEP 3: REVIEW & GENERATE */}
                    <div className={`transition-all duration-500 ${currentStep === 3 ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-8 absolute inset-x-0"}`}>
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                            {/* Step Header */}
                            <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                                        <FileText className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">3. Review & Generate</h2>
                                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.15em] mt-0.5 opacity-70">Final verification & voucher generation</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end mr-2">
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Fee Consolidation</span>
                                        <button 
                                            onClick={() => setGroupTuitionFees(!groupTuitionFees)}
                                            className={`h-6 w-10 rounded-full transition-all relative ${groupTuitionFees ? 'bg-primary shadow-sm' : 'bg-zinc-200'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${groupTuitionFees ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 hover:text-primary transition-all group"
                                        title="Back to Parameters"
                                    >
                                        <ChevronLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-8 space-y-6 overflow-y-auto">
                                {isFetchingFees ? (
                                    <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200">
                                        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                                        <p className="text-sm font-bold text-zinc-500">Retrieving student ledger...</p>
                                    </div>
                                ) : studentFees.length > 0 ? (
                                    <div className="space-y-6">
                                        {/* Row Reordering Info */}
                                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                            <Info className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Drag rows to reorder • Top fees settled first in receipts</span>
                                        </div>

                                        {/* Grouping Toolbar */}
                                        {selectedForGrouping.length >= 2 && (
                                            <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 mb-1.5">Combine {selectedForGrouping.length} Heads</p>
                                                    <input
                                                        type="text"
                                                        placeholder="Voucher label (e.g. Tuition Q1)"
                                                        value={groupNameInput}
                                                        onChange={(e) => setGroupNameInput(e.target.value)}
                                                        className="w-full h-10 px-4 bg-white dark:bg-zinc-950 border border-primary/20 rounded-xl text-[12px] font-bold focus:outline-none focus:border-primary transition-all shadow-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleAddGroup}
                                                    className="h-10 px-6 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/10"
                                                >
                                                    Merge Selected
                                                </button>
                                            </div>
                                        )}

                                        {/* Fee Table */}
                                        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                                            <table className="w-full text-left text-[13px]">
                                                <thead className="bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                                                    <tr>
                                                        <th className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Description</th>
                                                        <th className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px] text-right">Original (PKR)</th>
                                                        {hasAnyDiscount && (
                                                            <th className="px-6 py-4 font-black text-emerald-600 uppercase tracking-widest text-[10px] text-right">Net Amount</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                                                    {processedPdfFees.map((fee, idx) => (
                                                        <tr
                                                            key={idx}
                                                            draggable={!fee.isGrouped}
                                                            onDragStart={(e) => !fee.isGrouped && onDragStart(e, studentFees.findIndex(f => f.id === fee.feeIds?.[0]))}
                                                            onDragOver={(e) => !fee.isGrouped && onDragOver(e, studentFees.findIndex(f => f.id === fee.feeIds?.[0]))}
                                                            onDragEnd={onDragEnd}
                                                            className={`group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors ${fee.isGrouped ? "bg-zinc-50/30 dark:bg-zinc-900/10" : ""}`}
                                                        >
                                                            <td className="py-4 px-6">
                                                                <div className="flex items-center gap-3">
                                                                    {!fee.isGrouped ? (
                                                                        <>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedForGrouping.includes(fee.feeIds?.[0] || -1)}
                                                                                onChange={() => handleToggleFeeSelection(fee.feeIds?.[0] || -1)}
                                                                                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/20 cursor-pointer"
                                                                            />
                                                                            <div className="p-1 cursor-grab active:cursor-grabbing text-zinc-300 group-hover:text-zinc-400 transition-colors">
                                                                                <GripVertical className="h-4 w-4" />
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="w-11 flex justify-center">
                                                                            <div className="h-5 w-5 bg-emerald-500 rounded-md flex items-center justify-center shadow-md shadow-emerald-500/20">
                                                                                <LinkIcon className="h-3 w-3 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                                                            {fee.description}
                                                                        </span>
                                                                        {fee.isGrouped && (
                                                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter opacity-70">Custom Merged Group</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-6 text-right font-mono text-zinc-400">
                                                                {fee.amount.toLocaleString()}
                                                            </td>
                                                            {hasAnyDiscount && (
                                                                <td className="py-4 px-6 text-right font-mono font-black text-zinc-900 dark:text-zinc-100">
                                                                    {fee.netAmount.toLocaleString()}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}

                                                    {applyLateFee && (
                                                        <tr className="bg-rose-50/50 dark:bg-rose-950/10 border-t border-zinc-100 dark:border-zinc-900">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3 ml-11">
                                                                    <AlertCircle className="h-4 w-4 text-rose-500" />
                                                                    <span className="font-bold text-rose-600 uppercase text-[11px] tracking-widest">Late Payment Surcharge</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-mono text-rose-300">
                                                                {lateFeeAmount.toLocaleString()}
                                                            </td>
                                                            {hasAnyDiscount && (
                                                                <td className="px-6 py-4 text-right font-mono font-black text-rose-600">
                                                                    {lateFeeAmount.toLocaleString()}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-t-2 border-primary/20">
                                                    <tr>
                                                        <td className="px-6 py-5 font-black uppercase tracking-[0.2em] text-[10px] opacity-70">Consolidated Voucher Net</td>
                                                        <td className="hidden md:table-cell" />
                                                        <td className="px-6 py-5 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xl font-black font-mono tracking-tighter">
                                                                    {(totalFeesAmount + (applyLateFee ? lateFeeAmount : 0)).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50">
                                        <FileSearch className="h-8 w-8 text-zinc-300 mb-3" />
                                        <p className="text-sm font-bold text-zinc-500">No billable fees found for this period.</p>
                                    </div>
                                )}
                            </div>

                            {/* Summary & Generation Action */}
                            <div className="p-8 bg-zinc-50/80 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="h-14 w-1 flex bg-primary/20 rounded-full" />
                                    <div>
                                        <h4 className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Final Summary</h4>
                                        <p className="text-xs text-zinc-500 max-w-[400px] leading-relaxed mt-1">
                                            Generating voucher <b>{voucherNumberStr}</b>. Ensure dates and banking details are per current policy before proceeding.
                                        </p>
                                    </div>
                                </div>

                                {isClient && student && selectedBank && studentFees.length > 0 ? (
                                    voucherSaved ? (
                                        <PDFDownloadLink
                                            document={
                                                <FeeChallanPDF
                                                    student={{
                                                        cc: student.cc,
                                                        student_full_name: student.student_full_name,
                                                        gr_number: student.gr_number,
                                                        campus: student.campus,
                                                        class_id: student.class_id,
                                                        section_id: student.section_id,
                                                        className: classes.find(c => c.id === student.class_id)?.description || "Unknown",
                                                        sectionName: sections.find(s => s.id === student.section_id)?.description || "N/A",
                                                        grade_and_section: student.grade_and_section,
                                                        gender: student.gender,
                                                        father_name: student.father_name
                                                    }}
                                                    siblings={siblings.map(s => ({
                                                        full_name: s.full_name,
                                                        cc: s.cc,
                                                        gr_number: s.gr_number,
                                                        className: s.classes?.description || "Unknown",
                                                        sectionName: sections.find(sec => sec.id === s.section_id)?.description || "N/A"
                                                    }))}
                                                    details={{
                                                        month,
                                                        academicYear,
                                                        issueDate,
                                                        dueDate,
                                                        validityDate,
                                                        applyLateFee,
                                                        lateFeeAmount,
                                                        voucherNumber: voucherNumberStr,
                                                        generatedBy: {
                                                            fullName: user?.fullName || "System Admin",
                                                            timestampStr: timestampStr
                                                        },
                                                        bank: {
                                                            name: selectedBank.bank_name,
                                                            title: accTitle,
                                                            account: accNo,
                                                            branch: branchCode,
                                                            address: bankAddress,
                                                            iban: iban
                                                        }
                                                    }}
                                                    fees={pdfFees.map(f => ({
                                                        description: f.description,
                                                        amount: showDiscounts ? f.amount : f.netAmount,
                                                        netAmount: f.netAmount,
                                                        discount: showDiscounts ? f.discount : 0,
                                                        discountLabel: showDiscounts ? f.discountLabel : undefined
                                                    }))}
                                                    totalAmount={totalFeesAmount}
                                                />
                                            }
                                            fileName={`Challan_${student.cc}_${month}.pdf`}
                                            className="h-16 px-12 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 active:scale-[0.98] shadow-2xl shadow-emerald-600/20 group"
                                        >
                                            {({ loading }) => (
                                                <>
                                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 group-hover:translate-y-1 transition-transform" />}
                                                    {loading ? "Preparing PDF..." : "Download Voucher"}
                                                </>
                                            )}
                                        </PDFDownloadLink>
                                    ) : (
                                        <button
                                            onClick={handleSaveVoucher}
                                            disabled={isSavingVoucher}
                                            className="h-16 px-12 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-4 active:scale-[0.98] shadow-2xl shadow-black/10 disabled:opacity-50"
                                        >
                                            {isSavingVoucher ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                                            {isSavingVoucher ? "Processing..." : "Generate Voucher"}
                                            <ArrowRight className="h-5 w-5 opacity-30 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    )
                                ) : (
                                    <button
                                        disabled
                                        className="h-16 px-12 bg-zinc-200 text-zinc-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4 cursor-not-allowed"
                                    >
                                        <LockIcon className="h-5 w-5 opacity-30" />
                                        Voucher Locked
                                        <ArrowRight className="h-5 w-5 opacity-10" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Design Tokens - Floating Indicator */}
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
                <div className="bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Ready to Voucherize</span>
                </div>
            </div>
        </div>
    );
}

