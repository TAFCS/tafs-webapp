"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, CheckCircle, AlertCircle, Loader2, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import api from "@/lib/api";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { StudentProfileModal } from "@/src/features/students/components/student-profile-modal";
import { StudentListItem } from "@/src/store/slices/studentsSlice";

export function RegistrationForm() {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { items: classes } = useSelector((state: RootState) => state.classes);
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        if (classes.length === 0) {
            dispatch(fetchClasses());
        }
    }, [dispatch, classes.length]);

    const [formData, setFormData] = useState({
        serialNo: "", registrationNo: "", computerCodeNo: "",
        candidateName: "", fatherName: "", motherName: "",
        fatherCnic: "", motherCnic: "",
        dobDay: "", dobMonth: "", dobYear: "",
        nationalityPakistani: true, nationalityOther: "",
        gender: "", religion: "", identificationMarks: "",
        birthCountry: "", birthProvince: "", birthCity: "",
        ageYears: "", ageMonths: "", ageDays: "",
        previousSchools: [{ id: 1, name: "", location: "", levelStudied: "", reasonForLeaving: "" }],
        admissionSystem: "", admissionLevel: "",
        houseNo: "", areaBlock: "", city: "", postalCode: "", province: "", country: "", homePhone: "",
        candidatePhone: "", candidateEmail: "", fatherPhone: "", fatherEmail: "", fatherFax: "",
        motherPhone: "", motherEmail: "", motherFax: "",
        emergencyContactName: "", emergencyRelationship: "",
        testDay: "", testDate: "", testTime: "", testLevel: ""
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const addPreviousSchool = () => {
        setFormData(prev => ({
            ...prev,
            previousSchools: [...prev.previousSchools, { id: Date.now(), name: "", location: "", levelStudied: "", reasonForLeaving: "" }]
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

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<StudentListItem | null>(null);

    const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 3));
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === 3;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        // Build ISO date string from day/month/year fields
        const dob = formData.dobYear && formData.dobMonth && formData.dobDay
            ? `${formData.dobYear}-${String(formData.dobMonth).padStart(2, '0')}-${String(formData.dobDay).padStart(2, '0')}`
            : '';

        // Split candidateName into first / last
        const nameParts = formData.candidateName.trim().split(' ');
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts.slice(1).join(' ') || firstName;

        const fatherFullName = formData.fatherName.trim() || 'Father';

        // Mother full_name
        const motherFullName = formData.motherName.trim() || 'Mother';

        // Map admissionSystem to enum
        const academicSystem = formData.admissionSystem === 'cambridge' ? 'Cambridge' : 'Secondary';

        const payload = {
            first_name: firstName,
            last_name: lastName,
            dob,
            gender: formData.gender || 'Male',
            nationality: formData.nationalityPakistani ? 'Pakistani' : formData.nationalityOther || 'Pakistani',
            religion: formData.religion || undefined,
            place_of_birth: [formData.birthCountry, formData.birthProvince, formData.birthCity].filter(Boolean).join(', ') || undefined,
            identification_marks: formData.identificationMarks || undefined,
            primary_phone: formData.candidatePhone || undefined,
            email: formData.candidateEmail || undefined,
            father: {
                full_name: fatherFullName,
                cnic: formData.fatherCnic || undefined,
                primary_phone: formData.fatherPhone || undefined,
                email_address: formData.fatherEmail || undefined,
                house_appt_name: formData.houseNo || undefined,
                area_block: formData.areaBlock || undefined,
                city: formData.city || undefined,
                province: formData.province || undefined,
                country: formData.country || undefined,
            },
            mother: {
                full_name: motherFullName,
                cnic: formData.motherCnic || undefined,
                primary_phone: formData.motherPhone || undefined,
                email_address: formData.motherEmail || undefined,
            },
            emergency_contact: formData.emergencyContactName
                ? {
                    full_name: formData.emergencyContactName,
                    primary_phone: formData.homePhone || '0000-0000000',
                    relationship: formData.emergencyRelationship || 'Guardian',
                }
                : undefined,
            admission: {
                academic_system: academicSystem,
                requested_grade: formData.admissionLevel || 'N/A',
                academic_year: new Date().getFullYear().toString(),
            },
            previous_schools: formData.previousSchools
                .filter(s => s.name.trim())
                .map(s => ({
                    school_name: s.name,
                    location: s.location || undefined,
                    class_studied_from: s.levelStudied || undefined,
                    reason_for_leaving: s.reasonForLeaving || undefined,
                })),
        };

        try {
            const { data } = await api.post<any>(
                '/v1/admissions/register',
                payload
            );

            const rawStudent = data.data;
            const primaryGuardian = rawStudent.student_guardians?.find((sg: any) => sg.is_primary_contact)?.guardians;
            const latestAdmission = rawStudent.student_admissions?.[0];

            const mappedStudent: StudentListItem = {
                id: rawStudent.id,
                student_full_name: `${rawStudent.first_name} ${rawStudent.last_name}`.trim(),
                gr_number: rawStudent.gr_number,
                cc_number: rawStudent.cc_number,
                campus: rawStudent.campuses?.campus_name || "N/A",
                grade_and_section: latestAdmission ? `${latestAdmission.requested_grade}` : null,
                primary_guardian_name: primaryGuardian?.full_name,
                whatsapp_number: primaryGuardian?.whatsapp_number || primaryGuardian?.primary_phone,
                enrollment_status: rawStudent.status,
                financial_status_badge: 'Cleared',
                family_id: rawStudent.families?.id,
                household_name: rawStudent.families?.household_name,
                total_outstanding_balance: 0,
                advance_credit_balance: 0,
                primary_guardian_cnic: primaryGuardian?.cnic,
                date_of_birth: rawStudent.dob,
                registration_number: rawStudent.cc_number,
                date_of_admission: rawStudent.created_at,
                house_and_color: null,
                residential_address: rawStudent.families?.primary_address || primaryGuardian?.house_appt_name,
                father_name: rawStudent.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.full_name,
                class_id: rawStudent.class_id,
                siblings: rawStudent.families?.students
                    ?.filter((s: any) => s.id !== rawStudent.id)
                    ?.map((s: any) => ({
                        id: s.id,
                        full_name: `${s.first_name} ${s.last_name}`.trim(),
                        cc_number: s.cc_number,
                        grade: s.student_admissions?.[0]?.requested_grade,
                        father_name: s.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.full_name,
                    })),
            };

            setSubmitSuccess(mappedStudent);
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

    return (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">

            {/* Left Sidebar - Administrative Data */}
            <div className="w-full md:w-64 bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-200 p-6 flex-shrink-0">
                <div className="flex flex-col items-center justify-center mb-8 gap-3">
                    <Image src={LogoImage} alt="TAFSync Logo" width={80} height={80} className="object-contain" priority unoptimized />
                    <h2 className="text-xl font-bold tracking-tight text-primary">TAFSync</h2>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Office Records</h3>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Serial #</label>
                        <input type="text" name="serialNo" value={formData.serialNo} onChange={handleInputChange} className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Registration #</label>
                        <input type="text" name="registrationNo" value={formData.registrationNo} onChange={handleInputChange} className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Computer Code #</label>
                        <input type="text" name="computerCodeNo" value={formData.computerCodeNo} onChange={handleInputChange} className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Photographs</h3>
                    <div className="flex flex-col gap-3">
                        <div className="h-24 w-full border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-2 cursor-pointer hover:bg-zinc-100 hover:border-primary transition-colors">
                            Candidate (1.5&quot; x 2&quot;)<br />Light Blue BG
                        </div>
                        <div className="flex gap-2">
                            <div className="h-20 w-1/2 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-1 cursor-pointer hover:bg-zinc-100 hover:border-primary transition-colors">Father</div>
                            <div className="h-20 w-1/2 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-1 cursor-pointer hover:bg-zinc-100 hover:border-primary transition-colors">Mother</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Form Area */}
            <div className="flex-1 flex flex-col">

                {/* Wizard Header Sequence */}
                <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">Application for Registration (FORM #1)</h2>
                        <p className="text-sm text-zinc-500">
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
                <div className="flex-1 p-6 sm:p-8 bg-zinc-50/50 overflow-y-auto min-h-[500px]">

                    {/* -- PAGE 1: PERSONAL DATA & TARGETS -- */}
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">1. Personal Data</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Candidate&apos;s Full Name (In Block Letters Only)</label>
                                        <input type="text" name="candidateName" value={formData.candidateName} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Father&apos;s Name</label>
                                        <input type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-3" />
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Father&apos;s CNIC</label>
                                        <input type="text" name="fatherCnic" value={formData.fatherCnic} onChange={handleInputChange} placeholder="XXXXX-XXXXXXX-X" className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mother&apos;s Name</label>
                                        <input type="text" name="motherName" value={formData.motherName} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-3" />
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mother&apos;s CNIC</label>
                                        <input type="text" name="motherCnic" value={formData.motherCnic} onChange={handleInputChange} placeholder="XXXXX-XXXXXXX-X" className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Date of Birth</label>
                                        <div className="flex gap-2">
                                            <input type="text" name="dobDay" value={formData.dobDay} onChange={handleInputChange} placeholder="DD" className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center" />
                                            <input type="text" name="dobMonth" value={formData.dobMonth} onChange={handleInputChange} placeholder="MM" className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center" />
                                            <input type="text" name="dobYear" value={formData.dobYear} onChange={handleInputChange} placeholder="YYYY" className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Age at time of registration</label>
                                        <div className="flex gap-2">
                                            <div className="relative w-1/3"><input type="text" name="ageYears" value={formData.ageYears} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8" /><span className="absolute right-3 top-2.5 text-xs text-zinc-400">Yrs</span></div>
                                            <div className="relative w-1/3"><input type="text" name="ageMonths" value={formData.ageMonths} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8" /><span className="absolute right-3 top-2.5 text-xs text-zinc-400">Mos</span></div>
                                            <div className="relative w-1/3"><input type="text" name="ageDays" value={formData.ageDays} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8" /><span className="absolute right-3 top-2.5 text-xs text-zinc-400">Dys</span></div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nationality</label>
                                            <select name="nationalityPakistani" onChange={(e) => setFormData({ ...formData, nationalityPakistani: e.target.value === 'true' })} className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white">
                                                <option value="true">Pakistani</option>
                                                <option value="false">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white">
                                                <option value="">Select...</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Religion</label>
                                            <select name="religion" value={formData.religion} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white">
                                                <option value="">Select...</option>
                                                <option value="Muslim">Muslim</option><option value="Christian">Christian</option><option value="Hindu">Hindu</option><option value="Others">Others</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Place of Birth: Country</label>
                                            <input type="text" name="birthCountry" value={formData.birthCountry} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Province</label>
                                            <input type="text" name="birthProvince" value={formData.birthProvince} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">City</label>
                                            <input type="text" name="birthCity" value={formData.birthCity} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Identification Mark(s)</label>
                                        <input type="text" name="identificationMarks" value={formData.identificationMarks} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Previous Schooling */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8 flex justify-between items-end">
                                    <h3 className="text-base font-medium text-zinc-900">2. Previous Schooling Details</h3>
                                    <span className="text-xs text-zinc-400 italic">Starting with the last school attended</span>
                                </div>
                                <div className="space-y-4">
                                    {formData.previousSchools.map((school, index) => (
                                        <div key={school.id} className="p-4 border border-zinc-200 rounded-xl bg-white relative group">
                                            <div className="absolute -left-2.5 top-4 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{index + 1}</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Name of School</label>
                                                    <input type="text" value={school.name} onChange={(e) => handleSchoolChange(school.id, 'name', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Location</label>
                                                    <input type="text" value={school.location} onChange={(e) => handleSchoolChange(school.id, 'location', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Class/Level Studied</label>
                                                    <input type="text" placeholder="From - Upto" value={school.levelStudied} onChange={(e) => handleSchoolChange(school.id, 'levelStudied', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md" />
                                                </div>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-zinc-700 mb-1">Reason for Leaving</label>
                                                        <input type="text" value={school.reasonForLeaving} onChange={(e) => handleSchoolChange(school.id, 'reasonForLeaving', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md" />
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
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">3. Admission Required In</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* O-Level Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === "cambridge" ? 'border-primary/50 bg-primary/5' : 'border-zinc-200 bg-white'}`}>
                                        <div className="flex items-center mb-4 cursor-pointer">
                                            <input type="radio" name="admissionSystem" value="cambridge" id="sys-cambridge-reg" checked={formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="h-4 w-4 text-primary focus:ring-primary border-zinc-300" />
                                            <label htmlFor="sys-cambridge-reg" className="ml-2 block font-semibold text-primary cursor-pointer">Cambridge GCE O&apos; Level System</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'cambridge' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['Pre-Nursery', 'Nursery', 'K.G.', 'JR-I', 'JR-II', 'JR-III', 'JR-IV', 'JR-V', 'SR-I', 'SR-II', 'SR-III', 'O-I', 'O-II', 'O-III'].map(cls => (
                                                <div key={cls} className="flex items-center">
                                                    <input type="radio" name="admissionLevel" value={cls} checked={formData.admissionLevel === cls && formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="h-3.5 w-3.5 text-primary focus:ring-primary border-zinc-300" />
                                                    <label className="ml-2 text-sm text-zinc-700">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Secondary Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === "secondary" ? 'border-secondary/50 bg-secondary/5' : 'border-zinc-200 bg-white'}`}>
                                        <div className="flex items-center mb-4 cursor-pointer">
                                            <input type="radio" name="admissionSystem" value="secondary" id="sys-secondary-reg" checked={formData.admissionSystem === "secondary"} onChange={handleInputChange} className="h-4 w-4 text-secondary focus:ring-secondary border-zinc-300" />
                                            <label htmlFor="sys-secondary-reg" className="ml-2 block font-semibold text-secondary cursor-pointer">Secondary System of Studies</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'secondary' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['VI', 'VII', 'VIII', 'IX', 'X'].map(cls => (
                                                <div key={cls} className="flex items-center">
                                                    <input type="radio" name="admissionLevel" value={cls} checked={formData.admissionLevel === cls && formData.admissionSystem === "secondary"} onChange={handleInputChange} className="h-3.5 w-3.5 text-secondary focus:ring-secondary border-zinc-300" />
                                                    <label className="ml-2 text-sm text-zinc-700">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                    {/* -- PAGE 2: MAILING & CONTACTS & SIGNATURES -- */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">4. Mailing Address</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">House / Apartment Name and No.</label>
                                        <input type="text" name="houseNo" value={formData.houseNo} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Area and Block # (If any)</label>
                                        <input type="text" name="areaBlock" value={formData.areaBlock} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">City</label><input type="text" name="city" value={formData.city} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Postal Code</label><input type="text" name="postalCode" value={formData.postalCode} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Province</label><input type="text" name="province" value={formData.province} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Country</label><input type="text" name="country" value={formData.country} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Home Phone #</label>
                                        <input type="text" name="homePhone" value={formData.homePhone} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Contact Details Matrix</h3>
                                </div>
                                <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Contact Person</th>
                                                <th className="px-4 py-3 font-semibold w-1/4">Cellular Phone #</th>
                                                <th className="px-4 py-3 font-semibold w-1/3">E-mail Address</th>
                                                <th className="px-4 py-3 font-semibold w-1/5">Fax #</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-zinc-100">
                                                <td className="px-4 py-3 font-medium text-zinc-700">Candidate</td>
                                                <td className="px-2 py-2"><input type="text" name="candidatePhone" value={formData.candidatePhone} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="email" name="candidateEmail" value={formData.candidateEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="text" disabled className="w-full px-2 py-1.5 bg-zinc-50 text-zinc-400 rounded text-sm cursor-not-allowed" placeholder="N/A" /></td>
                                            </tr>
                                            <tr className="border-b border-zinc-100">
                                                <td className="px-4 py-3 font-medium text-zinc-700">Father</td>
                                                <td className="px-2 py-2"><input type="text" name="fatherPhone" value={formData.fatherPhone} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="email" name="fatherEmail" value={formData.fatherEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="text" name="fatherFax" value={formData.fatherFax} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-medium text-zinc-700">Mother</td>
                                                <td className="px-2 py-2"><input type="text" name="motherPhone" value={formData.motherPhone} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="email" name="motherEmail" value={formData.motherEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                                <td className="px-2 py-2"><input type="text" name="motherFax" value={formData.motherFax} onChange={handleInputChange} className="w-full px-2 py-1.5 border border-zinc-200 focus:border-primary rounded text-sm outline-none" /></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Emergency Contact</h3>
                                </div>
                                <div className="bg-red-50/50 p-5 rounded-xl border border-red-100 flex gap-6">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Contact Name & Number</label>
                                        <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} placeholder="Name - Phone" className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Relationship with Candidate</label>
                                        <input type="text" name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-10">
                                    <h3 className="text-base font-medium text-zinc-900">Signatures</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm font-semibold text-zinc-700">Signatory:</span>
                                            <select className="px-2 py-1 text-sm bg-white border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-primary w-2/3">
                                                <option>Father</option>
                                                <option>Mother</option>
                                                <option>Guardian</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 border border-zinc-200 rounded-lg p-4 flex flex-col items-center justify-center bg-white h-32">
                                            <div className="flex-1 w-full border-b border-dashed border-zinc-300 flex items-end justify-center pb-2">
                                                <span className="text-zinc-300 italic">Sign here</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-end pb-8">
                                        <input type="text" placeholder="Day (e.g. Monday)" className="h-10 border-b-2 border-dashed border-zinc-300 bg-transparent mb-2 outline-none focus:border-primary text-center px-4" />
                                        <span className="text-sm font-semibold text-zinc-600 text-center uppercase tracking-wider">Day</span>
                                    </div>
                                    <div className="flex flex-col justify-end pb-8">
                                        <input type="date" className="h-10 border-b-2 border-dashed border-zinc-300 bg-transparent mb-2 outline-none focus:border-primary text-center px-4 text-sm" />
                                        <span className="text-sm font-semibold text-zinc-600 text-center uppercase tracking-wider">Date</span>
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

                            <section className="bg-white border border-dashed border-zinc-300 rounded-xl p-8 relative overflow-hidden">
                                {/* Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                                    <span className="text-6xl font-black uppercase text-center transform -rotate-12">Office Use</span>
                                </div>

                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Test Interview Allocation</label>
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Day" className="w-1/3 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm" />
                                                <input type="date" className="w-1/3 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm" />
                                                <input type="time" className="w-1/3 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Test for Level / Class</label>
                                            <input type="text" className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm" />
                                        </div>
                                    </div>

                                    <div className="space-y-8 flex flex-col justify-end">
                                        <div className="flex flex-col justify-end pt-2">
                                            <div className="h-10 border-b border-zinc-300 bg-transparent mb-2 w-full max-w-[200px]" />
                                            <span className="text-xs font-semibold text-zinc-500 uppercase">Admission Registrar</span>
                                        </div>

                                        <div className="flex gap-8 items-end pt-2">
                                            <div className="flex-1">
                                                <div className="h-10 border-b border-zinc-300 bg-transparent mb-2 w-full" />
                                                <span className="text-xs font-semibold text-zinc-500 uppercase">Issuing Authority</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="h-10 border-b border-zinc-300 bg-transparent mb-2 w-full" />
                                                <span className="text-xs font-semibold text-zinc-500 uppercase">Date</span>
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
                            <p className="font-semibold">Registration submitted successfully!</p>
                            <p className="text-emerald-700 mt-0.5">Computer Code assigned: <span className="font-mono font-bold">{submitSuccess.cc_number}</span>. The student record is now <span className="font-medium">PENDING</span> review.</p>
                        </div>
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
                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={isFirstStep || isSubmitting}
                        className={`inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-all ${isFirstStep || isSubmitting ? 'border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed' : 'border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900 active:scale-95'}`}
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
            {submitSuccess && (
                <StudentProfileModal
                    studentId={submitSuccess.id}
                    onClose={() => setSubmitSuccess(null)}
                />
            )}
        </div>
    );
}
