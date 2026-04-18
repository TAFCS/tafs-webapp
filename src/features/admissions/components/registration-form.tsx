"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, CheckCircle, AlertCircle, Loader2, CreditCard, Calendar, Eye, Camera, X, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import api from "@/lib/api";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { StudentProfileModal } from "@/src/features/students/components/student-profile-modal";
import { StudentListItem } from "@/src/store/slices/studentsSlice";

const GRADE_NAME_TO_CODE: Record<string, string> = {
    'Pre-Nursery': 'PN',
    'Nursery': 'NUR',
    'K.G.': 'KG',
    'JR-I': 'JRI',
    'JR-II': 'JRII',
    'JR-III': 'JRIII',
    'JR-IV': 'JRIV',
    'JR-V': 'JRV',
    'SR-I': 'SRI',
    'SR-II': 'SRII',
    'SR-III': 'SRIII',
    'O-I': 'OI',
    'O-II': 'OII',
    'O-III': 'OIII',
    'VI': 'VI',
    'VII': 'VII',
    'VIII': 'VIII',
    'IX': 'IX',
    'X': 'X',
    'AS Level': 'AS',
    'A2 Level': 'A2'
};

const INITIAL_FORM_DATA = {
    campusId: "",
    candidateName: "", fatherName: "", motherName: "",
    fatherCnic: "", motherCnic: "",
    dobDay: "", dobMonth: "", dobYear: "",
    nationalityPakistani: true, nationalityOther: "",
    gender: "", religion: "", identificationMarks: "", isIdentificationMarksNA: false,
    birthCountry: "", birthProvince: "", birthCity: "",
    ageYears: "",
    previousSchools: [{ id: 1, name: "", location: "", classStudiedFrom: "", classStudiedTo: "", reasonForLeaving: "" }],
    admissionSystem: "", admissionLevel: "", discipline: "", isDisciplineNA: false,
    houseNo: "", areaBlock: "", city: "", postalCode: "", isPostalCodeNA: false, province: "", country: "", 
    homePhoneCountryCode: "+92", homePhone: "", isHomePhoneNA: false,
    fatherPrimaryPhoneCountryCode: "+92", motherPrimaryPhoneCountryCode: "+92", emergencyPrimaryPhoneCountryCode: "+92",
    candidatePhone: "", isCandidatePhoneNA: false, 
    candidateEmail: "", isCandidateEmailNA: false, 
    fatherPhone: "", isFatherPhoneNA: false, 
    fatherEmail: "", isFatherEmailNA: false, 
    fatherFax: "", isFatherFaxNA: false,
    motherPhone: "", isMotherPhoneNA: false,
    motherEmail: "", isMotherEmailNA: false,
    motherFax: "", isMotherFaxNA: false,
    isFatherWhatsapp: true, fatherWhatsapp: "",
    isMotherWhatsapp: true, motherWhatsapp: "",
    emergencyContactType: "other", // Added for selection logic
    emergencyContactName: "", isEmergencyContactNameNA: false,
    emergencyContactPhone: "", emergencyRelationship: "",
    testDay: "", testDate: "", testTime: "", testLevel: "",
    // New: Staged files for upload
    photographFile: null as File | null,
    fatherPhotoFile: null as File | null,
    motherPhotoFile: null as File | null,
    flags: [] as Array<{ id: string; reminderDate: string; description: string }>,
    isFatherCnicForeign: false,
    isMotherCnicForeign: false,
    isFatherPhoneForeign: false,
    isMotherPhoneForeign: false,
    fatherPhotoUrl: "",
    motherPhotoUrl: "",
    fatherAdditionalPhones: [] as Array<{ id: string; label: string; number: string }>,
    motherAdditionalPhones: [] as Array<{ id: string; label: string; number: string }>,
};

import { memo } from "react";

const RegistrationPhotoBox = memo(function RegistrationPhotoBox({ 
    label, 
    file, 
    existingUrl,
    onChange, 
    className = "" 
}: { 
    label: string; 
    file: File | null; 
    existingUrl?: string | null;
    onChange: (file: File | null) => void;
    className?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file]);

    // Proxy for existing URLs to bypass CORS/access issues
    const proxiedExistingUrl = existingUrl ? `/api/v1/media/proxy?url=${encodeURIComponent(existingUrl.replace(/([^:])\/\//g, '$1/'))}` : null;

    return (
        <div 
            onClick={() => inputRef.current?.click()}
            className={`relative group border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:border-primary transition-all overflow-hidden ${className}`}
        >
            {previewUrl || proxiedExistingUrl ? (
                <>
                    <img src={previewUrl || proxiedExistingUrl!} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Camera className="h-5 w-5 text-white" />
                            <span className="text-[8px] font-black uppercase text-white tracking-widest bg-black/50 px-2 py-0.5 rounded">
                                {previewUrl ? 'Change New' : 'Upload New'}
                            </span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center gap-1 p-2">
                    <Camera className="h-5 w-5 text-zinc-400" />
                    <span className="text-[10px] leading-tight font-bold uppercase" dangerouslySetInnerHTML={{ __html: label }} />
                </div>
            )}
            
            {file && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onChange(null); }}
                    className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110 active:scale-95"
                    title="Remove selected file"
                >
                    <X className="h-3 w-3" />
                </button>
            )}

            <input 
                type="file" 
                ref={inputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onChange(f);
                }} 
            />
        </div>
    );
});

export function RegistrationForm() {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { items: classes, isLoading: isClassesLoading } = useSelector((state: RootState) => state.classes);
    const { items: campuses, isLoading: isCampusesLoading } = useSelector((state: RootState) => state.campuses);
    const [currentStep, setCurrentStep] = useState(1);
    const [fetchingCnic, setFetchingCnic] = useState<"father" | "mother" | null>(null);
    const [academicYear, setAcademicYear] = useState("2025-2026");
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [baseYear, setBaseYear] = useState(new Date().getFullYear());
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const isMetadataLoading = (isClassesLoading && classes.length === 0) || (isCampusesLoading && campuses.length === 0);

    useEffect(() => {
        if (classes.length === 0 && !isClassesLoading) {
            dispatch(fetchClasses());
        }
        if (campuses.length === 0 && !isCampusesLoading) {
            dispatch(fetchCampuses());
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setShowYearDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dispatch, classes.length, campuses.length, isClassesLoading, isCampusesLoading]);

    const [formData, setFormData] = useState(INITIAL_FORM_DATA);

    // Auto-calculate age from DOB
    useEffect(() => {
        const { dobDay, dobMonth, dobYear } = formData;
        if (dobDay && dobMonth && dobYear && dobYear.length === 4) {
            const day = parseInt(dobDay);
            const month = parseInt(dobMonth);
            const year = parseInt(dobYear);

            if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
                const birthDate = new Date(year, month - 1, day);
                const today = new Date();

                if (!isNaN(birthDate.getTime())) {
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    
                    const ageStr = Math.max(0, age).toString();
                    if (formData.ageYears !== ageStr) {
                        setFormData(prev => ({ ...prev, ageYears: ageStr }));
                    }
                }
            }
        }
    }, [formData.dobDay, formData.dobMonth, formData.dobYear, formData.ageYears]);



    const formatCNIC = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 13);
        let formatted = digits;
        if (digits.length > 5) formatted = digits.slice(0, 5) + "-" + digits.slice(5);
        if (digits.length > 12) formatted = formatted.slice(0, 13) + "-" + formatted.slice(13);
        return formatted;
    };

    const formatPhone = (value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.startsWith("92")) digits = digits.slice(2);
        if (digits.startsWith("0")) digits = digits.slice(1);
        return digits.slice(0, 10);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        // 1. Handle CNIC formatting
        if (name === "fatherCnic" || name === "motherCnic") {
            const isForeign = name === "fatherCnic" ? formData.isFatherCnicForeign : formData.isMotherCnicForeign;
            if (isForeign) {
                setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
                // No auto-fetch for foreign CNIC as it doesn't match standard format
                return;
            }
            const formatted = formatCNIC(value);
            setFormData(prev => ({ ...prev, [name]: formatted }));
            
            // Auto-fetch if 13+ digits are reached (local) or any input (foreign)
            const digits = value.replace(/\D/g, "");
            if (digits.length === 13 || isForeign) {
                fetchGuardianData(name === "fatherCnic" ? "father" : "mother", value);
            }
            return;
        }

        // 2. Handle Phones, WhatsApp, and Fax (Numeric/Symbolic)
        if (name.toLowerCase().includes("phone") || name.toLowerCase().includes("whatsapp") || name.toLowerCase().includes("fax")) {
            if (type !== "checkbox") {
                const isForeign = (name === "fatherPhone" && formData.isFatherPhoneForeign) || (name === "motherPhone" && formData.isMotherPhoneForeign);
                if (isForeign || name === "homePhone" || name.includes("CountryCode")) {
                    // Allow free-form entry for foreign or home phones
                    const filtered = value.replace(/[^0-9+]/g, "");
                    setFormData(prev => ({ ...prev, [name]: filtered }));
                    return;
                }
                setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
                return;
            }
        }

        // 3. Handle Alpha-only fields (Names, Countries, Cities, Relationships)
        const alphaFields = [
            "candidateName", "fatherName", "motherName",
            "emergencyContactName", "emergencyRelationship",
            "birthCountry", "birthProvince", "birthCity",
            "province", "country", "city"
        ];
        if (alphaFields.includes(name)) {
            // Allow letters, spaces, dots, and hyphens for names/locations
            const filteredValue = value.replace(/[^a-zA-Z\s.-]/g, "").toUpperCase();
            setFormData(prev => ({ ...prev, [name]: filteredValue }));
            return;
        }

        // 4. Handle Numeric-only fields (DOB, Age, Postal Code)
        const numericFields = ["dobDay", "dobMonth", "dobYear", "ageYears", "postalCode"];
        if (numericFields.includes(name)) {
            const filteredValue = value.replace(/\D/g, "");

            // Additional constraints for DOB
            if (name === "dobDay" && filteredValue.length > 2) return;
            if (name === "dobMonth" && filteredValue.length > 2) return;
            if (name === "dobYear" && filteredValue.length > 4) return;

            setFormData(prev => ({ ...prev, [name]: filteredValue }));
            return;
        }

        // 5. Handle N/A Checkboxes
        if (name.startsWith("is") && name.endsWith("NA")) {
            const fieldToUpdate = name
                .replace("is", "")
                .replace("NA", "");
            
            // Format for mapping: isHomePhoneNA -> homePhone, isCandidatePhoneNA -> candidatePhone, etc.
            const lowerField = fieldToUpdate.charAt(0).toLowerCase() + fieldToUpdate.slice(1);
            
            setFormData(prev => ({
                ...prev,
                [name]: checked,
                [lowerField]: checked ? (lowerField === "discipline" ? "" : "N/A") : ""
            }));
            return;
        }

        // 6. Default handler for checkboxes, selects, and generic text
        const functionalFields = ["admissionLevel", "admissionSystem", "discipline", "campusId", "gender", "religion"];
        const preserveCase = functionalFields.includes(name) || name.toLowerCase().includes('email');

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (preserveCase ? value : value.toUpperCase())
        }));
    };

    const fetchGuardianData = async (type: "father" | "mother", cnic: string) => {
        if (!cnic || (cnic.length < 15 && !cnic.includes('-'))) return;

        setFetchingCnic(type);
        try {
            const response = await api.get(`/v1/admissions/guardians/by-cnic/${cnic}`);
            if (response.data?.success && response.data.data) {
                const guardian = response.data.data;
                const family = guardian.family;
                
                setFormData(prev => {
                    const updates: any = {};

                    // 1. Populate searched guardian (Father or Mother)
                    if (type === "father") {
                        updates.fatherName = guardian.full_name || prev.fatherName;
                        updates.fatherPhone = guardian.primary_phone || prev.fatherPhone;
                        updates.fatherEmail = guardian.email_address || prev.fatherEmail;
                        updates.fatherFax = guardian.fax_number || prev.fatherFax;
                        updates.fatherWhatsapp = guardian.whatsapp_number || prev.fatherWhatsapp;
                        updates.fatherPhotoUrl = guardian.photo_url || prev.fatherPhotoUrl;
                        updates.fatherAdditionalPhones = (guardian.additional_phones || []).map((p: any) => 
                            typeof p === 'object' ? { id: Math.random().toString(), ...p } : { id: Math.random().toString(), label: 'Other', number: p }
                        );
                    } else {
                        updates.motherName = guardian.full_name || prev.motherName;
                        updates.motherPhone = guardian.primary_phone || prev.motherPhone;
                        updates.motherEmail = guardian.email_address || prev.motherEmail;
                        updates.motherFax = guardian.fax_number || prev.motherFax;
                        updates.motherWhatsapp = guardian.whatsapp_number || prev.motherWhatsapp;
                        updates.motherPhotoUrl = guardian.photo_url || prev.motherPhotoUrl;
                        updates.motherAdditionalPhones = (guardian.additional_phones || []).map((p: any) => 
                            typeof p === 'object' ? { id: Math.random().toString(), ...p } : { id: Math.random().toString(), label: 'Other', number: p }
                        );
                    }

                    // 2. If a family exists, populate Mother/Father and Address
                    if (family) {
                        // Populate other parent automatically as requested (overwrites if present)
                        const otherParentRel = type === "father" ? "Mother" : "Father";
                        const otherParent = family.other_guardians?.[otherParentRel];

                        if (otherParent) {
                            if (type === "father") {
                                updates.motherName = otherParent.full_name || prev.motherName;
                                updates.motherCnic = otherParent.cnic || prev.motherCnic;
                                updates.motherPhone = otherParent.primary_phone || prev.motherPhone;
                                updates.motherEmail = otherParent.email_address || prev.motherEmail;
                                updates.motherWhatsapp = otherParent.whatsapp_number || prev.motherWhatsapp;
                                updates.motherPhotoUrl = otherParent.photo_url || prev.motherPhotoUrl;
                                updates.motherAdditionalPhones = (otherParent.additional_phones || []).map((p: any) => 
                                    typeof p === 'object' ? { id: Math.random().toString(), ...p } : { id: Math.random().toString(), label: 'Other', number: p }
                                );
                            } else {
                                updates.fatherName = otherParent.full_name || prev.fatherName;
                                updates.fatherCnic = otherParent.cnic || prev.fatherCnic;
                                updates.fatherPhone = otherParent.primary_phone || prev.fatherPhone;
                                updates.fatherEmail = otherParent.email_address || prev.fatherEmail;
                                updates.fatherWhatsapp = otherParent.whatsapp_number || prev.fatherWhatsapp;
                                updates.fatherPhotoUrl = otherParent.photo_url || prev.fatherPhotoUrl;
                                updates.fatherAdditionalPhones = (otherParent.additional_phones || []).map((p: any) => 
                                    typeof p === 'object' ? { id: Math.random().toString(), ...p } : { id: Math.random().toString(), label: 'Other', number: p }
                                );
                            }
                        }

                        // 3. Address Population
                        // Prefer separate fields from guardian if they exist
                        const gHouse = guardian.house_appt_number || guardian.house_appt_name;
                        if (gHouse) {
                            updates.houseNo = gHouse;
                            updates.areaBlock = guardian.area_block || prev.areaBlock;
                            updates.city = guardian.city || prev.city;
                            updates.province = guardian.province || prev.province;
                            updates.country = guardian.country || prev.country;
                            updates.postalCode = guardian.postal_code || prev.postalCode;
                        } else if (family?.primary_address) {
                            // Fallback: Split concatenated address string by commas
                            const parts = family.primary_address.split(',').map((s: string) => s.trim());
                            if (parts.length > 0) updates.houseNo = parts[0];
                            if (parts.length > 1) updates.areaBlock = parts[1];
                            if (parts.length > 2) updates.city = parts[2];
                            if (parts.length > 3) updates.province = parts[3];
                            if (parts.length > 4) updates.country = parts[4];
                            if (parts.length > 5) updates.postalCode = parts[5];
                        }

                        if (family?.home_phone) {
                            updates.homePhone = family.home_phone;
                        }
                    }

                    return { ...prev, ...updates };
                });
            }
        } catch (error) {
            console.log(`No existing guardian found for CNIC. Proceeding normally.`);
        } finally {
            setFetchingCnic(null);
        }
    };

    const addPreviousSchool = () => {
        setFormData(prev => ({
            ...prev,
            previousSchools: [...prev.previousSchools, { id: Date.now(), name: "", location: "", classStudiedFrom: "", classStudiedTo: "", reasonForLeaving: "" }]
        }));
    };

    const handleSchoolChange = (id: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            previousSchools: prev.previousSchools.map(school =>
                school.id === id ? { ...school, [field]: value } : school
            )
        }));
    };

    const removePreviousSchool = (id: number) => {
        if (formData.previousSchools.length > 1) {
            setFormData(prev => ({
                ...prev,
                previousSchools: prev.previousSchools.filter(school => school.id !== id)
            }));
        }
    };

    const addFlag = () => {
        setFormData(prev => ({
            ...prev,
            flags: [...prev.flags, { id: Date.now().toString(), reminderDate: "", description: "" }]
        }));
    };

    const removeFlag = (id: string) => {
        setFormData(prev => ({
            ...prev,
            flags: prev.flags.filter(f => f.id !== id)
        }));
    };

    const handleFlagChange = (id: string, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            flags: prev.flags.map(f => f.id === id ? { ...f, [field]: value } : f)
        }));
    };

    const handleEmergencyTypeChange = (type: string) => {
        setFormData(prev => {
            const updates: any = { emergencyContactType: type };
            
            if (type === 'father') {
                updates.emergencyContactName = prev.fatherName;
                updates.emergencyContactPhone = prev.fatherPhone;
                updates.emergencyRelationship = 'FATHER';
                updates.isEmergencyContactNameNA = !prev.fatherName && !prev.fatherPhone;
            } else if (type === 'mother') {
                updates.emergencyContactName = prev.motherName;
                updates.emergencyContactPhone = prev.motherPhone;
                updates.emergencyRelationship = 'MOTHER';
                updates.isEmergencyContactNameNA = !prev.motherName && !prev.motherPhone;
            } else if (type === 'other') {
                updates.emergencyContactName = "";
                updates.emergencyContactPhone = "";
                updates.emergencyRelationship = "";
                updates.isEmergencyContactNameNA = false;
            }
            
            return { ...prev, ...updates };
        });
    };

    const addAdditionalPhone = (type: 'father' | 'mother') => {
        const field = type === 'father' ? 'fatherAdditionalPhones' : 'motherAdditionalPhones';
        setFormData(prev => ({
            ...prev,
            [field]: [...(prev as any)[field], { id: Date.now().toString(), label: "SECONDARY", number: "" }]
        }));
    };

    const removeAdditionalPhone = (type: 'father' | 'mother', id: string) => {
        const field = type === 'father' ? 'fatherAdditionalPhones' : 'motherAdditionalPhones';
        setFormData(prev => ({
            ...prev,
            [field]: (prev as any)[field].filter((p: any) => p.id !== id)
        }));
    };

    const handleAdditionalPhoneChange = (type: 'father' | 'mother', id: string, key: 'label' | 'number', value: string) => {
        const field = type === 'father' ? 'fatherAdditionalPhones' : 'motherAdditionalPhones';
        setFormData(prev => ({
            ...prev,
            [field]: (prev as any)[field].map((p: any) => 
                p.id === id ? { ...p, [key]: value.toUpperCase() } : p
            )
        }));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<StudentListItem | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const handleReset = () => {
        // Deep clone the initial state to ensure a clean slate
        setFormData(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
        setCurrentStep(1);
        setSubmitSuccess(null);
        setSubmitError(null);
        setIsProfileModalOpen(false);
    };

    const isStep1Valid = () => {
        const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
        
        const isFatherCnicValid = !formData.fatherCnic || 
                                 formData.isFatherCnicForeign || 
                                 cnicRegex.test(formData.fatherCnic);
                                 
        const isMotherCnicValid = !formData.motherCnic || 
                                 formData.isMotherCnicForeign || 
                                 cnicRegex.test(formData.motherCnic);

        return (
            formData.campusId &&
            formData.candidateName.trim() &&
            isFatherCnicValid &&
            isMotherCnicValid &&
            formData.dobDay && formData.dobMonth && formData.dobYear &&
            formData.admissionSystem &&
            formData.admissionLevel
        );
    };

    const handleNext = () => {
        if (currentStep === 1) {
            if (!formData.campusId) {
                setSubmitError("Please select a Campus from the sidebar before proceeding.");
                return;
            }
            if (!isStep1Valid()) {
                setSubmitError("Please fill in all required fields (Names, CNICs, DOB) correctly before proceeding.");
                return;
            }
        }
        setSubmitError(null);
        setCurrentStep(prev => Math.min(prev + 1, 3));
    };

    const handlePrev = () => {
        setSubmitError(null);
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === 3;

    const handleSubmit = async () => {
        // Validation: Required fields check
        if (!formData.campusId) {
            setSubmitError("Please select a Campus before submitting.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        // Build ISO date string from day/month/year fields
        const dob = formData.dobYear && formData.dobMonth && formData.dobDay
            ? `${formData.dobYear}-${String(formData.dobMonth).padStart(2, '0')}-${String(formData.dobDay).padStart(2, '0')}`
            : '';

        // Student Name
        const fullName = formData.candidateName.trim();

        const fatherFullName = formData.fatherName.trim() || 'N/A';

        // Mother full_name
        const motherFullName = formData.motherName.trim() || 'N/A';

        // Map admissionSystem to enum
        const academicSystem = formData.admissionSystem === 'cambridge' ? 'Cambridge' : 'Secondary';

        const payload = {
            full_name: fullName,
            dob,
            gender: formData.gender || 'Male',
            nationality: formData.nationalityPakistani ? 'Pakistani' : formData.nationalityOther || 'Pakistani',
            religion: formData.religion || undefined,
            country: formData.birthCountry || undefined,
            province: formData.birthProvince || undefined,
            city: formData.birthCity || undefined,
            identification_marks: formData.identificationMarks || undefined,
            primary_phone: formData.candidatePhone || undefined,
            email: formData.candidateEmail || undefined,
            father: {
                full_name: fatherFullName,
                cnic: formData.fatherCnic || undefined,
                primary_phone_country_code: formData.fatherPrimaryPhoneCountryCode || "+92",
                primary_phone: formData.fatherPhone || undefined,
                email_address: formData.fatherEmail || undefined,
                house_appt_name: formData.houseNo || undefined,
                area_block: formData.areaBlock || undefined,
                city: formData.city || undefined,
                province: formData.province || undefined,
                country: formData.country || undefined,
                postal_code: formData.postalCode || undefined,
                fax_number: formData.fatherFax || undefined,
                whatsapp_number: formData.isFatherWhatsapp ? formData.fatherPhone : formData.fatherWhatsapp || undefined,
                additional_phones: formData.fatherAdditionalPhones
                    .filter(p => p.number.trim())
                    .map(p => ({ label: p.label, number: p.number })),
            },
            mother: {
                full_name: motherFullName,
                cnic: formData.motherCnic || undefined,
                primary_phone_country_code: formData.motherPrimaryPhoneCountryCode || "+92",
                primary_phone: formData.motherPhone || undefined,
                email_address: formData.motherEmail || undefined,
                fax_number: formData.motherFax || undefined,
                whatsapp_number: formData.isMotherWhatsapp ? formData.motherPhone : formData.motherWhatsapp || undefined,
                additional_phones: formData.motherAdditionalPhones
                    .filter(p => p.number.trim())
                    .map(p => ({ label: p.label, number: p.number })),
            },
            home_phone: formData.homePhone || undefined,
            emergency_contact: formData.emergencyContactName
                ? {
                    full_name: formData.emergencyContactName,
                    primary_phone_country_code: formData.emergencyPrimaryPhoneCountryCode || "+92",
                    primary_phone: formData.emergencyContactPhone || '0000-0000000',
                    relationship: formData.emergencyRelationship || 'Guardian',
                    role: formData.emergencyContactType,
                }
                : undefined,
            admission: {
                academic_system: academicSystem,
                requested_grade: GRADE_NAME_TO_CODE[formData.admissionLevel] || formData.admissionLevel || 'N/A',
                academic_year: academicYear,
                discipline: formData.isDisciplineNA ? null : (formData.discipline || undefined),
                campus_id: formData.campusId ? parseInt(formData.campusId) : undefined,
            },
            flags: formData.flags
                .filter(f => f.description.trim())
                .map(f => ({
                    description: f.description,
                    reminder_date: f.reminderDate || undefined
                })),
            previous_schools: formData.previousSchools
                .filter(s => s.name.trim())
                .map(s => ({
                    school_name: s.name,
                    location: s.location || undefined,
                    class_studied_from: s.classStudiedFrom || undefined,
                    class_studied_to: s.classStudiedTo || undefined,
                    reason_for_leaving: s.reasonForLeaving || undefined,
                })),
        };

        try {
            const { data } = await api.post<any>(
                '/v1/admissions/register',
                payload
            );
            
            const rawStudent = data.data;

            // -- NEW: UPLOAD STAGED PHOTOS (SEQUENTIAL TO PREVENT DB OVERLOAD) --
            try {
                // 1. Candidate Photo
                if (formData.photographFile) {
                    const candForm = new FormData();
                    candForm.append("file", formData.photographFile);
                    await api.post(`/v1/media/student/${rawStudent.cc}/photo/standard`, candForm, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                }

                // Identify Father & Mother from the response
                const fatherId = rawStudent.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.id;
                const motherId = rawStudent.student_guardians?.find((sg: any) => sg.relationship === 'Mother')?.guardians?.id;

                // 2. Father Photo
                if (formData.fatherPhotoFile && fatherId) {
                    const fForm = new FormData();
                    fForm.append("file", formData.fatherPhotoFile);
                    await api.post(`/v1/media/guardian/${fatherId}/photo`, fForm, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                }

                // 3. Mother Photo
                if (formData.motherPhotoFile && motherId) {
                    const mForm = new FormData();
                    mForm.append("file", formData.motherPhotoFile);
                    await api.post(`/v1/media/guardian/${motherId}/photo`, mForm, {
                        headers: { "Content-Type": "multipart/form-data" }
                    });
                }
            } catch (uploadErr) {
                console.error("Failed to upload some photos:", uploadErr);
                // We don't block the UI here, as the student is already created.
            }

            const primaryGuardian = rawStudent.student_guardians?.find((sg: any) => sg.is_primary_contact)?.guardians;
            const latestAdmission = rawStudent.student_admissions?.[0];

            const mappedStudent: StudentListItem = {
                id: rawStudent.cc || rawStudent.id || 0,
                cc: rawStudent.cc || rawStudent.id || 0,
                student_full_name: rawStudent.full_name,
                gr_number: rawStudent.gr_number,
                cc_number: rawStudent.cc,
                campus: rawStudent.campuses?.campus_name || "N/A",
                grade_and_section: latestAdmission ? `${latestAdmission.requested_grade}` : null,
                primary_guardian_name: primaryGuardian?.full_name,
                whatsapp_number: primaryGuardian?.whatsapp_number || primaryGuardian?.primary_phone,
                enrollment_status: rawStudent.status,
                financial_status_badge: 'Cleared',
                family_id: rawStudent.families?.id,
                household_name: rawStudent.families?.household_name,
                home_phone: rawStudent.families?.home_phone || rawStudent.home_phone,
                total_outstanding_balance: 0,
                advance_credit_balance: 0,
                primary_guardian_cnic: primaryGuardian?.cnic,
                date_of_birth: rawStudent.dob,
                gender: rawStudent.gender,
                registration_number: rawStudent.cc,
                date_of_admission: rawStudent.created_at,
                house_and_color: null,
                residential_address: rawStudent.families?.primary_address || primaryGuardian?.house_appt_name,
                father_name: rawStudent.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.full_name,
                class_id: rawStudent.class_id,
                siblings: rawStudent.families?.students
                    ?.filter((s: any) => s.cc !== rawStudent.cc)
                    ?.map((s: any) => ({
                        id: s.cc,
                        full_name: s.full_name,
                        cc_number: s.cc,
                        grade: s.student_admissions?.[0]?.requested_grade,
                        father_name: s.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.full_name,
                    })),
            };

            setSubmitSuccess(mappedStudent);
            setIsProfileModalOpen(true);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string | string[]; statusCode?: number } } };
            const raw = axiosErr?.response?.data?.message;
            const msg = Array.isArray(raw)
                ? raw.join('; ')
                : (raw ?? 'Network error. Please check your connection and try again.');
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMetadataLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Initializing form data...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row max-w-5xl mx-auto">

            {/* Left Sidebar - Administrative Data */}
            <div className="w-full md:w-64 bg-zinc-50 dark:bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-6 flex-shrink-0">
                <div className="flex flex-col items-center justify-center mb-8 gap-3">
                    <Image src={LogoImage} alt="TAFSync Logo" width={80} height={80} className="object-contain" priority unoptimized />
                    <h2 className="text-xl font-bold tracking-tight text-primary">TAFSync</h2>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Office Records</h3>
                    <div>
                        <label className="block text-[10px] font-black text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-widest">Campus</label>
                        <select name="campusId" value={formData.campusId || ""} onChange={handleInputChange} className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white dark:bg-zinc-950">
                            <option value="">Select Campus...</option>
                            {campuses.map(campus => (
                                <option key={campus.id} value={campus.id}>{campus.campus_name} ({campus.campus_code})</option>
                            ))}
                        </select>
                    </div>


                </div>

                <div className="mt-8 space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Photographs</h3>
                    <div className="flex flex-col gap-3">
                        <RegistrationPhotoBox 
                            label='Candidate (1.5" x 2") <br /> Light Blue BG'
                            file={formData.photographFile}
                            onChange={(f) => setFormData(prev => ({ ...prev, photographFile: f }))}
                            className="h-28 w-full"
                        />
                        <div className="flex gap-2">
                            <RegistrationPhotoBox 
                                label="Father"
                                file={formData.fatherPhotoFile}
                                existingUrl={formData.fatherPhotoUrl}
                                onChange={(f) => setFormData(prev => ({ ...prev, fatherPhotoFile: f }))}
                                className="h-20 w-1/2"
                            />
                            <RegistrationPhotoBox 
                                label="Mother"
                                file={formData.motherPhotoFile}
                                existingUrl={formData.motherPhotoUrl}
                                onChange={(f) => setFormData(prev => ({ ...prev, motherPhotoFile: f }))}
                                className="h-20 w-1/2"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Form Area */}
            <div className="flex-1 flex flex-col">

                {/* Wizard Header Sequence */}
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Application for Registration (FORM #1)</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Page {currentStep} of 3 — {currentStep === 1 ? 'Personal Data & Academic Target' : currentStep === 2 ? 'Contacts & Signatures' : 'Office Use Only'}
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center space-x-2">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className={`h-2.5 w-10 rounded-full ${step === currentStep ? 'bg-primary' : step < currentStep ? 'bg-primary/40' : 'bg-zinc-200'}`} />
                        ))}
                    </div>
                </div>

                {/* Wizard Body (Scrollable) */}
                <div className="flex-1 p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-900/50 overflow-y-auto min-h-[500px]">

                    {/* -- PAGE 1: PERSONAL DATA & TARGETS -- */}
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* -- MULTI-FLAG SECTION -- */}
                            <section className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 mb-6 shadow-sm">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 px-2 py-1 bg-zinc-50 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
                                            <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest select-none">Record Flags / Reminders</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={addFlag}
                                            className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add Flag
                                        </button>
                                    </div>

                                    {formData.flags.length > 0 && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {formData.flags.map((flag) => (
                                                <div key={flag.id} className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-center bg-zinc-50/50 dark:bg-zinc-900/50 p-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex items-center gap-2 min-w-[150px]">
                                                        <label className="shrink-0 text-[10px] font-black uppercase text-zinc-400">Remind:</label>
                                                        <input 
                                                            type="date" 
                                                            value={flag.reminderDate || ""} 
                                                            onChange={(e) => handleFlagChange(flag.id, 'reminderDate', e.target.value)} 
                                                            className="flex-1 px-2 py-1 bg-transparent border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold outline-none focus:border-primary transition-colors" 
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="shrink-0 text-[10px] font-black uppercase text-zinc-400">Note:</label>
                                                        <input 
                                                            type="text"
                                                            value={flag.description || ""} 
                                                            onChange={(e) => handleFlagChange(flag.id, 'description', e.target.value)} 
                                                            placeholder="Describe the flag..." 
                                                            className="flex-1 px-2 py-1 bg-transparent border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold outline-none focus:border-primary transition-colors uppercase"
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeFlag(flag.id)}
                                                        className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {formData.flags.length === 0 && (
                                        <p className="text-[10px] text-zinc-400 italic px-2">No flags added. Click &quot;Add Flag&quot; to record important notes.</p>
                                    )}
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">1. Personal Data</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Candidate&apos;s Full Name (In Block Letters Only)</label>
                                        <input type="text" name="candidateName" value={formData.candidateName || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Father&apos;s CNIC (Optional)</label>
                                            <div className="flex items-center gap-1.5">
                                                <input type="checkbox" name="isFatherCnicForeign" id="fatherCnicForeign" checked={formData.isFatherCnicForeign} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                <label htmlFor="fatherCnicForeign" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Foreign / Passport</label>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input type="text" name="fatherCnic" value={formData.fatherCnic || ""} onChange={handleInputChange} onBlur={(e) => !formData.isFatherCnicForeign && fetchGuardianData("father", e.target.value)} placeholder={formData.isFatherCnicForeign ? "PASSPORT / ID #" : "XXXXX-XXXXXXX-X"} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-3" />
                                            {fetchingCnic === "father" && (
                                                <div className="absolute right-3 top-2.5">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                                </div>
                                            )}
                                        </div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Father&apos;s Name (Optional)</label>
                                        <input type="text" name="fatherName" value={formData.fatherName || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Mother&apos;s CNIC (Optional)</label>
                                            <div className="flex items-center gap-1.5">
                                                <input type="checkbox" name="isMotherCnicForeign" id="motherCnicForeign" checked={formData.isMotherCnicForeign} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                <label htmlFor="motherCnicForeign" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Foreign / Passport</label>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input type="text" name="motherCnic" value={formData.motherCnic || ""} onChange={handleInputChange} onBlur={(e) => !formData.isMotherCnicForeign && fetchGuardianData("mother", e.target.value)} placeholder={formData.isMotherCnicForeign ? "PASSPORT / ID #" : "XXXXX-XXXXXXX-X"} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-3" />
                                            {fetchingCnic === "mother" && (
                                                <div className="absolute right-3 top-2.5">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                                </div>
                                            )}
                                        </div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Mother&apos;s Name (Optional)</label>
                                        <input type="text" name="motherName" value={formData.motherName || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Date of Birth</label>
                                        <div className="flex gap-2">
                                            <input type="text" name="dobDay" value={formData.dobDay || ""} onChange={handleInputChange} placeholder="DD" className="w-1/3 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-center" />
                                            <input type="text" name="dobMonth" value={formData.dobMonth || ""} onChange={handleInputChange} placeholder="MM" className="w-1/3 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-center" />
                                            <input type="text" name="dobYear" value={formData.dobYear || ""} onChange={handleInputChange} placeholder="YYYY" className="w-1/3 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-center" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Age at time of registration</label>
                                        <div className="flex gap-2">
                                            <div className="relative w-full"><input type="text" name="ageYears" value={formData.ageYears || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg pr-8" /><span className="absolute right-3 top-2.5 text-xs text-zinc-400 uppercase">Yrs</span></div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Nationality</label>
                                            <select name="nationalityPakistani" value={String(formData.nationalityPakistani)} onChange={(e) => setFormData(prev => ({ ...prev, nationalityPakistani: e.target.value === 'true' }))} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 uppercase text-xs font-bold">
                                                <option value="true">Pakistani</option>
                                                <option value="false">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Gender</label>
                                            <select name="gender" value={formData.gender || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 uppercase text-xs font-bold">
                                                <option value="">Select...</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Religion</label>
                                            <select name="religion" value={formData.religion || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-950 uppercase text-xs font-bold">
                                                <option value="">Select...</option>
                                                <option value="Muslim">Muslim</option><option value="Christian">Christian</option><option value="Hindu">Hindu</option><option value="Others">Others</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Place of Birth: Country</label>
                                            <input type="text" name="birthCountry" value={formData.birthCountry || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Province</label>
                                            <input type="text" name="birthProvince" value={formData.birthProvince || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">City</label>
                                            <input type="text" name="birthCity" value={formData.birthCity || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-1.5 ml-1">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Identification Mark(s)</label>
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="checkbox" 
                                                    name="isIdentificationMarksNA" 
                                                    id="na-id-marks" 
                                                    checked={formData.isIdentificationMarksNA} 
                                                    onChange={handleInputChange} 
                                                    className="h-3 w-3 text-primary rounded" 
                                                />
                                                <label htmlFor="na-id-marks" className="text-[10px] font-bold uppercase text-zinc-400 cursor-pointer">N/A</label>
                                            </div>
                                        </div>
                                        <input type="text" name="identificationMarks" value={formData.identificationMarks || ""} onChange={handleInputChange} disabled={formData.isIdentificationMarksNA} className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:cursor-not-allowed ${formData.isIdentificationMarksNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Previous Schooling */}
                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 mt-8 flex justify-between items-end">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">2. Previous Schooling Details</h3>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight italic mb-1">Starting with the last school attended</span>
                                </div>
                                <div className="space-y-4">
                                    {formData.previousSchools.map((school, index) => (
                                        <div key={school.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 relative group">
                                            <div className="absolute -left-2.5 top-4 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{index + 1}</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Name of School</label>
                                                    <input type="text" value={school.name || ""} onChange={(e) => handleSchoolChange(school.id, 'name', e.target.value.toUpperCase())} className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md uppercase" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Location</label>
                                                    <input type="text" value={school.location || ""} onChange={(e) => handleSchoolChange(school.id, 'location', e.target.value.toUpperCase())} className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md uppercase" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">From Class</label>
                                                        <input type="text" placeholder="E.G. NURSERY" value={school.classStudiedFrom || ""} onChange={(e) => handleSchoolChange(school.id, 'classStudiedFrom', e.target.value.toUpperCase())} className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md uppercase" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">To Class</label>
                                                        <input type="text" placeholder="E.G. PREP" value={school.classStudiedTo || ""} onChange={(e) => handleSchoolChange(school.id, 'classStudiedTo', e.target.value.toUpperCase())} className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md uppercase" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Reason for Leaving</label>
                                                        <input type="text" value={school.reasonForLeaving || ""} onChange={(e) => handleSchoolChange(school.id, 'reasonForLeaving', e.target.value.toUpperCase())} className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md uppercase" />
                                                    </div>
                                                    <button type="button" onClick={() => removePreviousSchool(school.id)} disabled={formData.previousSchools.length === 1} className="py-1.5 px-3 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors">Del</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addPreviousSchool} className="text-sm font-medium text-primary hover:text-primary/80">+ Add another school</button>
                                </div>
                            </section>

                            {/* Section: Target System */}
                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 mt-8 flex justify-between items-center">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">3. Admission Required In</h3>
                                    <div className="flex flex-col items-end">
                                        <div className="relative" ref={yearDropdownRef}>
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-2">Academic Year</label>
                                            <button
                                                onClick={() => setShowYearDropdown(!showYearDropdown)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all border-primary/20 shadow-sm"
                                            >
                                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                                <span className="text-zinc-900 dark:text-zinc-100">{academicYear}</span>
                                            </button>

                                            {showYearDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[240px]">
                                                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                                                        <button
                                                            onClick={() => setBaseYear(prev => prev - 12)}
                                                            className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
                                                        >
                                                            <ChevronLeft className="h-3.5 w-3.5 text-zinc-500" />
                                                        </button>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                            {baseYear} - {baseYear + 11}
                                                        </span>
                                                        <button
                                                            onClick={() => setBaseYear(prev => prev + 12)}
                                                            className="p-1 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
                                                        >
                                                            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                                                        </button>
                                                    </div>
                                                    <div className="p-2 grid grid-cols-2 gap-1">
                                                        {Array.from({ length: 12 }, (_, i) => {
                                                            const start = baseYear + i;
                                                            const year = `${start}-${start + 1}`;
                                                            return (
                                                                <button
                                                                    key={year}
                                                                    onClick={() => {
                                                                        setAcademicYear(year);
                                                                        setShowYearDropdown(false);
                                                                    }}
                                                                    className={`px-2 py-2 text-center text-[11px] font-bold rounded-lg transition-all border ${academicYear === year ? "bg-primary text-white border-primary shadow-sm" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent"}`}
                                                                >
                                                                    {year}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                    {/* O-Level Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === "cambridge" ? 'border-primary/50 bg-primary/5' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'}`}>
                                        <div className="flex items-center mb-4">
                                            <input type="radio" name="admissionSystem" value="cambridge" id="sys-cambridge-reg" checked={formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="h-4 w-4 text-primary focus:ring-primary border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                                            <label htmlFor="sys-cambridge-reg" className="ml-2 block font-semibold text-primary cursor-pointer">Cambridge GCE O&apos; Level System</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'cambridge' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['Pre-Nursery', 'Nursery', 'K.G.', 'JR-I', 'JR-II', 'JR-III', 'JR-IV', 'JR-V', 'SR-I', 'SR-II', 'SR-III', 'O-I', 'O-II', 'O-III'].map(cls => (
                                                <div key={cls} className="flex items-center gap-2">
                                                    <input type="radio" name="admissionLevel" value={cls} id={`cls-cam-${cls}`} checked={formData.admissionLevel === cls && formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="h-3.5 w-3.5 text-primary focus:ring-primary border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                                                    <label htmlFor={`cls-cam-${cls}`} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Secondary Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === "secondary" ? 'border-secondary/50 bg-secondary/5' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'}`}>
                                        <div className="flex items-center mb-4">
                                            <input type="radio" name="admissionSystem" value="secondary" id="sys-secondary-reg" checked={formData.admissionSystem === "secondary"} onChange={handleInputChange} className="h-4 w-4 text-secondary focus:ring-secondary border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                                            <label htmlFor="sys-secondary-reg" className="ml-2 block font-semibold text-secondary cursor-pointer">Secondary System of Studies</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'secondary' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['VI', 'VII', 'VIII', 'IX', 'X'].map(cls => (
                                                <div key={cls} className="flex items-center gap-2">
                                                    <input type="radio" name="admissionLevel" value={cls} id={`cls-sec-${cls}`} checked={formData.admissionLevel === cls && formData.admissionSystem === "secondary"} onChange={handleInputChange} className="h-3.5 w-3.5 text-secondary focus:ring-secondary border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                                                    <label htmlFor={`cls-sec-${cls}`} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Discipline Dropdown (Conditional) */}
                                    {formData.admissionLevel && (['VI', 'VII', 'VIII', 'IX', 'X', 'O-I', 'O-II', 'O-III'].includes(formData.admissionLevel)) && (
                                        <div className="md:col-span-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                <div className="flex-shrink-0 flex items-center justify-between w-full md:w-auto gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-8 bg-primary rounded-full" />
                                                        <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">Academic Discipline</label>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <input 
                                                            type="checkbox" 
                                                            name="isDisciplineNA" 
                                                            id="na-discipline" 
                                                            checked={formData.isDisciplineNA} 
                                                            onChange={handleInputChange} 
                                                            className="h-3.5 w-3.5 text-primary rounded" 
                                                        />
                                                        <label htmlFor="na-discipline" className="text-[10px] font-bold uppercase text-zinc-400 cursor-pointer">N/A</label>
                                                    </div>
                                                </div>
                                                <div className={`flex-1 ${formData.isDisciplineNA ? 'opacity-50' : ''}`}>
                                                    <select 
                                                        name="discipline" 
                                                        value={formData.discipline || ""} 
                                                        onChange={handleInputChange}
                                                        disabled={formData.isDisciplineNA}
                                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:cursor-not-allowed"
                                                    >
                                                        <option value="">Select Discipline (Optional)...</option>
                                                        {formData.admissionSystem === "cambridge" ? (
                                                            <>
                                                                <option value="Pre-Medical">Pre-Medical</option>
                                                                <option value="Pre-Engineering">Pre-Engineering</option>
                                                                <option value="Commerce">Commerce</option>
                                                                <option value="Computer Science">Computer Science</option>
                                                            </>
                                                        ) : formData.admissionSystem === "secondary" ? (
                                                            <>
                                                                <option value="Pre-Medical">Pre-Medical</option>
                                                                <option value="Pre-Engineering">Pre-Engineering</option>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <option value="Pre-Medical">Pre-Medical</option>
                                                                <option value="Pre-Engineering">Pre-Engineering</option>
                                                                <option value="Pre-Commerce">Pre-Commerce</option>
                                                                <option value="Computer Science">Computer Science</option>
                                                                <option value="Humanities">Humanities</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>
                    )}

                    {/* -- PAGE 2: MAILING & CONTACTS & SIGNATURES -- */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">4. Mailing Address</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">House / Apartment Name and No.</label>
                                        <input type="text" name="houseNo" value={formData.houseNo || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase text-sm font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Area and Block # (If any)</label>
                                        <input type="text" name="areaBlock" value={formData.areaBlock || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">City</label><input type="text" name="city" value={formData.city || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" /></div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Postal Code</label>
                                                <div className="flex items-center gap-1.5">
                                                    <input 
                                                        type="checkbox" 
                                                        name="isPostalCodeNA" 
                                                        id="na-postal-code" 
                                                        checked={formData.isPostalCodeNA} 
                                                        onChange={handleInputChange} 
                                                        className="h-3.5 w-3.5 text-primary rounded" 
                                                    />
                                                    <label htmlFor="na-postal-code" className="text-[10px] font-bold uppercase text-zinc-400 cursor-pointer">N/A</label>
                                                </div>
                                            </div>
                                            <input 
                                                type="text" 
                                                name="postalCode" 
                                                value={formData.postalCode || ""} 
                                                onChange={handleInputChange} 
                                                disabled={formData.isPostalCodeNA}
                                                className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary ${formData.isPostalCodeNA ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Province</label><input type="text" name="province" value={formData.province || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" /></div>
                                        <div><label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Country</label><input type="text" name="country" value={formData.country || ""} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg uppercase text-sm font-medium" /></div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Home Phone #</label>
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="checkbox" 
                                                    name="isHomePhoneNA" 
                                                    id="na-home-phone" 
                                                    checked={formData.isHomePhoneNA} 
                                                    onChange={handleInputChange} 
                                                    className="h-3.5 w-3.5 text-primary rounded" 
                                                />
                                                <label htmlFor="na-home-phone" className="text-[10px] font-bold uppercase text-zinc-400 cursor-pointer">N/A</label>
                                            </div>
                                        </div>
                                        <div className={`flex border border-zinc-300 dark:border-zinc-700 rounded-lg focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${formData.isHomePhoneNA ? 'opacity-50' : ''}`}>
                                            <input type="text" name="homePhoneCountryCode" value={formData.homePhoneCountryCode || ""} onChange={handleInputChange} placeholder="+92" disabled={formData.isHomePhoneNA} className="w-16 px-2 py-2 border-0 rounded-l-lg bg-zinc-50 dark:bg-zinc-900 outline-none text-sm disabled:cursor-not-allowed" />
                                            <input type="text" name="homePhone" value={formData.homePhone || ""} onChange={handleInputChange} disabled={formData.isHomePhoneNA} className="flex-1 min-w-0 px-3 py-2 border-0 rounded-r-lg outline-none disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Contact Details Matrix</h3>
                                </div>
                                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3 font-black tracking-widest">Contact Person</th>
                                                <th className="px-4 py-3 font-black tracking-widest w-1/4">Cellular Phone #</th>
                                                <th className="px-4 py-3 font-black tracking-widest w-1/3">E-mail Address</th>
                                                <th className="px-4 py-3 font-black tracking-widest w-1/5">Fax #</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-zinc-100">
                                                <td className="px-4 py-3 font-black text-zinc-700 dark:text-zinc-300 uppercase text-[11px] tracking-tight">Candidate</td>
                                                <td className="px-2 py-2">
                                                    <div className={`flex border border-zinc-200 dark:border-zinc-800 rounded focus-within:ring-1 focus-within:ring-primary focus-within:border-primary ${formData.isCandidatePhoneNA ? 'opacity-50 bg-zinc-50' : ''}`}>
                                                        <span className="flex items-center px-2 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 whitespace-nowrap">+92</span>
                                                        <input type="text" name="candidatePhone" value={formData.candidatePhone || ""} onChange={handleInputChange} disabled={formData.isCandidatePhoneNA} placeholder="3XXXXXXXXX" className="w-full px-2 py-1.5 border-0 rounded-r text-sm outline-none disabled:cursor-not-allowed" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isCandidatePhoneNA" id="na-cand-phone" checked={formData.isCandidatePhoneNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-cand-phone" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="email" name="candidateEmail" value={formData.candidateEmail || ""} onChange={handleInputChange} disabled={formData.isCandidateEmailNA} className={`w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded text-sm outline-none disabled:cursor-not-allowed ${formData.isCandidateEmailNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isCandidateEmailNA" id="na-cand-email" checked={formData.isCandidateEmailNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-cand-email" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2"><input type="text" disabled className="w-full px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 rounded text-sm cursor-not-allowed text-center" placeholder="N/A" /></td>
                                            </tr>
                                            <tr className="border-b border-zinc-100">
                                                <td className="px-4 py-3 font-black text-zinc-700 dark:text-zinc-300 uppercase text-[11px] tracking-tight">Father</td>
                                                <td className="px-2 py-2">
                                                    <div className="flex flex-col gap-2">
                                                        <div className={`flex border border-zinc-200 dark:border-zinc-800 rounded focus-within:ring-1 focus-within:ring-primary focus-within:border-primary ${formData.isFatherPhoneNA ? 'opacity-50 bg-zinc-50' : ''}`}>
                                                            {formData.isFatherPhoneForeign ? (
                                                                <input type="text" name="fatherPrimaryPhoneCountryCode" value={formData.fatherPrimaryPhoneCountryCode || ""} onChange={handleInputChange} className="w-12 px-1 text-center bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 outline-none" />
                                                            ) : (
                                                                <span className="flex items-center px-2 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 whitespace-nowrap">+92</span>
                                                            )}
                                                            <input type="text" name="fatherPhone" value={formData.fatherPhone || ""} onChange={handleInputChange} disabled={formData.isFatherPhoneNA} placeholder={formData.isFatherPhoneForeign ? "Foreign Number" : "3XXXXXXXXX"} className="w-full px-2 py-1.5 border-0 rounded-r text-sm outline-none disabled:cursor-not-allowed" />
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <input type="checkbox" name="isFatherPhoneForeign" id="fatherPhoneForeign" checked={formData.isFatherPhoneForeign} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                                    <label htmlFor="fatherPhoneForeign" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Foreign</label>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input type="checkbox" name="isFatherWhatsapp" id="wa-father" checked={formData.isFatherWhatsapp} onChange={handleInputChange} disabled={formData.isFatherPhoneNA} className="h-3.5 w-3.5 text-emerald-600 rounded disabled:opacity-50" />
                                                                    <label htmlFor="wa-father" className={`text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1 ${formData.isFatherPhoneNA ? 'opacity-50' : ''}`}><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> WhatsApp</label>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mr-2">
                                                                <input type="checkbox" name="isFatherPhoneNA" id="na-father-phone" checked={formData.isFatherPhoneNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                                <label htmlFor="na-father-phone" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">N/A</label>
                                                            </div>
                                                        </div>
                                                        {!formData.isFatherWhatsapp && !formData.isFatherPhoneNA && (
                                                            <div className="flex border border-emerald-200 rounded animate-in slide-in-from-top-1 duration-200">
                                                                <span className="flex items-center px-2 bg-emerald-50 border-r border-emerald-200 text-xs font-semibold text-emerald-700">+92</span>
                                                                <input type="text" name="fatherWhatsapp" value={formData.fatherWhatsapp || ""} onChange={handleInputChange} placeholder="WA Number" className="w-full px-2 py-1.5 border-0 rounded-r text-sm outline-none bg-emerald-50/30" />
                                                            </div>
                                                        )}
                                                        {/* Father Additional Phones */}
                                                        <div className="mt-2 space-y-2">
                                                            {formData.fatherAdditionalPhones.map((phone) => (
                                                                <div key={phone.id} className="flex gap-1 animate-in slide-in-from-right-2 duration-200">
                                                                    <input 
                                                                        type="text" 
                                                                        value={phone.label} 
                                                                        onChange={(e) => handleAdditionalPhoneChange('father', phone.id, 'label', e.target.value)}
                                                                        placeholder="LABEL"
                                                                        className="w-16 px-1 py-1 text-[9px] font-black border border-zinc-200 dark:border-zinc-800 rounded uppercase outline-none focus:border-primary"
                                                                    />
                                                                    <div className="flex flex-1 border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
                                                                        <span className="flex items-center px-1 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-[9px] font-semibold text-zinc-500">+92</span>
                                                                        <input 
                                                                            type="text" 
                                                                            value={phone.number} 
                                                                            onChange={(e) => handleAdditionalPhoneChange('father', phone.id, 'number', e.target.value)}
                                                                            placeholder="Number"
                                                                            className="w-full px-2 py-1 text-xs outline-none"
                                                                        />
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => removeAdditionalPhone('father', phone.id)}
                                                                            className="px-1.5 bg-zinc-50 hover:bg-red-50 hover:text-red-500 border-l border-zinc-200 transition-colors"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button 
                                                                type="button" 
                                                                onClick={() => addAdditionalPhone('father')}
                                                                className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 transition-colors mt-1"
                                                            >
                                                                <Plus className="h-2.5 w-2.5" /> Additional Number
                                                            </button>
                                                         </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="email" name="fatherEmail" value={formData.fatherEmail || ""} onChange={handleInputChange} disabled={formData.isFatherEmailNA} className={`w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded text-sm outline-none disabled:cursor-not-allowed ${formData.isFatherEmailNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isFatherEmailNA" id="na-father-email" checked={formData.isFatherEmailNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-father-email" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="text" name="fatherFax" value={formData.fatherFax || ""} onChange={handleInputChange} disabled={formData.isFatherFaxNA} className={`w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded text-sm outline-none disabled:cursor-not-allowed ${formData.isFatherFaxNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isFatherFaxNA" id="na-father-fax" checked={formData.isFatherFaxNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-father-fax" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-black text-zinc-700 dark:text-zinc-300 uppercase text-[11px] tracking-tight">Mother</td>
                                                <td className="px-2 py-2">
                                                    <div className="flex flex-col gap-2">
                                                        <div className={`flex border border-zinc-200 dark:border-zinc-800 rounded focus-within:ring-1 focus-within:ring-primary focus-within:border-primary ${formData.isMotherPhoneNA ? 'opacity-50 bg-zinc-50' : ''}`}>
                                                            {formData.isMotherPhoneForeign ? (
                                                                <input type="text" name="motherPrimaryPhoneCountryCode" value={formData.motherPrimaryPhoneCountryCode || ""} onChange={handleInputChange} className="w-12 px-1 text-center bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 outline-none" />
                                                            ) : (
                                                                <span className="flex items-center px-2 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 whitespace-nowrap">+92</span>
                                                            )}
                                                            <input type="text" name="motherPhone" value={formData.motherPhone || ""} onChange={handleInputChange} disabled={formData.isMotherPhoneNA} placeholder={formData.isMotherPhoneForeign ? "Foreign Number" : "3XXXXXXXXX"} className="w-full px-2 py-1.5 border-0 rounded-r text-sm outline-none disabled:cursor-not-allowed" />
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <input type="checkbox" name="isMotherPhoneForeign" id="motherPhoneForeign" checked={formData.isMotherPhoneForeign} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                                    <label htmlFor="motherPhoneForeign" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Foreign</label>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input type="checkbox" name="isMotherWhatsapp" id="wa-mother" checked={formData.isMotherWhatsapp} onChange={handleInputChange} disabled={formData.isMotherPhoneNA} className="h-3.5 w-3.5 text-emerald-600 rounded disabled:opacity-50" />
                                                                    <label htmlFor="wa-mother" className={`text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1 ${formData.isMotherPhoneNA ? 'opacity-50' : ''}`}><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> WhatsApp</label>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mr-2">
                                                                <input type="checkbox" name="isMotherPhoneNA" id="na-mother-phone" checked={formData.isMotherPhoneNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                                <label htmlFor="na-mother-phone" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">N/A</label>
                                                            </div>
                                                        </div>
                                                        {!formData.isMotherWhatsapp && !formData.isMotherPhoneNA && (
                                                            <div className="flex border border-emerald-200 rounded animate-in slide-in-from-top-1 duration-200">
                                                                <span className="flex items-center px-2 bg-emerald-50 border-r border-emerald-200 text-xs font-semibold text-emerald-700">+92</span>
                                                                <input type="text" name="motherWhatsapp" value={formData.motherWhatsapp || ""} onChange={handleInputChange} placeholder="WA Number" className="w-full px-2 py-1.5 border-0 rounded-r text-sm outline-none bg-emerald-50/30" />
                                                            </div>
                                                        )}

                                                        {/* Mother Additional Phones */}
                                                        <div className="mt-2 space-y-2">
                                                            {formData.motherAdditionalPhones.map((phone) => (
                                                                <div key={phone.id} className="flex gap-1 animate-in slide-in-from-right-2 duration-200">
                                                                    <input 
                                                                        type="text" 
                                                                        value={phone.label} 
                                                                        onChange={(e) => handleAdditionalPhoneChange('mother', phone.id, 'label', e.target.value)}
                                                                        placeholder="LABEL"
                                                                        className="w-16 px-1 py-1 text-[9px] font-black border border-zinc-200 dark:border-zinc-800 rounded uppercase outline-none focus:border-primary"
                                                                    />
                                                                    <div className="flex flex-1 border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
                                                                        <span className="flex items-center px-1 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-[9px] font-semibold text-zinc-500">+92</span>
                                                                        <input 
                                                                            type="text" 
                                                                            value={phone.number} 
                                                                            onChange={(e) => handleAdditionalPhoneChange('mother', phone.id, 'number', e.target.value)}
                                                                            placeholder="Number"
                                                                            className="w-full px-2 py-1 text-xs outline-none"
                                                                        />
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => removeAdditionalPhone('mother', phone.id)}
                                                                            className="px-1.5 bg-zinc-50 hover:bg-red-50 hover:text-red-500 border-l border-zinc-200 transition-colors"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button 
                                                                type="button" 
                                                                onClick={() => addAdditionalPhone('mother')}
                                                                className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 transition-colors mt-1"
                                                            >
                                                                <Plus className="h-2.5 w-2.5" /> Additional Number
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="email" name="motherEmail" value={formData.motherEmail || ""} onChange={handleInputChange} disabled={formData.isMotherEmailNA} className={`w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded text-sm outline-none disabled:cursor-not-allowed ${formData.isMotherEmailNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isMotherEmailNA" id="na-mother-email" checked={formData.isMotherEmailNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-mother-email" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="text" name="motherFax" value={formData.motherFax || ""} onChange={handleInputChange} disabled={formData.isMotherFaxNA} className={`w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded text-sm outline-none disabled:cursor-not-allowed ${formData.isMotherFaxNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                                                        <input type="checkbox" name="isMotherFaxNA" id="na-mother-fax" checked={formData.isMotherFaxNA} onChange={handleInputChange} className="h-3 w-3 text-primary rounded" />
                                                        <label htmlFor="na-mother-fax" className="text-[9px] font-black uppercase text-zinc-400 cursor-pointer">Mark N/A</label>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 mt-8 flex items-center justify-between">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Emergency Contact</h3>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                        {(['father', 'mother', 'other'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => handleEmergencyTypeChange(type)}
                                                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                    formData.emergencyContactType === type 
                                                    ? 'bg-white dark:bg-zinc-950 text-primary shadow-sm' 
                                                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                                    {formData.emergencyContactType === 'other' ? (
                                        <div className="flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="flex-[1.5] w-full">
                                                <div className="flex items-center justify-between mb-1.5 ml-1">
                                                    <label className="block text-[11px] font-black uppercase tracking-wider text-red-900/40">Contact Name</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <input 
                                                            type="checkbox" 
                                                            name="isEmergencyContactNameNA" 
                                                            id="na-emergency-name" 
                                                            checked={formData.isEmergencyContactNameNA} 
                                                            onChange={handleInputChange} 
                                                            className="h-3 w-3 text-red-600 rounded" 
                                                        />
                                                        <label htmlFor="na-emergency-name" className="text-[10px] font-bold uppercase text-red-900/40 cursor-pointer">N/A</label>
                                                    </div>
                                                </div>
                                                <input type="text" name="emergencyContactName" value={formData.emergencyContactName || ""} onChange={handleInputChange} disabled={formData.isEmergencyContactNameNA} placeholder="Full Name" className={`w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-red-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none shadow-sm disabled:cursor-not-allowed ${formData.isEmergencyContactNameNA ? 'opacity-50 bg-zinc-50' : ''}`} />
                                            </div>
                                            <div className="flex-[1.5] w-full">
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-red-900/40 mb-1.5 ml-1">Contact Number</label>
                                                <div className="flex border border-red-200 dark:border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-red-500 bg-white overflow-hidden shadow-sm">
                                                    <input type="text" name="emergencyPrimaryPhoneCountryCode" value={formData.emergencyPrimaryPhoneCountryCode || ""} onChange={handleInputChange} placeholder="+92" className="w-16 px-3 py-3 border-0 bg-red-50/50 dark:bg-zinc-900 outline-none text-xs font-bold border-r border-red-100" />
                                                    <input type="text" name="emergencyContactPhone" value={formData.emergencyContactPhone || ""} onChange={handleInputChange} placeholder="Phone Number" className="flex-1 min-w-0 px-4 py-3 border-0 outline-none text-sm bg-white dark:bg-zinc-950" />
                                                </div>
                                            </div>
                                            <div className="flex-1 w-full">
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-red-900/40 mb-1.5 ml-1">Relationship</label>
                                                <input type="text" name="emergencyRelationship" value={formData.emergencyRelationship || ""} onChange={handleInputChange} placeholder="Relative / Guardian" className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-red-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none shadow-sm" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-2 animate-in fade-in duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                                                    <span className="text-xl font-black text-red-600 uppercase">
                                                        {formData.emergencyContactType === 'father' ? 'F' : 'M'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black uppercase text-red-900/30 tracking-widest">Linked Emergency Contact</p>
                                                    <h4 className="text-sm font-bold text-red-900/80 uppercase">
                                                        {formData.emergencyContactType === 'father' ? 'Father' : 'Mother'}: {formData.emergencyContactName || 'No Name Provided'}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase text-red-900/30 tracking-widest">Contact Phone</p>
                                                <p className="text-sm font-mono font-bold text-red-900/80">{formData.emergencyContactPhone || 'No Phone Registered'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 mt-10">
                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Signatures</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Signatory:</span>
                                            <select className="px-2 py-1 text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-primary w-2/3">
                                                <option>Father</option>
                                                <option>Mother</option>
                                                <option>Guardian</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center bg-white dark:bg-zinc-950 h-32">
                                            <div className="flex-1 w-full border-b border-dashed border-zinc-300 dark:border-zinc-700 flex items-end justify-center pb-2">
                                                <span className="text-zinc-300 italic">Sign here</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-end pb-8">
                                        <input 
                                            type="text" 
                                            placeholder="Day (e.g. Monday)" 
                                            value=""
                                            readOnly
                                            className="h-10 border-b-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent mb-2 outline-none focus:border-primary text-center px-4" 
                                        />
                                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-center uppercase tracking-wider">Day</span>
                                    </div>
                                    <div className="flex flex-col justify-end pb-8">
                                        <input 
                                            type="date" 
                                            value=""
                                            readOnly
                                            className="h-10 border-b-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent mb-2 outline-none focus:border-primary text-center px-4 text-sm" 
                                        />
                                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-center uppercase tracking-wider">Date</span>
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                    {/* -- PAGE 3: OFFICE USE ONLY -- */}
                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center mb-6">
                                <h2 className="text-lg font-bold text-red-700 uppercase tracking-widest">For Office Use Only</h2>
                                <p className="text-sm text-red-600">Do not fill if you are a parent/candidate.</p>
                            </div>

                            <section className="bg-white dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 relative overflow-hidden">
                                {/* Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                                    <span className="text-6xl font-black uppercase text-center transform -rotate-12">Office Use</span>
                                </div>

                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Test Interview Allocation</label>
                                            <div className="flex gap-2">
                                                <input type="text" name="testDay" value={formData.testDay || ""} onChange={handleInputChange} placeholder="Day" className="w-1/3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm" />
                                                <input type="date" name="testDate" value={formData.testDate || ""} onChange={handleInputChange} className="w-1/3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm" />
                                                <input type="time" name="testTime" value={formData.testTime || ""} onChange={handleInputChange} className="w-1/3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Test for Level / Class</label>
                                            <input type="text" name="testLevel" value={formData.testLevel || ""} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm" />
                                        </div>
                                    </div>

                                    <div className="space-y-8 flex flex-col justify-end">
                                        <div className="flex flex-col justify-end pt-2">
                                            <div className="h-10 border-b border-zinc-300 dark:border-zinc-700 bg-transparent mb-2 w-full max-w-[200px]" />
                                            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Admission Registrar</span>
                                        </div>

                                        <div className="flex gap-8 items-end pt-2">
                                            <div className="flex-1">
                                                <div className="h-10 border-b border-zinc-300 dark:border-zinc-700 bg-transparent mb-2 w-full" />
                                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Issuing Authority</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="h-10 border-b border-zinc-300 dark:border-zinc-700 bg-transparent mb-2 w-full" />
                                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Date</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                </div>

                {/* Success / Error Banners */}
                {submitSuccess && (
                    <div className="mx-6 mb-0 mt-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold">Registration submitted successfully!</p>
                                {formData.flags.length > 0 && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-black uppercase tracking-widest rounded-md border border-zinc-200">
                                        Flagged ({formData.flags.length})
                                    </span>
                                )}
                            </div>
                            <p className="text-emerald-700 mt-0.5">CC assigned: <span className="font-mono font-bold text-base">{submitSuccess.gr_number || submitSuccess.cc_number}</span>. The student record is now <span className="font-medium">PENDING</span> review.</p>
                        </div>
                         <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsProfileModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-primary border border-primary/20 rounded-lg text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm active:scale-95 whitespace-nowrap self-center"
                            >
                                <Eye className="h-4 w-4" />
                                View Profile
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-600 border border-zinc-200 rounded-lg text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm active:scale-95 whitespace-nowrap self-center"
                            >
                                Register Another
                            </button>
                            <button
                                onClick={() => {
                                    const matchedClass = classes.find(c =>
                                        c.class_code === formData.admissionLevel ||
                                        c.description === formData.admissionLevel
                                    );
                                    const classId = matchedClass?.id || "";
                                    router.push(`/studentwise-fees?ccNumber=${submitSuccess.cc_number}&classId=${classId}`);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95 whitespace-nowrap self-center"
                            >
                                <CreditCard className="h-4 w-4" />
                                Setup Fee Schedule
                            </button>
                        </div>
                    </div>
                )}
                {submitError && (
                    <div className="mx-6 mb-0 mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Submission failed</p>
                            <p className="text-red-700 mt-0.5">{submitError}</p>
                        </div>
                    </div>
                )}

                {/* Wizard Footer (Sticky controls) */}
                <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={isFirstStep || isSubmitting}
                        className={`inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-all ${isFirstStep || isSubmitting ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900 cursor-not-allowed' : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 hover:text-zinc-900 dark:text-zinc-100 active:scale-95'}`}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1.5" /> Previous
                    </button>

                    {!isLastStep ? (
                        <button
                            onClick={handleNext}
                            className="inline-flex items-center px-5 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all active:scale-95"
                        >
                            Next Page <ChevronRight className="h-4 w-4 ml-1.5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !!submitSuccess}
                            className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                                : submitSuccess
                                    ? <><CheckCircle className="h-4 w-4 mr-2" /> Submitted</>
                                    : <><Save className="h-4 w-4 mr-2" /> Submit Registration</>
                            }
                        </button>
                    )}
                </div>

            </div>

            {/* View Profile Modal - triggered directly on complete */}
            {
                submitSuccess && isProfileModalOpen && (
                    <StudentProfileModal
                        studentId={submitSuccess.id}
                        student={submitSuccess}
                        onClose={() => setIsProfileModalOpen(false)}
                        onUpdate={(updated) => updated && setSubmitSuccess(updated)}
                    />
                )
            }
        </div >
    );
}
