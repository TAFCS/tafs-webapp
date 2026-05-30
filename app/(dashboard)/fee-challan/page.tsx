"use client";

import { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Info,
  Layers,
  X,
} from "lucide-react";
import Link from "next/link";

import { useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { bankAccountsService, BankAccount } from "@/lib/bank-accounts.service";
import {
  MONTHS,
  MONTH_TO_NUM,
  getCurrentAcademicYear,
} from "@/lib/fee-utils";
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
  installment_id?: number | null;
  installment_sequence?: number | null;
  installment_total?: number | null;
  student_fee_installments?: {
    id: number;
    fee_type_id: number;
    installment_count: number;
  } | null;
  student_fee_bundles?: {
    id: number;
    bundle_name: string;
  } | null;
}

export default function FeeChallanGenerator() {
  // --- Form States ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { cc: number; full_name: string; gr_number: string }[]
  >([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const user = useSelector((state: RootState) => state.auth.user);

  const [student, setStudent] = useState<StudentProfile | null>(null);

  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [baseYear, setBaseYear] = useState(new Date().getFullYear() - 2);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  const [month, setMonth] = useState(
    MONTHS[
      new Date().getMonth() === 0
        ? 5
        : new Date().getMonth() >= 8
          ? new Date().getMonth() - 8
          : new Date().getMonth() + 4
    ],
  );
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
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
  const [waiveSurcharge, setWaiveSurcharge] = useState(false);

  // --- Date Range Selection ---
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // --- Fees States ---
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [isFetchingFees, setIsFetchingFees] = useState(false);
  const [voucherSaved, setVoucherSaved] = useState(false);
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>("voucher.pdf");

  const [contentPreviewOpen, setContentPreviewOpen] = useState(false);
  const [contentPreviewFees, setContentPreviewFees] = useState<StudentFee[]>([]);
  const [contentPreviewArrears, setContentPreviewArrears] = useState<{
    total_arrears: number;
    arrear_fee_ids: number[];
    total_surcharge: number;
    rows: { student_fee_id: number; fee_type: string; fee_date: string; amount: string; amount_paid: string; outstanding: string; }[];
  } | null>(null);
  const [contentPreviewFeeDate, setContentPreviewFeeDate] = useState<string>('');
  const [previewingGroupDate, setPreviewingGroupDate] = useState<string | null>(null);

  // Grouped fees by fee_date (from backend)
  const [feeGroupsByDate, setFeeGroupsByDate] = useState<
    { fee_date: string; fees: StudentFee[] }[]
  >([]);
  const [generatingGroupDate, setGeneratingGroupDate] = useState<string | null>(
    null,
  );
  const [generatedGroupDates, setGeneratedGroupDates] = useState<Set<string>>(
    new Set(),
  );
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // --- Saved Voucher PDF URLs ---
  const [savedVoucherPdfUrl, setSavedVoucherPdfUrl] = useState<string | null>(null);
  const [savedVoucherId, setSavedVoucherId] = useState<number | null>(null);
  const [savedGroupVoucherPdfUrls, setSavedGroupVoucherPdfUrls] = useState<Record<string, string>>({});
  const [savedGroupVoucherIds, setSavedGroupVoucherIds] = useState<Record<string, number>>({});

  // --- Arrears State ---
  const [arrearsData, setArrearsData] = useState<{
    total_arrears: number;
    arrear_fee_ids: number[];
    total_surcharge: number;
    rows: {
      student_fee_id: number;
      fee_type: string;
      fee_date: string;
      amount: string;
      amount_paid: string;
      outstanding: string;
      
    }[];
  } | null>(null);
  const [isFetchingArrears, setIsFetchingArrears] = useState(false);
  // Track which fee_date we last fetched arrears for (group view)
  const [arrearsFetchedForDate, setArrearsFetchedForDate] = useState<
    string | null
  >(null);

  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    setVoucherSaved(false);
    setSavedVoucherPdfUrl(null);
    setSavedVoucherId(null);
    setSavedGroupVoucherPdfUrls({});
    setSavedGroupVoucherIds({});
    setGeneratedGroupDates(new Set());
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
    waiveSurcharge,
    selectedBank,
    accTitle,
    accNo,
    branchCode,
    bankAddress,
    iban,
    academicYear,
    month,
    studentFees,
  ]);

  useEffect(() => {
    if (currentStep < 3) {
      setSavedVoucherPdfUrl(null);
      setSavedVoucherId(null);
      setSavedGroupVoucherPdfUrls({});
      setSavedGroupVoucherIds({});
      setGeneratedGroupDates(new Set());
      setVoucherSaved(false);
    }
  }, [currentStep]);

  useEffect(() => {
    fetchBanks();

    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(e.target as Node)
      ) {
        setShowYearDropdown(false);
      }
      if (
        bankDropdownRef.current &&
        !bankDropdownRef.current.contains(e.target as Node)
      ) {
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
        const { data } = await api.get(
          `/v1/students/search-simple?q=${searchQuery}`,
        );
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

  const fetchStudentFees = async (
    cc: number,
    selectedMonth: string,
    selectedYear: string,
  ) => {
    setIsFetchingFees(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const { data } = await api.get(
        `/v1/student-fees/by-student/${cc}${queryStr}`,
      );
      const responseData = data?.data;
      const groups: { fee_date: string; fees: StudentFee[] }[] =
        responseData?.groups || [];
      setFeeGroupsByDate(groups);

      const allFees: StudentFee[] = responseData?.fees || [];

      if (!dateFrom && !dateTo) {
        const monthNum = MONTH_TO_NUM[selectedMonth];
        const applicableFees = allFees.filter(
          (f) =>
            (f.month === monthNum || f.target_month === monthNum) &&
            f.academic_year === selectedYear,
        );
        setStudentFees(applicableFees);
        // Sync academicYear from actual fee data so the PDF always reflects the DB value
        const feeAcademicYear = applicableFees.find(
          (f) => f.academic_year,
        )?.academic_year;
        if (feeAcademicYear) setAcademicYear(feeAcademicYear);
      } else {
        setStudentFees(allFees);
        // Sync academicYear from actual fee data so the PDF always reflects the DB value
        const feeAcademicYear = allFees.find(
          (f) => f.academic_year,
        )?.academic_year;
        if (feeAcademicYear) setAcademicYear(feeAcademicYear);
      }

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

  const handleSelectStudent = async (studentBrief: {
    cc: number;
    full_name: string;
    gr_number: string;
  }) => {
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
    if (!dueDate) setDueDate(next10.toISOString().split("T")[0]);
    if (!validityDate) setValidityDate(next15.toISOString().split("T")[0]);
  }, [dueDate, validityDate]);

  // Auto-fetch arrears when entering Review Step
  useEffect(() => {
    if (
      currentStep === 3 &&
      student &&
      (studentFees.length > 0 || feeGroupsByDate.length > 0) &&
      !arrearsFetchedForDate &&
      !isFetchingArrears
    ) {
      const earliestFeeDate =
        feeGroupsByDate.length > 0
          ? feeGroupsByDate[0].fee_date
          : dateFrom || issueDate;
      if (earliestFeeDate) fetchArrears(student.cc, earliestFeeDate);
    }
  }, [
    currentStep,
    student,
    studentFees,
    feeGroupsByDate,
    dateFrom,
    issueDate,
    arrearsFetchedForDate,
    isFetchingArrears,
  ]);

  // Fetch arrears for a given fee_date (called when a group card loads or before single-voucher generation)
  const fetchArrears = async (studentCc: number, feeDate: string) => {
    setIsFetchingArrears(true);
    try {
      const { data } = await api.get("/v1/vouchers/arrears", {
        params: {
          student_id: studentCc,
          fee_date: feeDate,
          _t: Date.now(),
          waive_surcharge: waiveSurcharge,
        },
      });
      const result = data.data ?? null;
      setArrearsData(result);
      setArrearsFetchedForDate(feeDate);
      return result;
    } catch (err) {
      console.error("Failed to fetch arrears:", err);
      return null;
    } finally {
      setIsFetchingArrears(false);
    }
  };

  const handleSaveVoucher = async () => {
    if (!student || !selectedBank)
      return toast.error("Select student and bank.");
    setIsSavingVoucher(true);

    // FORCE fresh arrears catch to ensure PDF has latest data
    const fd = dateFrom || issueDate;
    const freshArrears = await fetchArrears(student.cc, fd);
    console.log(
      `[VOUCHER_DEBUG] Manual Fresh Arrears for ${fd}:`,
      freshArrears,
    );

    try {
      // Determine fee_date for this voucher (use dateFrom if set, else today)
      const voucherFeeDate = fd;

      // Merge arrear IDs first so they appear first in the orderedFeeIds list
      const arrearIds = freshArrears?.arrear_fee_ids ?? [];
      const currentFeeIds = studentFees.map((f) => f.id);
      const allFeeIds = [...arrearIds, ...currentFeeIds];

      console.log(
        "Generating Single Voucher - Ordered Fee IDs (arrears+current):",
        allFeeIds,
      );

      // 1. Create the voucher in DB first (without PDF) to get the real ID
      const formData = new FormData();
      formData.append("student_id", student.cc.toString());
      formData.append("campus_id", (student.campus_id || 1).toString());
      formData.append("class_id", student.class_id.toString());
      if (student.section_id)
        formData.append("section_id", student.section_id.toString());
      formData.append("bank_account_id", selectedBank.id.toString());
      formData.append("issue_date", issueDate);
      formData.append("due_date", dueDate);
      if (validityDate) formData.append("validity_date", validityDate);
      if (voucherFeeDate) formData.append("fee_date", voucherFeeDate);
      formData.append("academic_year", academicYear);
      formData.append("month", (MONTH_TO_NUM[month] || 1).toString());
      formData.append("late_fee_charge", applyLateFee.toString());
      formData.append("late_fee_amount", (lateFeeAmount || 0).toString());
      formData.append("waive_surcharge", waiveSurcharge.toString());
      formData.append(
        "waived_by",
        (user?.fullName || user?.username || "Administrator").toString(),
      );
      formData.append("precedence", "1");
      allFeeIds.forEach((id) =>
        formData.append("orderedFeeIds", id.toString()),
      );

      // Build fee_lines: surcharge rows are now written by the backend to voucher_arrear_surcharges,
      // so we only pass real arrear student_fee rows (isSurcharge === false).
      const arrearLines = (freshArrears?.rows ?? [])
        .filter((r: any) => !r.isSurcharge)
        .map((r: any) => ({
          student_fee_id: r.student_fee_id,
          discount_amount: 0,
          discount_label: undefined,
        }));
      const currentLines = studentFees.map((f) => ({
        student_fee_id: Number(f.id),
        discount_amount: Math.max(
          0,
          Number(f.amount_before_discount || 0) - Number(f.amount || 0),
        ),
        discount_label: f.voucher_heads?.[0]?.discount_amount
          ? "Applied Discount"
          : undefined,
      }));
      formData.append(
        "fee_lines",
        JSON.stringify([...arrearLines, ...currentLines]),
      );

      const { data: createRes } = await api.post("/v1/vouchers", formData);
      const voucherId: number = createRes.data.id;

      // Generate PDF using backend (single source of truth)
      const genRes = await api.post(`/v1/vouchers/${voucherId}/generate-pdf`);
      const pdfUrl = genRes.data?.data?.pdf_url || null;
      setSavedVoucherPdfUrl(pdfUrl);
      setSavedVoucherId(voucherId);
      if (pdfUrl) {
        setPreviewPdfUrl(pdfUrl);
        setPreviewFilename(`${student?.gr_number || 'unknown'}-${voucherFeeDate}-${voucherId}.pdf`);
        setPreviewModalOpen(true);
      }

      toast.success("Voucher generated!");
      setVoucherSaved(true);
    } catch (e: any) {
      const errorData = e.response?.data;
      console.error("Voucher Error Status:", e.response?.status);
      console.error(
        "Voucher Error Body Full:",
        JSON.stringify(errorData, null, 2),
      );

      const msg = errorData?.message || e.message;
      const finalMsg = Array.isArray(msg) ? msg.join(", ") : msg;
      toast.error(`Error: ${finalMsg}`, { duration: 6000 });
    } finally {
      setIsSavingVoucher(false);
    }
  };

  const handleSaveVoucherForGroup = async (group: {
    fee_date: string;
    fees: StudentFee[];
  }) => {
    if (!student || !selectedBank) return;
    setGeneratingGroupDate(group.fee_date);

    // FORCE fresh arrears fetch before generation for this group
    const freshArrears = await fetchArrears(student.cc, group.fee_date);
    console.log(
      `[VoucherGroup] Fresh Arrears for ${group.fee_date}:`,
      freshArrears,
    );

    try {
      // Merge arrear IDs (prepend) to current group IDs
      const arrearIds = freshArrears?.arrear_fee_ids ?? [];
      const currentGroupIds = group.fees.map((f) => f.id);
      const allFeeIds = [...arrearIds, ...currentGroupIds];

      console.log(
        "Generating Group Voucher - Ordered Fee IDs (arrears+current):",
        allFeeIds,
      );

      // 1. Create the voucher in DB first to get the real ID
      const formData = new FormData();
      formData.append("student_id", student.cc.toString());
      formData.append("campus_id", (student.campus_id || 1).toString());
      formData.append("class_id", student.class_id.toString());
      if (student.section_id)
        formData.append("section_id", student.section_id.toString());
      formData.append("bank_account_id", selectedBank.id.toString());
      formData.append("issue_date", issueDate);
      formData.append("due_date", dueDate);
      if (validityDate) formData.append("validity_date", validityDate);
      formData.append("fee_date", group.fee_date);
      formData.append("academic_year", academicYear);
      formData.append("month", (MONTH_TO_NUM[month] || 1).toString());
      formData.append("late_fee_charge", applyLateFee.toString());
      formData.append("late_fee_amount", (lateFeeAmount || 0).toString());
      formData.append("waive_surcharge", waiveSurcharge.toString());
      formData.append(
        "waived_by",
        (user?.fullName || user?.username || "Administrator").toString(),
      );
      formData.append("precedence", "1");
      allFeeIds.forEach((id) =>
        formData.append("orderedFeeIds", id.toString()),
      );

      const arrearLines = (freshArrears?.rows ?? [])
        .filter((r: any) => !r.isSurcharge)
        .map((r: any) => ({
          student_fee_id: r.student_fee_id,
          discount_amount: 0,
          discount_label: undefined,
        }));
      const currentLines = group.fees.map((f) => ({
        student_fee_id: Number(f.id),
        discount_amount: Math.max(
          0,
          Number(f.amount_before_discount || 0) - Number(f.amount || 0),
        ),
        discount_label: f.voucher_heads?.[0]?.discount_amount
          ? "Applied Discount"
          : undefined,
      }));
      formData.append(
        "fee_lines",
        JSON.stringify([...arrearLines, ...currentLines]),
      );

      const { data: createRes } = await api.post("/v1/vouchers", formData);
      const voucherId: number = createRes.data.id;

      // Generate PDF using backend (single source of truth)
      const genRes = await api.post(`/v1/vouchers/${voucherId}/generate-pdf`);
      const groupPdfUrl = genRes.data?.data?.pdf_url || null;
      if (groupPdfUrl) {
        setSavedGroupVoucherPdfUrls((prev) => ({ ...prev, [group.fee_date]: groupPdfUrl }));
        setSavedGroupVoucherIds((prev) => ({ ...prev, [group.fee_date]: voucherId }));
        setPreviewPdfUrl(groupPdfUrl);
        setPreviewFilename(`${student?.gr_number || ''}-${group.fee_date}-${voucherId}.pdf`);
        setPreviewModalOpen(true);
      }

      setGeneratedGroupDates((p) => new Set([...p, group.fee_date]));
      toast.success(`Generated for ${group.fee_date}`);
    } catch (e: any) {
      const errorData = e.response?.data;
      console.error("Voucher Error Status:", e.response?.status);
      console.error(
        "Voucher Error Body Full:",
        JSON.stringify(errorData, null, 2),
      );

      const msg = errorData?.message || e.message;
      const finalMsg = Array.isArray(msg) ? msg.join(", ") : msg;
      toast.error(`Error: ${finalMsg}`, { duration: 6000 });
    } finally {
      setGeneratingGroupDate(null);
    }
  };

  const handleGenerateAllGroups = async () => {
    setIsGeneratingAll(true);
    for (const g of feeGroupsByDate)
      if (!generatedGroupDates.has(g.fee_date))
        await handleSaveVoucherForGroup(g);
    setIsGeneratingAll(false);
  };

  const handleShowPreview = async (fees: StudentFee[], feeDate: string) => {
    if (!student) return;
    const arrears = await fetchArrears(student.cc, feeDate);
    setContentPreviewFees(fees);
    setContentPreviewArrears(arrears);
    setContentPreviewFeeDate(feeDate);
    setContentPreviewOpen(true);
  };

  const handleShowPreviewForGroup = async (group: { fee_date: string; fees: StudentFee[] }) => {
    if (!student) return;
    setPreviewingGroupDate(group.fee_date);
    const arrears = await fetchArrears(student.cc, group.fee_date);
    setContentPreviewFees(group.fees);
    setContentPreviewArrears(arrears);
    setContentPreviewFeeDate(group.fee_date);
    setContentPreviewOpen(true);
    setPreviewingGroupDate(null);
  };

  const downloadPdf = async (pdfUrl: string, filename: string) => {
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(pdfUrl, '_blank');
    }
  };

  const YearPicker = () => {
    const years = Array.from(
      { length: 12 },
      (_, i) => `${baseYear + i}-${baseYear + i + 1}`,
    );
    return (
      <div className="relative" ref={yearDropdownRef}>
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
          Academic Year
        </label>
        <button
          onClick={() => setShowYearDropdown(!showYearDropdown)}
          className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
        >
          <span className="text-zinc-900 dark:text-zinc-100">
            {academicYear}
          </span>
          <Calendar className="h-4 w-4 text-zinc-400" />
        </button>
        {showYearDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <button
                onClick={() => setBaseYear((prev) => prev - 12)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                {baseYear} - {baseYear + 11}
              </span>
              <button
                onClick={() => setBaseYear((prev) => prev + 12)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setAcademicYear(y);
                    setShowYearDropdown(false);
                  }}
                  className={`px-3 py-2.5 text-center text-[12px] font-bold rounded-xl transition-all border ${academicYear === y ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent"}`}
                >
                  {y}
                </button>
              ))}
            </div>
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

      <div className="flex flex-col gap-10">
        {/* Step 1: Select Student (FULL WIDTH) */}
        <div
          className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-8 space-y-10 shadow-xl transition-all duration-500 w-full ${currentStep === 1 ? "ring-4 ring-primary/5 active-step" : "opacity-60 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 cursor-pointer"}`}
          onClick={() => { if (currentStep > 1) setCurrentStep(1); }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 bg-primary/10 rounded-3xl flex items-center justify-center text-primary rotate-3 transition-transform shadow-sm border border-primary/5">
                <UserSearch className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                  1. Select Student
                  {currentStep > 1 && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest font-black">Completed</span>}
                </h2>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                  Search student profile to begin
                </p>
              </div>
            </div>
            {currentStep > 1 ? (
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentStep(1); }}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                Change Student
              </button>
            ) : (
              student && (
                <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg animate-in zoom-in">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="relative" ref={searchDropdownRef}>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                Find Student
              </label>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Enter Name, CC ID, or GR Number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 pl-14 pr-14 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-[14px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all pointer-events-auto"
                  disabled={currentStep !== 1}
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                {isSearching && (
                  <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
                )}
              </div>
              {showSearchDropdown && searchResults.length > 0 && currentStep === 1 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[28px] shadow-2xl z-[100] max-h-[400px] overflow-hidden overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
                  {searchResults.map((res) => (
                    <button
                      key={res.cc}
                      onClick={(e) => { e.stopPropagation(); handleSelectStudent(res); }}
                      className="w-full px-6 py-5 flex items-center gap-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left transition-all border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 group"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                        <UserCircle className="h-7 w-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">
                            {res.full_name}
                          </p>
                          <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-zinc-500">
                            GR: {res.gr_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-primary font-bold mt-0.5">
                          COMPUTER CODE: {res.cc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {student && (
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-[32px] relative overflow-hidden group hover:shadow-lg transition-all duration-500">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                  <UserSearch className="h-16 w-16 text-primary" />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="h-16 w-16 rounded-[22px] bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700">
                    <UserCircle className="h-10 w-10" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100 leading-tight">
                      {student.student_full_name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" /> {student.campus}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tight">
                        CC: {student.cc}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-tight">
                        GR: {student.gr_number}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Parameters (FULL WIDTH) */}
        {(currentStep >= 2 || student) && (
          <div
            className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] shadow-2xl transition-all duration-500 w-full animate-in slide-in-from-top-10 ${currentStep === 2 ? "ring-4 ring-primary/5 active-step" : "opacity-60 grayscale-[0.5] hover:grayscale-0 hover:opacity-100 cursor-pointer"}`}
            onClick={() => { if (currentStep !== 2) setCurrentStep(2); }}
          >
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shadow-sm border border-primary/5">
                  <SettingsIcon className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    2. Define Parameters
                    {currentStep > 2 && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest font-black">Completed</span>}
                  </h2>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                    Configure voucher constraints and banking
                  </p>
                </div>
              </div>
              {currentStep > 1 && (
                <div className="flex items-center gap-4">
                  {currentStep === 2 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentStep(1); }}
                      className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" /> Change Student
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentStep(2); }}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                      Edit Params
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={`p-10 space-y-12 ${currentStep !== 2 ? "pointer-events-none" : ""}`}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                {/* Left Column: Bank & Dates */}
                <div className="space-y-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                        Collection Bank
                      </h3>
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
                            <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">
                              {selectedBank ? selectedBank.bank_name : "Select Bank Account"}
                            </p>
                            {selectedBank && (
                              <p className="text-[11px] font-bold text-zinc-400">
                                {selectedBank.account_title} - {selectedBank.account_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${showBankDropdown ? "rotate-180" : ""}`} />
                      </button>
                      {showBankDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4">
                          <div className="max-h-[300px] overflow-y-auto p-3">
                            {banks.map((b) => (
                              <button
                                key={b.id}
                                onClick={() => { selectBank(b); setShowBankDropdown(false); }}
                                className={`w-full p-5 rounded-2xl flex items-center justify-between transition-all ${selectedBank?.id === b.id ? "bg-primary/5 border-2 border-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border-2 border-transparent"}`}
                              >
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

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                        Voucher Timeline
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "Date of Issue", val: issueDate, setter: setIssueDate, color: "primary" },
                        { label: "Due Date", val: dueDate, setter: setDueDate, color: "primary" },
                        { label: "Valid Till", val: validityDate, setter: setValidityDate, color: "rose" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{item.label}</label>
                          <input
                            type="date"
                            value={item.val}
                            onChange={(e) => item.setter(e.target.value)}
                            className={`w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-black focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all ${item.color === "rose" ? "text-rose-600" : ""}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Date Range and Policies */}
                <div className="space-y-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                        Fee Date Range
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-end gap-6">
                      <div className="flex-1 min-w-[140px] space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Start Date</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 rounded-2xl text-[13px] font-black" />
                      </div>
                      <div className="flex-1 min-w-[140px] space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">End Date</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 rounded-2xl text-[13px] font-black" />
                      </div>
                      <button onClick={handleApplyDateFilter} className="h-12 px-8 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95">Apply</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Late Surcharge</h3>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[20px] border border-zinc-200/50">
                        <button onClick={() => setApplyLateFee(true)} className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${applyLateFee ? "bg-white text-rose-600 shadow-xl" : "text-zinc-400"}`}>Apply</button>
                        <button onClick={() => setApplyLateFee(false)} className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!applyLateFee ? "bg-white text-zinc-400 shadow-xl" : "text-zinc-400"}`}>None</button>
                      </div>
                      {applyLateFee && <input type="number" value={lateFeeAmount} onChange={(e) => setLateFeeAmount(Number(e.target.value))} className="w-full h-12 px-5 bg-rose-50/50 border-2 border-rose-100 rounded-2xl text-[14px] font-black text-rose-600" />}
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Info className="h-4 w-4 text-emerald-500" />
                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Waiver Policy</h3>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[20px] border border-zinc-200/50">
                        <button onClick={() => setWaiveSurcharge(true)} className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${waiveSurcharge ? "bg-white text-emerald-600 shadow-xl" : "text-zinc-400"}`}>Waive</button>
                        <button onClick={() => setWaiveSurcharge(false)} className={`flex-1 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!waiveSurcharge ? "bg-white text-emerald-600 shadow-xl" : "text-zinc-400"}`}>Charge</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {currentStep === 2 && (
              <div className="p-10 border-t border-zinc-100 dark:border-zinc-900 flex justify-end bg-zinc-50/30 dark:bg-zinc-900/10 rounded-b-[40px]">
                <button
                  onClick={() => { if (selectedBank) setCurrentStep(3); else toast.error("Select bank"); }}
                  className="px-12 h-16 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[24px] text-[13px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-4 group"
                >
                  Preview & Generate
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Generate (FULL WIDTH STACKED) */}
        {currentStep === 3 && (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] shadow-2xl overflow-hidden min-h-[600px] flex flex-col animate-in slide-in-from-top-10 duration-700 w-full">
            <div className="p-10 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-500/10">
                  <FileSearch className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                    3. Review & Generate
                  </h2>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-0.5">
                    Final Verification & Voucher Generation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Back to Parameters
                </button>
              </div>
            </div>

            <div className="flex-1 p-10 overflow-y-auto bg-zinc-50/20 dark:bg-zinc-900/5">
              {isFetchingFees ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-zinc-400 font-bold text-[13px] uppercase tracking-widest">Scanning academic records...</p>
                </div>
              ) : feeGroupsByDate.length > 0 ? (
                <div className="space-y-10 w-full max-w-6xl mx-auto pb-10">
                  <div className="bg-primary/5 border-2 border-primary/10 p-8 rounded-[32px] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/10">
                        <CreditCard className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-primary uppercase tracking-tight">{feeGroupsByDate.length} Voucher Groups Found</h3>
                        <p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest mt-0.5">Each fee_date becomes a separate voucher</p>
                      </div>
                    </div>
                    <button onClick={handleGenerateAllGroups} disabled={isGeneratingAll} className="h-14 px-10 bg-primary text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl flex items-center gap-4 disabled:opacity-50">
                      {isGeneratingAll ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} Generate All
                    </button>
                  </div>

                  <div className="space-y-8">
                    {feeGroupsByDate.map((g) => {
                      return (
                        <div key={g.fee_date} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="p-8 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
                            <div className="flex items-center gap-5">
                              <Calendar className="h-6 w-6 text-zinc-400" />
                              <div>
                                <h4 className="font-black text-lg text-zinc-900 dark:text-zinc-100">FEE DATE: {g.fee_date}</h4>
                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{g.fees.length} fees</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleShowPreviewForGroup(g)} disabled={previewingGroupDate === g.fee_date} className="h-12 px-6 rounded-2xl text-[11px] uppercase font-black tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-2 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                {previewingGroupDate === g.fee_date ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Preview
                              </button>
                              <button onClick={() => handleSaveVoucherForGroup(g)} disabled={generatingGroupDate === g.fee_date} className={`h-12 px-10 rounded-2xl text-[11px] uppercase font-black tracking-widest transition-all flex items-center gap-3 ${generatedGroupDates.has(g.fee_date) ? "bg-emerald-50 text-emerald-600" : "bg-zinc-900 text-white"}`}>
                                {generatingGroupDate === g.fee_date ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                {generatedGroupDates.has(g.fee_date) ? "Regenerate" : "Generate"}
                              </button>
                              {generatedGroupDates.has(g.fee_date) && savedGroupVoucherPdfUrls[g.fee_date] && (
                                <>
                                  <button onClick={() => { setPreviewPdfUrl(savedGroupVoucherPdfUrls[g.fee_date]); setPreviewFilename(`${g.fee_date}-${student?.gr_number || `CC${student?.cc}` || 'unknown'}-${savedGroupVoucherIds[g.fee_date]}.pdf`); setPreviewModalOpen(true); }} className="h-12 px-6 rounded-2xl text-[11px] uppercase font-black tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> View PDF
                                  </button>
                                  <button onClick={() => downloadPdf(savedGroupVoucherPdfUrls[g.fee_date], `${g.fee_date}-${student?.gr_number || `CC${student?.cc}` || 'unknown'}-${savedGroupVoucherIds[g.fee_date]}.pdf`)} className="h-12 px-6 rounded-2xl text-[11px] uppercase font-black tracking-widest bg-emerald-600 text-white flex items-center gap-2">
                                    <Download className="h-4 w-4" /> Download
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : studentFees.length > 0 ? (
                <div className="space-y-10 w-full max-w-6xl mx-auto">
                  <div className="flex justify-end gap-4 pb-10">
                    <button onClick={() => handleShowPreview(studentFees, dateFrom || issueDate)} disabled={isFetchingArrears} className="h-16 px-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-3 transition-all hover:-translate-y-1">
                      {isFetchingArrears ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSearch className="h-5 w-5" />} Preview
                    </button>
                    <button onClick={handleSaveVoucher} disabled={isSavingVoucher} className="h-16 px-12 bg-zinc-900 text-white rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-4 shadow-2xl transition-all hover:-translate-y-1">
                      {isSavingVoucher ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} Generate
                    </button>
                    {voucherSaved && savedVoucherPdfUrl && (
                      <>
                        <button onClick={() => { setPreviewPdfUrl(savedVoucherPdfUrl); setPreviewFilename(`${dateFrom || issueDate}-${student?.gr_number || `CC${student?.cc}` || 'unknown'}-${savedVoucherId}.pdf`); setPreviewModalOpen(true); }} className="h-16 px-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-3 transition-all hover:-translate-y-1">
                          <FileText className="h-5 w-5" /> View PDF
                        </button>
                        <button onClick={() => downloadPdf(savedVoucherPdfUrl!, `${dateFrom || issueDate}-${student?.gr_number || `CC${student?.cc}` || 'unknown'}-${savedVoucherId}.pdf`)} className="h-16 px-8 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-[12px] tracking-widest flex items-center gap-3 shadow-xl transition-all hover:-translate-y-1">
                          <Download className="h-5 w-5" /> Download
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-32 flex flex-col items-center gap-6 opacity-30">
                  <AlertCircle className="h-20 w-20" />
                  <p className="text-[16px] font-black uppercase tracking-[0.2em]">No fees identified in range</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content Preview Modal (soft-run — no PDF generated) */}
      {contentPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setContentPreviewOpen(false)}>
          <div className="relative w-full max-w-xl max-h-[85vh] bg-white dark:bg-zinc-950 rounded-[32px] shadow-2xl overflow-hidden flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/10">
              <div>
                <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-[13px] uppercase tracking-widest flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" /> Voucher Preview
                </h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Not yet issued — review before generating</p>
              </div>
              <button onClick={() => setContentPreviewOpen(false)} className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student / Meta Info */}
            <div className="px-7 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-bold">
                <span className="text-zinc-700 dark:text-zinc-300 font-black">{student?.student_full_name}</span>
                <span className="text-primary">GR {student?.gr_number}</span>
                <span className="text-zinc-400">Fee Date: {contentPreviewFeeDate}</span>
                <span className="text-zinc-400">Year: {academicYear}</span>
              </div>
            </div>

            {/* Fee Lines */}
            <div className="flex-1 overflow-y-auto p-7 space-y-6">

              {/* Arrears */}
              {(contentPreviewArrears?.rows ?? []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Arrears</h4>
                  {contentPreviewArrears!.rows.map((r, i) => {
                    const isPartial = Number(r.amount_paid) > 0;
                    const d = new Date(r.fee_date);
                    const monthLabel = d.toLocaleString('en', { month: 'short' }).toUpperCase() + ' ' + String(d.getFullYear()).slice(-2);
                    return (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400 flex-1">
                          {isPartial ? 'BALANCE — ' : ''}{r.fee_type} ({monthLabel})
                        </span>
                        <span className="font-black text-zinc-900 dark:text-zinc-100 text-[13px] font-mono tabular-nums">
                          PKR {Number(r.outstanding).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Current Fees */}
              {contentPreviewFees.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">Current Fees</h4>
                  {contentPreviewFees.map((f) => {
                    const installLabel = f.installment_sequence && f.installment_total
                      ? ` (${f.installment_sequence} of ${f.installment_total})`
                      : f.installment_sequence && f.student_fee_installments
                      ? ` (${f.installment_sequence} of ${f.student_fee_installments.installment_count})`
                      : '';
                    const discount = Math.max(0, Number(f.amount_before_discount || 0) - Number(f.amount || 0));
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-4">
                        <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400 flex-1">
                          {f.fee_types?.description || 'Fee'}{installLabel}
                          {discount > 0 && <span className="ml-2 text-emerald-500 text-[10px]">(-{discount.toLocaleString()} disc)</span>}
                        </span>
                        <span className="font-black text-zinc-900 dark:text-zinc-100 text-[13px] font-mono tabular-nums">
                          PKR {Number(f.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Estimated Total */}
              <div className="pt-2 border-t-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Estimated Total</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100 text-[18px] font-mono tabular-nums">
                  PKR {(
                    (contentPreviewArrears?.rows ?? []).reduce((s, r) => s + Number(r.outstanding), 0) +
                    contentPreviewFees.reduce((s, f) => s + Number(f.amount), 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Bank Footer */}
            <div className="px-7 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between">
              <div className="text-[11px] font-bold space-y-0.5">
                <p className="text-zinc-700 dark:text-zinc-300 font-black">{selectedBank?.bank_name}</p>
                <p className="text-zinc-400">{selectedBank?.account_number}</p>
              </div>
              <div className="text-right text-[11px] font-bold space-y-0.5">
                <p className="text-zinc-500">Issued: {issueDate}</p>
                <p className="text-rose-500">Due: {dueDate}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewModalOpen && previewPdfUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewModalOpen(false)}>
          <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-zinc-950 rounded-[32px] shadow-2xl overflow-hidden flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/10">
              <h3 className="font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest text-[13px] flex items-center gap-3">
                <FileText className="h-5 w-5 text-emerald-500" />
                Voucher Preview
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={() => downloadPdf(previewPdfUrl!, previewFilename)} className="h-10 px-6 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button onClick={() => setPreviewModalOpen(false)} className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <iframe src={previewPdfUrl} className="flex-1 w-full bg-zinc-100" title="Voucher Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
