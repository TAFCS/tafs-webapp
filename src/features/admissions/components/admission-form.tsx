"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Save, CheckCircle } from "lucide-react";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import api from "@/lib/api";
import { StudentProfileModal } from "@/src/features/students/components/student-profile-modal";
import { StudentListItem } from "@/src/store/slices/studentsSlice";

export function AdmissionForm() {
    const [currentStep, setCurrentStep] = useState(1);
    const [isFetchingCC, setIsFetchingCC] = useState(false);
    const [ccError, setCcError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState<StudentListItem | null>(null);

    const [formData, setFormData] = useState({
        // Page 1: Personal Data
        serialNo: "", registrationNo: "", computerCodeNo: "", grNo: "",
        candidateName: "", dobDay: "", dobMonth: "", dobYear: "",
        nationality: "Pakistani", otherNationality: "", placeOfBirthCountry: "", placeOfBirthProvince: "", placeOfBirthCity: "",
        gender: "", religion: "Muslim", otherReligion: "", identificationMarks: "",
        ageYears: "", ageMonths: "", ageDays: "",
        previousSchools: [{ name: "", location: "", classStudied: "", reasonForLeaving: "" }],
        candidatePhone: "", candidateEmail: "", candidateEmergencyName: "", candidateEmergencyRelation: "",
        admissionSystem: "", admissionClass: "",
        languages: {
            english: { speaks: "F", reads: "F", writes: "F" },
            urdu: { speaks: "F", reads: "F", writes: "F" },
            other: { speaks: "F", reads: "F", writes: "F" }
        },

        // Page 2: Family Background
        fatherName: "", fatherAddress: "", fatherHomePhone: "", fatherCellPhone: "", fatherEmergencyName: "", fatherEmergencyRelation: "", fatherPOBCountry: "", fatherPOBProvince: "", fatherPOBCity: "", fatherAge: "", fatherEducation: "", fatherOccupation: "", fatherOrganization: "", fatherPosition: "", fatherIncome: "", fatherWorkPhone: "", fatherOfficeAddress: "", fatherCnic: "", fatherEmail: "",
        motherName: "", motherAddress: "", motherHomePhone: "", motherCellPhone: "", motherEmergencyName: "", motherEmergencyRelation: "", motherPOBCountry: "", motherPOBProvince: "", motherPOBCity: "", motherAge: "", motherEducation: "", motherOccupation: "", motherOrganization: "", motherPosition: "", motherIncome: "", motherWorkPhone: "", motherOfficeAddress: "", motherCnic: "", motherEmail: "",

        // Page 3: General Information
        guardianName: "", guardianAddress: "", guardianCity: "", guardianProvince: "", guardianCountry: "", guardianPostal: "", guardianHomePhone: "", guardianCellPhone: "", guardianEmergencyName: "", guardianEmergencyRelation: "", guardianPOBCountry: "", guardianPOBProvince: "", guardianPOBCity: "", guardianAge: "", guardianEducation: "", guardianOccupation: "", guardianOrganization: "", guardianPosition: "", guardianIncome: "", guardianWorkPhone: "", guardianOfficeAddress: "", guardianCnic: "", guardianEmail: "",
        siblings: [{ name: "", relationship: "", age: "", currentSchool: "" }],
        siblingNumber: "", pickAndDropRequired: "No",
        relativesAtTafs: [{ name: "", classLevel: "", relationship: "" }],
        coCurricular: [{ activity: "", grade: "", honors: "", continueAtTafs: "Yes" }],
        areasToImprove: "", medicalProblems: "", medication: "", physicalImpairment: "", candidateInterests: "", otherInformation: "",
        publicizeConsent: "Consent",

        // Page 4: Rules & Declarations
        declarationParentName: "", declarationParentFO: "", declarationResidentOf: "", declarationCnic: "",
        declarationDate: "",

        // Page 5: Office Use Only
        interviewerDate: "", interviewerClass: "", interviewerRemarks: "", interviewerName: "",
        admissionOrderDate: "", admissionOrderClass: "", admissionOrderRemarks: "",
        accountsDate: "", accountsClass: "", accountsCandidateName: "", accountsFatherName: "",
        accountsRegistrationNo: "", accountsComputerCode: "", accountsGrNo: "", accountsGrLink: "",
        accountsChallanNo: "", accountsAmountFigures: "", accountsAmountWords: "", accountsApprovalDate: ""
    });

    const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 5));
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === 5;

    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        try {
            // Build the payload mapping from formData to SubmitAdmissionFormDto
            const payload = {
                cc_number: formData.computerCodeNo,
                gr_number: formData.grNo || undefined,
                gender: formData.gender || undefined,
                religion: formData.religion === 'Other' ? formData.otherReligion : formData.religion,
                nationality: formData.nationality === 'Other' ? formData.otherNationality : formData.nationality,
                identification_marks: formData.identificationMarks || undefined,
                physical_impairment: formData.physicalImpairment || undefined,
                medical_info: formData.medicalProblems || undefined,
                interests: formData.candidateInterests || undefined,
                consent_publicity: formData.publicizeConsent === "Consent",

                admission: {
                    academic_system: formData.admissionSystem || "N/A",
                    requested_grade: formData.admissionClass || "N/A",
                    academic_year: new Date().getFullYear().toString(),
                },

                previous_schools: formData.previousSchools
                    .filter(s => s.name?.trim())
                    .map(s => ({
                        school_name: s.name,
                        location: s.location || undefined,
                        class_studied_from: undefined,
                        class_studied_to: s.classStudied || undefined,
                        reason_for_leaving: s.reasonForLeaving || undefined,
                    })),

                languages: [
                    { language_name: 'English', can_speak: formData.languages.english.speaks === 'T', can_read: formData.languages.english.reads === 'T', can_write: formData.languages.english.writes === 'T' },
                    { language_name: 'Urdu', can_speak: formData.languages.urdu.speaks === 'T', can_read: formData.languages.urdu.reads === 'T', can_write: formData.languages.urdu.writes === 'T' },
                    { language_name: 'Other', can_speak: formData.languages.other.speaks === 'T', can_read: formData.languages.other.reads === 'T', can_write: formData.languages.other.writes === 'T' }
                ],

                father: formData.fatherName ? {
                    full_name: formData.fatherName,
                    cnic: formData.fatherCnic || undefined,
                    primary_phone: formData.fatherHomePhone || undefined,
                    whatsapp_number: formData.fatherCellPhone || undefined,
                    work_phone: formData.fatherWorkPhone || undefined,
                    email_address: formData.fatherEmail || undefined,
                    education_level: formData.fatherEducation || undefined,
                    occupation: formData.fatherOccupation || undefined,
                    organization: formData.fatherOrganization || undefined,
                    job_position: formData.fatherPosition || undefined,
                    monthly_income: formData.fatherIncome ? Number(formData.fatherIncome) : undefined,
                    place_of_birth: [formData.fatherPOBCountry, formData.fatherPOBProvince, formData.fatherPOBCity].filter(Boolean).join(', ') || undefined,
                    work_address: formData.fatherOfficeAddress || undefined,
                    mailing_address: formData.fatherAddress || undefined,
                } : undefined,

                mother: formData.motherName ? {
                    full_name: formData.motherName,
                    cnic: formData.motherCnic || undefined,
                    primary_phone: formData.motherHomePhone || undefined,
                    whatsapp_number: formData.motherCellPhone || undefined,
                    work_phone: formData.motherWorkPhone || undefined,
                    email_address: formData.motherEmail || undefined,
                    education_level: formData.motherEducation || undefined,
                    occupation: formData.motherOccupation || undefined,
                    organization: formData.motherOrganization || undefined,
                    job_position: formData.motherPosition || undefined,
                    monthly_income: formData.motherIncome ? Number(formData.motherIncome) : undefined,
                    place_of_birth: [formData.motherPOBCountry, formData.motherPOBProvince, formData.motherPOBCity].filter(Boolean).join(', ') || undefined,
                    work_address: formData.motherOfficeAddress || undefined,
                    mailing_address: formData.motherAddress || undefined,
                } : undefined,

                guardian: formData.guardianName ? {
                    full_name: formData.guardianName,
                    cnic: formData.guardianCnic || undefined,
                    primary_phone: formData.guardianHomePhone || undefined,
                    whatsapp_number: formData.guardianCellPhone || undefined,
                    work_phone: formData.guardianWorkPhone || undefined,
                    email_address: formData.guardianEmail || undefined,
                    education_level: formData.guardianEducation || undefined,
                    occupation: formData.guardianOccupation || undefined,
                    organization: formData.guardianOrganization || undefined,
                    job_position: formData.guardianPosition || undefined,
                    monthly_income: formData.guardianIncome ? Number(formData.guardianIncome) : undefined,
                    place_of_birth: [formData.guardianPOBCountry, formData.guardianPOBProvince, formData.guardianPOBCity].filter(Boolean).join(', ') || undefined,
                    work_address: formData.guardianOfficeAddress || undefined,
                    mailing_address: formData.guardianAddress || undefined,
                    city: formData.guardianCity || undefined,
                    province: formData.guardianProvince || undefined,
                    country: formData.guardianCountry || undefined,
                } : undefined,

                siblings: formData.siblings
                    .filter(s => s.name?.trim())
                    .map(s => ({
                        full_name: s.name,
                        relationship: s.relationship || 'Sibling',
                        age: s.age ? Number(s.age) : undefined,
                        current_school: s.currentSchool || undefined,
                        pick_and_drop: formData.pickAndDropRequired === 'Yes',
                    })),

                relatives: formData.relativesAtTafs
                    .filter(r => r.name?.trim())
                    .map(r => ({
                        name: r.name,
                        class: r.classLevel || 'N/A',
                        relationship: r.relationship || 'Relative',
                    })),

                activities: formData.coCurricular
                    .filter(a => a.activity?.trim())
                    .map(a => ({
                        activity_name: a.activity,
                        grade: a.grade || undefined,
                        honors_awards: a.honors || undefined,
                        continue_at_tafs: a.continueAtTafs === 'Yes',
                    }))
            };

            const { data } = await api.post('/v1/admissions/admission-form', payload);
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
                house_and_color: null,
                residential_address: rawStudent.families?.primary_address || primaryGuardian?.house_appt_name,
                father_name: rawStudent.student_guardians?.find((sg: any) => sg.relationship === 'Father')?.guardians?.full_name,
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
                : (raw ?? 'Failed to submit admission form. Please review your entries and try again.');
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row relative">

            {/* Left Sidebar - Administrative Data (Visible across steps but static conceptually) */}
            <div className="w-full md:w-64 bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-200 p-6 flex-shrink-0">
                <div className="flex flex-col items-center justify-center mb-8 gap-3">
                    <Image src={LogoImage} alt="TAFSync Logo" width={80} height={80} className="object-contain" priority unoptimized />
                    <h2 className="text-xl font-bold tracking-tight text-primary">TAFSync</h2>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Office Records</h3>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Serial #</label>
                        <input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            value={formData.serialNo} onChange={e => setFormData({ ...formData, serialNo: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Registration #</label>
                        <input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            value={formData.registrationNo} onChange={e => setFormData({ ...formData, registrationNo: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Computer Code #</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                value={formData.computerCodeNo}
                                onChange={e => {
                                    setFormData({ ...formData, computerCodeNo: e.target.value });
                                    setCcError(null);
                                }}
                                placeholder="CC-YYYY-00001"
                            />
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!formData.computerCodeNo.trim()) {
                                        setCcError("Enter a Computer Code first.");
                                        return;
                                    }
                                    setIsFetchingCC(true);
                                    setCcError(null);
                                    try {
                                        const { data } = await api.get<{ data: any }>(
                                            `/v1/admissions/by-cc/${encodeURIComponent(formData.computerCodeNo.trim())}`
                                        );
                                        const student = data?.data;
                                        if (!student) {
                                            setCcError("No admission data returned for this Computer Code.");
                                            return;
                                        }

                                        const admission = Array.isArray(student.student_admissions)
                                            ? student.student_admissions[0]
                                            : null;

                                        const fatherRel = Array.isArray(student.student_guardians)
                                            ? student.student_guardians.find(
                                                (g: any) => g.relationship === "Father"
                                            )
                                            : null;
                                        const motherRel = Array.isArray(student.student_guardians)
                                            ? student.student_guardians.find(
                                                (g: any) => g.relationship === "Mother"
                                            )
                                            : null;
                                        const emergencyRel = Array.isArray(student.student_guardians)
                                            ? student.student_guardians.find(
                                                (g: any) => g.is_emergency_contact
                                            )
                                            : null;

                                        const father = fatherRel?.guardians;
                                        const mother = motherRel?.guardians;
                                        const emergency = emergencyRel?.guardians;

                                        const dob = student.dob ? new Date(student.dob) : null;

                                        const previousSchools = Array.isArray(student.student_previous_schools)
                                            ? student.student_previous_schools.map((s: any) => ({
                                                name: s.school_name ?? "",
                                                location: s.location ?? "",
                                                classStudied: [s.class_studied_from, s.class_studied_to]
                                                    .filter(Boolean)
                                                    .join(" - "),
                                                reasonForLeaving: s.reason_for_leaving ?? "",
                                            }))
                                            : undefined;

                                        // Helper: split a "Country, Province, City" combined string
                                        const splitPOB = (combined: string | null | undefined) => {
                                            const parts = (combined ?? "").split(", ");
                                            return { country: parts[0] ?? "", province: parts[1] ?? "", city: parts[2] ?? "" };
                                        };

                                        // Helper: compose a mailing address from guardian address fields
                                        const composeAddress = (g: any): string =>
                                            [g?.house_appt_name, g?.area_block, g?.city, g?.province, g?.country]
                                                .filter(Boolean).join(", ");

                                        const candidatePOB = splitPOB(student.place_of_birth);
                                        const fatherPOB = splitPOB(father?.place_of_birth);
                                        const motherPOB = splitPOB(mother?.place_of_birth);

                                        setFormData((prev) => ({
                                            ...prev,
                                            computerCodeNo: student.cc_number ?? prev.computerCodeNo,
                                            candidateName: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
                                            candidatePhone: student.primary_phone ?? prev.candidatePhone,
                                            candidateEmail: student.email ?? prev.candidateEmail,
                                            gender: student.gender ?? prev.gender,
                                            nationality: student.nationality ?? prev.nationality,
                                            religion: student.religion ?? prev.religion,
                                            identificationMarks: student.identification_marks ?? prev.identificationMarks,
                                            ageYears: student.admission_age_years?.toString() ?? prev.ageYears,
                                            physicalImpairment: student.physical_impairment ?? prev.physicalImpairment,
                                            candidateInterests: student.interests ?? prev.candidateInterests,
                                            medicalProblems: student.medical_info ?? prev.medicalProblems,
                                            publicizeConsent:
                                                student.consent_publicity === true
                                                    ? "Consent"
                                                    : student.consent_publicity === false
                                                        ? "Dissent"
                                                        : prev.publicizeConsent,
                                            dobDay: dob ? String(dob.getDate()).padStart(2, "0") : prev.dobDay,
                                            dobMonth: dob ? String(dob.getMonth() + 1).padStart(2, "0") : prev.dobMonth,
                                            dobYear: dob ? String(dob.getFullYear()) : prev.dobYear,

                                            // Candidate place of birth (split combined string from registration)
                                            placeOfBirthCountry: candidatePOB.country || prev.placeOfBirthCountry,
                                            placeOfBirthProvince: candidatePOB.province || prev.placeOfBirthProvince,
                                            placeOfBirthCity: candidatePOB.city || prev.placeOfBirthCity,

                                            admissionClass: admission?.requested_grade ?? prev.admissionClass,
                                            admissionSystem: admission?.academic_system ?? prev.admissionSystem,

                                            // Father
                                            fatherName: father?.full_name ?? prev.fatherName,
                                            fatherCellPhone: father?.whatsapp_number ?? father?.primary_phone ?? prev.fatherCellPhone,
                                            fatherHomePhone: father?.primary_phone ?? prev.fatherHomePhone,
                                            fatherWorkPhone: father?.work_phone ?? prev.fatherWorkPhone,
                                            fatherCnic: father?.cnic ?? prev.fatherCnic,
                                            fatherEmail: father?.email_address ?? prev.fatherEmail,
                                            // Father address (composed from registration mailing address fields)
                                            fatherAddress: composeAddress(father) || prev.fatherAddress,
                                            // Father occupation & background
                                            fatherEducation: father?.education_level ?? prev.fatherEducation,
                                            fatherOccupation: father?.occupation ?? prev.fatherOccupation,
                                            fatherOrganization: father?.organization ?? prev.fatherOrganization,
                                            fatherPosition: father?.occupational_position ?? father?.job_position ?? prev.fatherPosition,
                                            // Father place of birth (split combined string)
                                            fatherPOBCountry: fatherPOB.country || prev.fatherPOBCountry,
                                            fatherPOBProvince: fatherPOB.province || prev.fatherPOBProvince,
                                            fatherPOBCity: fatherPOB.city || prev.fatherPOBCity,

                                            // Mother
                                            motherName: mother?.full_name ?? prev.motherName,
                                            motherCellPhone: mother?.whatsapp_number ?? mother?.primary_phone ?? prev.motherCellPhone,
                                            motherHomePhone: mother?.primary_phone ?? prev.motherHomePhone,
                                            motherWorkPhone: mother?.work_phone ?? prev.motherWorkPhone,
                                            motherCnic: mother?.cnic ?? prev.motherCnic,
                                            motherEmail: mother?.email_address ?? prev.motherEmail,
                                            // Mother address (composed from registration mailing address fields)
                                            motherAddress: composeAddress(mother) || prev.motherAddress,
                                            // Mother occupation & background
                                            motherEducation: mother?.education_level ?? prev.motherEducation,
                                            motherOccupation: mother?.occupation ?? prev.motherOccupation,
                                            motherOrganization: mother?.organization ?? prev.motherOrganization,
                                            motherPosition: mother?.occupational_position ?? mother?.job_position ?? prev.motherPosition,
                                            // Mother place of birth (split combined string)
                                            motherPOBCountry: motherPOB.country || prev.motherPOBCountry,
                                            motherPOBProvince: motherPOB.province || prev.motherPOBProvince,
                                            motherPOBCity: motherPOB.city || prev.motherPOBCity,

                                            // Guardian / emergency contact
                                            guardianName: emergency?.full_name ?? prev.guardianName,
                                            guardianCellPhone: emergency?.primary_phone ?? prev.guardianCellPhone,
                                            guardianCnic: emergency?.cnic ?? prev.guardianCnic,

                                            previousSchools: previousSchools && previousSchools.length
                                                ? previousSchools
                                                : prev.previousSchools,
                                        }));
                                    } catch (error: any) {
                                        const status = error?.response?.status;
                                        if (status === 404) {
                                            setCcError("No admission found for this Computer Code.");
                                        } else {
                                            setCcError("Failed to fetch admission details. Please try again.");
                                        }
                                    } finally {
                                        setIsFetchingCC(false);
                                    }
                                }}
                                disabled={isFetchingCC}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border border-primary text-primary bg-white hover:bg-primary/5 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isFetchingCC ? "Fetching..." : "Fetch"}
                            </button>
                        </div>
                        {ccError && (
                            <p className="mt-1 text-[11px] text-red-600">
                                {ccError}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">G.R. #</label>
                        <input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            value={formData.grNo} onChange={e => setFormData({ ...formData, grNo: e.target.value })} />
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Photographs</h3>
                    <div className="flex flex-col gap-3">
                        <div className="h-24 w-full border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-2 cursor-pointer hover:bg-zinc-100 hover:border-primary">
                            Candidate (1.5&quot; x 2&quot;)<br />Light Blue BG
                        </div>
                        <div className="flex gap-2">
                            <div className="h-20 w-1/2 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-1 cursor-pointer hover:bg-zinc-100 hover:border-primary">Father</div>
                            <div className="h-20 w-1/2 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 text-xs text-zinc-500 text-center px-1 cursor-pointer hover:bg-zinc-100 hover:border-primary">Mother</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Form Area */}
            <div className="flex-1 flex flex-col">

                {/* Wizard Header Sequence */}
                <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">Application for Admission (FORM #2)</h2>
                        <p className="text-sm text-zinc-500">
                            Page {currentStep} of 5 — {currentStep === 1 ? 'Personal Data & Academic History' : currentStep === 2 ? 'Family Background' : currentStep === 3 ? 'General Info & Health' : currentStep === 4 ? 'Declarations & Signatures' : 'Office Use Only'}
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((step) => (
                            <div key={step} className={`h-2.5 w-8 rounded-full ${step === currentStep ? 'bg-primary' : step < currentStep ? 'bg-primary/40' : 'bg-zinc-200'}`} />
                        ))}
                    </div>
                </div>

                {/* Wizard Body (Scrollable) */}
                <div className="flex-1 p-6 sm:p-8 bg-zinc-50/50 overflow-y-auto">

                    {/* -- PAGE 1: PERSONAL DATA -- */}
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* Section 1: Personal Data */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">1. Personal Data</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Candidate&apos;s Full Name (In Block Letters Only)</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg uppercase focus:ring-2 mt-0 focus:ring-primary/20 focus:border-primary outline-none"
                                            value={formData.candidateName}
                                            onChange={e => setFormData({ ...formData, candidateName: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Date of Birth</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="DD"
                                                className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center"
                                                value={formData.dobDay}
                                                onChange={e => setFormData({ ...formData, dobDay: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="MM"
                                                className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center"
                                                value={formData.dobMonth}
                                                onChange={e => setFormData({ ...formData, dobMonth: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="YYYY"
                                                className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg text-center"
                                                value={formData.dobYear}
                                                onChange={e => setFormData({ ...formData, dobYear: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Age at time of admission</label>
                                        <div className="flex gap-2">
                                            <div className="relative w-1/3">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8"
                                                    value={formData.ageYears}
                                                    onChange={e => setFormData({ ...formData, ageYears: e.target.value })}
                                                />
                                                <span className="absolute right-3 top-2.5 text-xs text-zinc-400">Yrs</span>
                                            </div>
                                            <div className="relative w-1/3">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8"
                                                    value={formData.ageMonths}
                                                    onChange={e => setFormData({ ...formData, ageMonths: e.target.value })}
                                                />
                                                <span className="absolute right-3 top-2.5 text-xs text-zinc-400">Mos</span>
                                            </div>
                                            <div className="relative w-1/3">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg pr-8"
                                                    value={formData.ageDays}
                                                    onChange={e => setFormData({ ...formData, ageDays: e.target.value })}
                                                />
                                                <span className="absolute right-3 top-2.5 text-xs text-zinc-400">Dys</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Gender</label>
                                            <select
                                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                                                value={formData.gender}
                                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                            >
                                                <option value="">Select</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Religion</label>
                                            <select
                                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                                                value={formData.religion}
                                                onChange={e => setFormData({ ...formData, religion: e.target.value })}
                                            >
                                                <option value="Muslim">Muslim</option>
                                                <option value="Christian">Christian</option>
                                                <option value="Hindu">Hindu</option>
                                                <option value="Others">Others</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nationality</label>
                                            <select
                                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                                                value={formData.nationality}
                                                onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                                            >
                                                <option value="Pakistani">Pakistani</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Place of Birth: Country</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.placeOfBirthCountry}
                                                onChange={e => setFormData({ ...formData, placeOfBirthCountry: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Province</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.placeOfBirthProvince}
                                                onChange={e => setFormData({ ...formData, placeOfBirthProvince: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">City</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.placeOfBirthCity}
                                                onChange={e => setFormData({ ...formData, placeOfBirthCity: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Identification Mark(s)</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.identificationMarks}
                                            onChange={e => setFormData({ ...formData, identificationMarks: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Academic Ability & Systems */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">1a. Academic Ability & System target</h3>
                                    <p className="text-sm text-zinc-500 mt-1">Select the system in which admission is required.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* O-Level Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === 'Cambridge' ? 'border-primary/50 bg-primary/5' : 'border-primary/20 bg-primary/5'}`}>
                                        <div className="flex items-center mb-4 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="admissionSystem"
                                                id="sys-cambridge"
                                                value="Cambridge"
                                                checked={formData.admissionSystem === 'Cambridge'}
                                                onChange={e => setFormData({ ...formData, admissionSystem: e.target.value, admissionClass: '' })}
                                                className="h-4 w-4 text-primary focus:ring-primary border-zinc-300"
                                            />
                                            <label htmlFor="sys-cambridge" className="ml-2 block font-semibold text-primary cursor-pointer">Cambridge GCE O&apos; Level System</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'Cambridge' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['Pre-Nursery', 'Nursery', 'K.G.', 'JR-I', 'JR-II', 'JR-III', 'JR-IV', 'JR-V', 'SR-I', 'SR-II', 'SR-III', 'O-I', 'O-II', 'O-III'].map(cls => (
                                                <div key={cls} className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="admissionClass"
                                                        value={cls}
                                                        checked={formData.admissionClass === cls && formData.admissionSystem === 'Cambridge'}
                                                        onChange={e => setFormData({ ...formData, admissionClass: e.target.value })}
                                                        className="h-3.5 w-3.5 text-primary focus:ring-primary border-zinc-300"
                                                    />
                                                    <label className="ml-2 text-sm text-zinc-700">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Secondary Block */}
                                    <div className={`border-2 rounded-xl p-5 ${formData.admissionSystem === 'Secondary' ? 'border-secondary/50 bg-secondary/5' : 'border-secondary/20 bg-secondary/5'}`}>
                                        <div className="flex items-center mb-4 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="admissionSystem"
                                                id="sys-secondary"
                                                value="Secondary"
                                                checked={formData.admissionSystem === 'Secondary'}
                                                onChange={e => setFormData({ ...formData, admissionSystem: e.target.value, admissionClass: '' })}
                                                className="h-4 w-4 text-secondary focus:ring-secondary border-zinc-300"
                                            />
                                            <label htmlFor="sys-secondary" className="ml-2 block font-semibold text-secondary cursor-pointer">Secondary System of Studies</label>
                                        </div>
                                        <div className={`grid grid-cols-2 gap-y-2 gap-x-4 pl-6 ${formData.admissionSystem !== 'Secondary' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {['VI', 'VII', 'VIII', 'IX', 'X'].map(cls => (
                                                <div key={cls} className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="admissionClass"
                                                        value={cls}
                                                        checked={formData.admissionClass === cls && formData.admissionSystem === 'Secondary'}
                                                        onChange={e => setFormData({ ...formData, admissionClass: e.target.value })}
                                                        className="h-3.5 w-3.5 text-secondary focus:ring-secondary border-zinc-300"
                                                    />
                                                    <label className="ml-2 text-sm text-zinc-700">{cls}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Language Grid */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8 flex justify-between items-end">
                                    <div>
                                        <h3 className="text-base font-medium text-zinc-900">1b. Language Capability</h3>
                                        <p className="text-sm text-zinc-500 mt-1">Rate the candidate&apos;s language proficiency.</p>
                                    </div>
                                    <div className="text-xs bg-zinc-100 text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-200">
                                        <span className="font-semibold">Key:</span> E (Excellent) • G (Good) • F (Fair)
                                    </div>
                                </div>

                                <div className="bg-white border text-center border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="grid grid-cols-4 bg-zinc-50 text-sm font-medium text-zinc-600 border-b border-zinc-200">
                                        <div className="p-3 text-left border-r border-zinc-200">Language</div>
                                        <div className="p-3 border-r border-zinc-200">Speaks</div>
                                        <div className="p-3 border-r border-zinc-200">Reads</div>
                                        <div className="p-3">Writes</div>
                                    </div>
                                    {['English', 'Urdu', 'Other'].map((lang, idx) => (
                                        <div key={lang} className={`grid grid-cols-4 text-sm ${idx !== 2 ? 'border-b border-zinc-200' : ''}`}>
                                            <div className="p-3 text-left font-medium text-zinc-900 border-r border-zinc-200 bg-zinc-50/50 flex items-center">{lang}</div>
                                            <div className="p-3 border-r border-zinc-200 flex justify-center"><select className="w-16 text-center border-zinc-300 rounded"><option>E</option><option>G</option><option>F</option></select></div>
                                            <div className="p-3 border-r border-zinc-200 flex justify-center"><select className="w-16 text-center border-zinc-300 rounded"><option>E</option><option>G</option><option>F</option></select></div>
                                            <div className="p-3 flex justify-center"><select className="w-16 text-center border-zinc-300 rounded"><option>E</option><option>G</option><option>F</option></select></div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Section: Previous Schooling */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Previous Schooling Details</h3>
                                    <p className="text-sm text-zinc-500 mt-1">Starting with the last school attended.</p>
                                </div>
                                <div className="space-y-4">
                                    {formData.previousSchools.map((school, index) => (
                                        <div key={index} className="p-4 border border-zinc-200 rounded-xl bg-white relative group">
                                            <div className="absolute -left-2.5 top-4 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{index + 1}</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Name of School</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md"
                                                        value={school.name}
                                                        onChange={e => {
                                                            const updated = formData.previousSchools.map((s, i) => i === index ? { ...s, name: e.target.value } : s);
                                                            setFormData({ ...formData, previousSchools: updated });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Location</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md"
                                                        value={school.location}
                                                        onChange={e => {
                                                            const updated = formData.previousSchools.map((s, i) => i === index ? { ...s, location: e.target.value } : s);
                                                            setFormData({ ...formData, previousSchools: updated });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Class/Level Studied</label>
                                                    <input
                                                        type="text"
                                                        placeholder="From - Upto"
                                                        className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md"
                                                        value={school.classStudied}
                                                        onChange={e => {
                                                            const updated = formData.previousSchools.map((s, i) => i === index ? { ...s, classStudied: e.target.value } : s);
                                                            setFormData({ ...formData, previousSchools: updated });
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 mb-1">Reason for Leaving</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-md"
                                                        value={school.reasonForLeaving}
                                                        onChange={e => {
                                                            const updated = formData.previousSchools.map((s, i) => i === index ? { ...s, reasonForLeaving: e.target.value } : s);
                                                            setFormData({ ...formData, previousSchools: updated });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="text-sm font-medium text-primary hover:text-primary/80"
                                        onClick={() => setFormData({ ...formData, previousSchools: [...formData.previousSchools, { name: "", location: "", classStudied: "", reasonForLeaving: "" }] })}
                                    >
                                        + Add another school
                                    </button>
                                </div>
                            </section>

                        </div>
                    )}

                    {/* -- PAGE 2: FAMILY BACKGROUND -- */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* Father's Info */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">2a. Father&apos;s Information</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                            value={formData.fatherName}
                                            onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mailing Address</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            placeholder="House/Apartment Name and No, Area and Block No, City, Province, Country, Postal Code"
                                            value={formData.fatherAddress}
                                            onChange={e => setFormData({ ...formData, fatherAddress: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Home Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherHomePhone}
                                            onChange={e => setFormData({ ...formData, fatherHomePhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cellular Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherCellPhone}
                                            onChange={e => setFormData({ ...formData, fatherCellPhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emergency Contact Name & Number</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherEmergencyName}
                                            onChange={e => setFormData({ ...formData, fatherEmergencyName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Relationship with Candidate</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherEmergencyRelation}
                                            onChange={e => setFormData({ ...formData, fatherEmergencyRelation: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: Country</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherPOBCountry}
                                                onChange={e => setFormData({ ...formData, fatherPOBCountry: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: Province</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherPOBProvince}
                                                onChange={e => setFormData({ ...formData, fatherPOBProvince: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: City</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherPOBCity}
                                                onChange={e => setFormData({ ...formData, fatherPOBCity: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Age</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherAge}
                                                onChange={e => setFormData({ ...formData, fatherAge: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Educational Level</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherEducation}
                                                onChange={e => setFormData({ ...formData, fatherEducation: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Occupation</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherOccupation}
                                                onChange={e => setFormData({ ...formData, fatherOccupation: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Organization</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.fatherOrganization}
                                                onChange={e => setFormData({ ...formData, fatherOrganization: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Occupational Position</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherPosition}
                                            onChange={e => setFormData({ ...formData, fatherPosition: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Monthly Income</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherIncome}
                                            onChange={e => setFormData({ ...formData, fatherIncome: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Work Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherWorkPhone}
                                            onChange={e => setFormData({ ...formData, fatherWorkPhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">C.N.I.C. #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg placeholder-zinc-300"
                                            placeholder="00000-0000000-0"
                                            value={formData.fatherCnic}
                                            onChange={e => setFormData({ ...formData, fatherCnic: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Office Address</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherOfficeAddress}
                                            onChange={e => setFormData({ ...formData, fatherOfficeAddress: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email Address</label>
                                        <input
                                            type="email"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.fatherEmail}
                                            onChange={e => setFormData({ ...formData, fatherEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Mother's Info */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">2b. Mother&apos;s Information</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                                            value={formData.motherName}
                                            onChange={e => setFormData({ ...formData, motherName: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mailing Address</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            placeholder="House/Apartment Name and No, Area and Block No, City, Province, Country, Postal Code"
                                            value={formData.motherAddress}
                                            onChange={e => setFormData({ ...formData, motherAddress: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Home Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherHomePhone}
                                            onChange={e => setFormData({ ...formData, motherHomePhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cellular Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherCellPhone}
                                            onChange={e => setFormData({ ...formData, motherCellPhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Emergency Contact Name & Number</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherEmergencyName}
                                            onChange={e => setFormData({ ...formData, motherEmergencyName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Relationship with Candidate</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherEmergencyRelation}
                                            onChange={e => setFormData({ ...formData, motherEmergencyRelation: e.target.value })} />
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: Country</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherPOBCountry}
                                                onChange={e => setFormData({ ...formData, motherPOBCountry: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: Province</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherPOBProvince}
                                                onChange={e => setFormData({ ...formData, motherPOBProvince: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">POB: City</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherPOBCity}
                                                onChange={e => setFormData({ ...formData, motherPOBCity: e.target.value })} /></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Age</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherAge}
                                                onChange={e => setFormData({ ...formData, motherAge: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Educational Level</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherEducation}
                                                onChange={e => setFormData({ ...formData, motherEducation: e.target.value })} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Occupation</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherOccupation}
                                                onChange={e => setFormData({ ...formData, motherOccupation: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Organization</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.motherOrganization}
                                                onChange={e => setFormData({ ...formData, motherOrganization: e.target.value })} /></div>
                                    </div>
                                    <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Occupational Position</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherPosition}
                                            onChange={e => setFormData({ ...formData, motherPosition: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Monthly Income</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherIncome}
                                            onChange={e => setFormData({ ...formData, motherIncome: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Work Phone #</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherWorkPhone}
                                            onChange={e => setFormData({ ...formData, motherWorkPhone: e.target.value })} /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">C.N.I.C. #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg placeholder-zinc-300"
                                            placeholder="00000-0000000-0"
                                            value={formData.motherCnic}
                                            onChange={e => setFormData({ ...formData, motherCnic: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-zinc-700 mb-1.5">Office Address</label>
                                        <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherOfficeAddress}
                                            onChange={e => setFormData({ ...formData, motherOfficeAddress: e.target.value })} /></div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email Address</label>
                                        <input
                                            type="email"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.motherEmail}
                                            onChange={e => setFormData({ ...formData, motherEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* -- PAGE 3: GENERAL INFO & HEALTH -- */}
                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* Guardian Info */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">2c. Guardian / Next of Kin Information</h3>
                                    <p className="text-sm text-zinc-500 mt-1">If candidate is not living with biological parents.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-100 p-5 rounded-xl border border-zinc-200">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Guardian Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.guardianName}
                                            onChange={e => setFormData({ ...formData, guardianName: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mailing Address</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.guardianAddress}
                                            onChange={e => setFormData({ ...formData, guardianAddress: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cellular Phone #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            value={formData.guardianCellPhone}
                                            onChange={e => setFormData({ ...formData, guardianCellPhone: e.target.value })}
                                        />
                                    </div>
                                    <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Relationship with Candidate</label><input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                    <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">Occupation</label><input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg" /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">C.N.I.C. #</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                            placeholder="00000-0000000-0"
                                            value={formData.guardianCnic}
                                            onChange={e => setFormData({ ...formData, guardianCnic: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Siblings & Relatives */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">3. General Information</h3>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-3">Siblings (Brothers/Sisters)</label>
                                        <div className="space-y-4">
                                            {formData.siblings.map((sibling, index) => (
                                                <div key={`sib-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-zinc-200 bg-white rounded-lg">
                                                    <div><label className="block text-xs text-zinc-500 mb-1">Name</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                    <div><label className="block text-xs text-zinc-500 mb-1">Relationship</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                    <div><label className="block text-xs text-zinc-500 mb-1">Age</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                    <div><label className="block text-xs text-zinc-500 mb-1">Current School/Uni</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                </div>
                                            ))}
                                            <button type="button" className="text-sm font-medium text-primary hover:text-primary/80">+ Add brother/sister</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">What is his/her number among siblings?</label>
                                            <input type="text" className="w-full px-3 py-2 border border-zinc-300 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Pick & Drop facility required?</label>
                                            <div className="flex gap-4 mt-2">
                                                <label className="flex items-center"><input type="radio" name="pickDrop" className="mr-2 text-primary focus:ring-primary" /> Yes</label>
                                                <label className="flex items-center"><input type="radio" name="pickDrop" className="mr-2 text-primary focus:ring-primary" defaultChecked /> No</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-zinc-100">
                                        <label className="block text-sm font-medium text-zinc-700 mb-3">Relatives who attended TAFS</label>
                                        {formData.relativesAtTafs.map((rel, index) => (
                                            <div key={`rel-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-zinc-200 bg-white rounded-lg">
                                                <div><label className="block text-xs text-zinc-500 mb-1">Name</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                <div><label className="block text-xs text-zinc-500 mb-1">Class/Level</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                <div><label className="block text-xs text-zinc-500 mb-1">Relationship</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-zinc-100">
                                        <label className="block text-sm font-medium text-zinc-700 mb-3">Co-curricular Activities / Hobbies</label>
                                        {formData.coCurricular.map((act, index) => (
                                            <div key={`act-${index}`} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border border-zinc-200 bg-white rounded-lg">
                                                <div className="sm:col-span-2"><label className="block text-xs text-zinc-500 mb-1">Activity</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                <div><label className="block text-xs text-zinc-500 mb-1">Grade</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                                <div><label className="block text-xs text-zinc-500 mb-1">Continue at TAFS?</label>
                                                    <select className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded"><option>Yes</option><option>No</option></select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Medical & Health */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Health & Additional Details</h3>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Areas in which candidate can improve</label>
                                        <textarea
                                            rows={2}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg resize-none"
                                            value={formData.areasToImprove}
                                            onChange={e => setFormData({ ...formData, areasToImprove: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Any medical / health problem / allergy?</label>
                                        <textarea
                                            rows={2}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg resize-none bg-red-50/30 focus:bg-white"
                                            value={formData.medicalProblems}
                                            onChange={e => setFormData({ ...formData, medicalProblems: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Any medication?</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.medication}
                                                onChange={e => setFormData({ ...formData, medication: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Any physical impairment?</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                                                value={formData.physicalImpairment}
                                                onChange={e => setFormData({ ...formData, physicalImpairment: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Candidate&apos;s Interests</label>
                                        <textarea
                                            rows={2}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg resize-none"
                                            value={formData.candidateInterests}
                                            onChange={e => setFormData({ ...formData, candidateInterests: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Media Consent */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">4. Permission for Publicizing Images</h3>
                                </div>
                                <div className="bg-white border text-sm text-zinc-700 border-zinc-200 p-5 rounded-xl flex flex-col gap-4">
                                    <p>I agree to allow TAFS to reproduce candidate&apos;s image along with his/her name for promotional activities.</p>
                                    <div className="flex gap-6">
                                        <label className="flex items-center"><input type="radio" name="mediaConsent" className="mr-2 text-primary focus:ring-primary h-4 w-4" defaultChecked /> Consent</label>
                                        <label className="flex items-center"><input type="radio" name="mediaConsent" className="mr-2 text-red-500 focus:ring-red-500 h-4 w-4" /> Dissent</label>
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                    {/* -- PAGE 4: RULES & DECLARATIONS -- */}
                    {currentStep === 4 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* Rules Summary */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5">
                                    <h3 className="text-base font-medium text-zinc-900">Rules & Regulations</h3>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-sm text-zinc-600 space-y-3 h-64 overflow-y-auto">
                                    <p><strong>1. Document Requirements:</strong> All admissions are conditional upon the submission of a valid birth certificate, vaccination card, C.N.I.C copies of parents, and required photographs.</p>
                                    <p><strong>2. Fee Payment:</strong> Tuition and other fees must be paid before the 10th of every month. A surcharge will be applied to late payments.</p>
                                    <p><strong>3. Withdrawal Policy:</strong> One month&apos;s notice in writing is required before the withdrawal of a student, failing which one month&apos;s fee will be charged in lieu.</p>
                                    <p><strong>4. Disciplinary Rules:</strong> The school reserves the right to suspend or expel any student whose conduct is deemed unsatisfactory or who fails to comply with the school&apos;s regulations.</p>
                                    <p><strong>5. Attendance:</strong> 80% attendance is mandatory for promotion to the next class.</p>
                                    <p><strong>6. Indemnity:</strong> The school shall not be held liable for any accidental injury sustained by the student during school hours or activities.</p>
                                </div>
                            </section>

                            {/* Declaration */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Declaration by Parents / Guardian</h3>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700 leading-relaxed">
                                        <span>I,</span>
                                        <input type="text" className="flex-1 min-w-[200px] border-b-2 border-zinc-300 px-2 py-1 focus:border-primary outline-none bg-transparent" placeholder="Name of Parent/Guardian" />
                                        <span>Father/Husband of (F/O)</span>
                                        <input type="text" className="flex-1 min-w-[200px] border-b-2 border-zinc-300 px-2 py-1 focus:border-primary outline-none bg-transparent" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700 leading-relaxed">
                                        <span>Resident of</span>
                                        <input type="text" className="flex-[2] min-w-[300px] border-b-2 border-zinc-300 px-2 py-1 focus:border-primary outline-none bg-transparent" />
                                        <span>holding C.N.I.C. #</span>
                                        <input type="text" className="flex-1 min-w-[150px] border-b-2 border-zinc-300 px-2 py-1 focus:border-primary outline-none bg-transparent placeholder-zinc-300" placeholder="00000-0000000-0" />
                                    </div>
                                    <div className="bg-primary/5 text-primary border border-primary/20 p-4 rounded-lg text-sm mt-4">
                                        <p className="font-medium">Hereby solemnly declare and affirm that:</p>
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            <li>I take full responsibility for the contents of this declaration and the accuracy of the information provided in this form.</li>
                                            <li>I will abide by all rules, policies, and regulations of The American Foundation School currently in force or as amended from time to time.</li>
                                            <li>I will ensure timely payment of all school dues.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Signatures */}
                            <section>
                                <div className="border-b border-zinc-200 pb-3 mb-5 mt-8">
                                    <h3 className="text-base font-medium text-zinc-900">Signatures</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="border border-zinc-200 rounded-lg p-4 flex flex-col items-center justify-center bg-white h-32">
                                        <div className="flex-1 w-full border-b border-dashed border-zinc-300 flex items-end justify-center pb-2">
                                            <span className="text-zinc-300 italic">Signature</span>
                                        </div>
                                        <p className="text-xs font-medium text-zinc-600 mt-3 uppercase tracking-wider">Father&apos;s Signature</p>
                                    </div>
                                    <div className="border border-zinc-200 rounded-lg p-4 flex flex-col items-center justify-center bg-white h-32">
                                        <div className="flex-1 w-full border-b border-dashed border-zinc-300 flex items-end justify-center pb-2">
                                            <span className="text-zinc-300 italic">Signature</span>
                                        </div>
                                        <p className="text-xs font-medium text-zinc-600 mt-3 uppercase tracking-wider">Mother&apos;s Signature</p>
                                    </div>
                                    <div className="border border-zinc-200 rounded-lg p-4 flex flex-col items-center justify-center bg-zinc-50 h-32">
                                        <div className="flex-1 w-full border-b border-dashed border-zinc-300 flex items-end justify-center pb-2">
                                            <span className="text-zinc-300 italic">Signature</span>
                                        </div>
                                        <p className="text-xs font-medium text-zinc-600 mt-3 uppercase tracking-wider">Guardian&apos;s Signature</p>
                                    </div>
                                </div>
                                <div className="mt-6 w-full sm:w-1/3">
                                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Date of Signing</label>
                                    <input type="date" className="w-full px-3 py-2 border border-zinc-300 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                                </div>
                            </section>
                        </div>
                    )}

                    {/* -- PAGE 5: OFFICE USE ONLY -- */}
                    {currentStep === 5 && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center mb-6">
                                <h2 className="text-lg font-bold text-red-700 uppercase tracking-widest">For Office Use Only</h2>
                                <p className="text-sm text-red-600">Do not fill if you are a parent/candidate.</p>
                            </div>

                            {/* Interviewer */}
                            <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2 mb-4">To Be Filled By The Interviewer</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Date</label><input type="date" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Class/Level Recommended</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-zinc-700 mb-1">Remarks</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                </div>
                                <div className="mt-4 flex gap-4">
                                    <input type="text" className="flex-1 px-2 py-1.5 text-sm border-b border-zinc-300 mt-4 focus:outline-none focus:border-primary" placeholder="Interviewer's Name" />
                                    <div className="flex-1 text-center border-t border-zinc-300 mt-8 pt-1 text-xs text-zinc-500">Signature</div>
                                </div>
                            </section>

                            {/* Admission Order */}
                            <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2 mb-4">Admission Order</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Found fit for Class/Level</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Section</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-zinc-700 mb-1">Admin Remarks</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-6 mt-10">
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Accountant</div>
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Directress Admin & P-G</div>
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Directress Finance</div>
                                </div>
                            </section>

                            {/* Accounts */}
                            <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                                <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2 mb-4">To Be Filled By The Accounts Department</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2"><label className="block text-xs font-medium text-zinc-700 mb-1">Candidate&apos;s Name</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded bg-zinc-50" readOnly /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Class/Section</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div className="md:col-span-3"><label className="block text-xs font-medium text-zinc-700 mb-1">Father&apos;s Name</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded bg-zinc-50" readOnly /></div>

                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Registration #</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded bg-zinc-50" readOnly /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Computer Code #</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded bg-zinc-50" readOnly /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">G.R. #</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>

                                    <div className="md:col-span-3 border-t border-zinc-100 mt-2 pt-4"><label className="block text-xs font-medium text-zinc-700 mb-1">Link to G.R. # (If sibling)</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>

                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Challan #</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Amount in Figures</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" placeholder="₨" /></div>
                                    <div><label className="block text-xs font-medium text-zinc-700 mb-1">Dated</label><input type="date" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                    <div className="md:col-span-3"><label className="block text-xs font-medium text-zinc-700 mb-1">Amount in Words</label><input type="text" className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Admission Registrar</div>
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Accountant</div>
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs text-zinc-500">Posted By</div>
                                    <div className="text-center border-t border-zinc-300 pt-1 text-xs font-medium text-primary">Head of Institution</div>
                                </div>
                            </section>

                        </div>
                    )}

                </div>
                {/* Wizard Footer (Sticky controls) */}
                {submitError && (
                    <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-sm text-red-600 flex items-start sm:items-center">
                        <span className="shrink-0 mr-2 mt-0.5 sm:mt-0 font-medium whitespace-nowrap">Submission Failed:</span>
                        <span>{submitError}</span>
                    </div>
                )}
                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={isFirstStep}
                        className={`inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-all ${isFirstStep ? 'border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed' : 'border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900 active:scale-95'}`}
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
                            disabled={isSubmitting}
                            className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-75 disabled:cursor-wait"
                        >
                            {isSubmitting ? "Submitting..." : (
                                <>
                                    <Save className="h-4 w-4 mr-2" /> Submit Application
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>

            {submitSuccess && (
                <StudentProfileModal
                    student={submitSuccess}
                    onClose={() => setSubmitSuccess(null)}
                />
            )}
        </div>
    );
}
