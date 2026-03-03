"use client";

import { useState } from "react";

export function RegistrationForm() {
    const [formData, setFormData] = useState({
        serialNo: "",
        registrationNo: "",
        computerCodeNo: "",
        grNo: "",
        candidateName: "",
        fatherName: "",
        motherName: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        nationalityPakistani: true,
        nationalityOther: "",
        gender: "",
        religion: "",
        identificationMarks: "",
        birthCountry: "",
        birthProvince: "",
        birthCity: "",
        ageYears: "",
        ageMonths: "",
        ageDays: "",
        previousSchools: [{ id: 1, name: "", location: "", levelStudied: "", reasonForLeaving: "" }],
        admissionSystem: "",
        admissionLevel: "",
        houseNo: "",
        areaBlock: "",
        city: "",
        postalCode: "",
        province: "",
        country: "",
        homePhone: "",
        candidatePhone: "",
        candidateEmail: "",
        fatherPhone: "",
        fatherEmail: "",
        fatherFax: "",
        motherPhone: "",
        motherEmail: "",
        motherFax: "",
        emergencyContactName: "",
        emergencyContactNumber: "",
        emergencyRelationship: "",
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

    return (
        <div className="max-w-4xl mx-auto bg-white  border border-zinc-200  rounded-2xl shadow-sm overflow-hidden mb-10">

            {/* Form Header */}
            <div className="bg-primary px-6 py-8 text-center text-white">
                <h1 className="text-2xl font-bold tracking-tight">THE AMERICAN FOUNDATION SCHOOL</h1>
                <h2 className="text-xl font-semibold mt-1 opacity-90">APPLICATION FOR REGISTRATION</h2>
                <div className="inline-block mt-3 px-4 py-1 bg-white/20 rounded-full text-sm font-medium tracking-widest border border-white/30 shadow-inner">
                    FORM # 1
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-12">

                {/* OFFICE HEADERS & PHOTOGRAPHS */}
                <div className="flex flex-col md:flex-row gap-8 items-start border-b border-zinc-100  pb-10">

                    <div className="flex-1 space-y-4">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 border-l-2 border-secondary pl-3">Official Records</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Serial #</label>
                                <input type="text" name="serialNo" value={formData.serialNo} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Registration #</label>
                                <input type="text" name="registrationNo" value={formData.registrationNo} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Computer Code #</label>
                                <input type="text" name="computerCodeNo" value={formData.computerCodeNo} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">G.R. #</label>
                                <input type="text" name="grNo" value={formData.grNo} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 flex-wrap justify-center">
                        <div className="flex flex-col items-center">
                            <div className="w-[1.5in] h-[2in] bg-zinc-100  border-2 border-dashed border-zinc-300  flex items-center justify-center text-zinc-400 text-xs text-center p-2 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
                                Candidate's Recent Photograph <br />(1.5" x 2" Light Blue BG)
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-[1.5in] h-[2in] bg-zinc-100  border-2 border-dashed border-zinc-300  flex items-center justify-center text-zinc-400 text-xs text-center p-2 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
                                Father's Recent Photograph <br />(1.5" x 2")
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-[1.5in] h-[2in] bg-zinc-100  border-2 border-dashed border-zinc-300  flex items-center justify-center text-zinc-400 text-xs text-center p-2 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
                                Mother's Recent Photograph <br />(1.5" x 2")
                            </div>
                        </div>
                    </div>
                </div>

                {/* PERSONAL DATA */}
                <section className="space-y-6">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-l-2 border-secondary pl-3">Personal Data</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700  mb-1">Candidate's Full Name (BLOCK LETTERS)</label>
                            <input type="text" name="candidateName" value={formData.candidateName} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none uppercase font-semibold" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Father's Name</label>
                                <input type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none uppercase" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Mother's Name</label>
                                <input type="text" name="motherName" value={formData.motherName} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none uppercase" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-zinc-50/50  p-4 rounded-xl border border-zinc-100 ">
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-xs font-semibold text-zinc-700  mb-2">Date of Birth</label>
                                <div className="flex gap-2">
                                    <input type="number" placeholder="DD" name="dobDay" value={formData.dobDay} onChange={handleInputChange} className="w-16 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none" />
                                    <input type="number" placeholder="MM" name="dobMonth" value={formData.dobMonth} onChange={handleInputChange} className="w-16 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none" />
                                    <input type="number" placeholder="YYYY" name="dobYear" value={formData.dobYear} onChange={handleInputChange} className="flex-1 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                            </div>
                            <div className="col-span-12 md:col-span-8">
                                <label className="block text-xs font-semibold text-zinc-700  mb-2">Age at the Time of Registration</label>
                                <div className="flex gap-4 items-center">
                                    <div className="flex items-center gap-2">
                                        <input type="number" name="ageYears" value={formData.ageYears} onChange={handleInputChange} className="w-16 px-3 py-2 border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none bg-white " />
                                        <span className="text-sm text-zinc-500">Years</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" name="ageMonths" value={formData.ageMonths} onChange={handleInputChange} className="w-16 px-3 py-2 border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none bg-white " />
                                        <span className="text-sm text-zinc-500">Months</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" name="ageDays" value={formData.ageDays} onChange={handleInputChange} className="w-16 px-3 py-2 border border-zinc-200  rounded-lg text-center text-sm focus:ring-2 focus:ring-primary outline-none bg-white " />
                                        <span className="text-sm text-zinc-500">Days</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-2">Nationality</label>
                                <div className="flex items-center space-x-4 mb-2">
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input type="radio" name="nationalityPakistani" checked={formData.nationalityPakistani} onChange={() => setFormData(p => ({ ...p, nationalityPakistani: true }))} className="w-4 h-4 text-primary focus:ring-primary" />
                                        <span>Pakistani</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input type="radio" name="nationalityPakistani" checked={!formData.nationalityPakistani} onChange={() => setFormData(p => ({ ...p, nationalityPakistani: false }))} className="w-4 h-4 text-primary focus:ring-primary" />
                                        <span>Other</span>
                                    </label>
                                </div>
                                {!formData.nationalityPakistani && (
                                    <input type="text" placeholder="Specify other nationality" name="nationalityOther" value={formData.nationalityOther} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-2">Gender</label>
                                <div className="flex items-center space-x-4">
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input type="radio" name="gender" value="Male" checked={formData.gender === "Male"} onChange={handleInputChange} className="w-4 h-4 text-primary focus:ring-primary" />
                                        <span>Male</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input type="radio" name="gender" value="Female" checked={formData.gender === "Female"} onChange={handleInputChange} className="w-4 h-4 text-primary focus:ring-primary" />
                                        <span>Female</span>
                                    </label>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-zinc-700  mb-2">Religion</label>
                                <div className="flex flex-wrap items-center gap-4">
                                    {['Muslim', 'Christian', 'Hindu', 'Others'].map(rel => (
                                        <label key={rel} className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="radio" name="religion" value={rel} checked={formData.religion === rel} onChange={handleInputChange} className="w-4 h-4 text-primary focus:ring-primary" />
                                            <span>{rel}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Place of Birth</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Country" name="birthCountry" value={formData.birthCountry} onChange={handleInputChange} className="w-1/3 px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                                    <input type="text" placeholder="Province" name="birthProvince" value={formData.birthProvince} onChange={handleInputChange} className="w-1/3 px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                                    <input type="text" placeholder="City" name="birthCity" value={formData.birthCity} onChange={handleInputChange} className="w-1/3 px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Identification Mark(s)</label>
                                <input type="text" name="identificationMarks" value={formData.identificationMarks} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>

                    </div>
                </section>

                {/* PREVIOUS SCHOOLING */}
                <section className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-l-2 border-secondary pl-3">Previous Schooling Details</h3>
                        <span className="text-xs text-zinc-400 italic">Starting with the last school attended</span>
                    </div>

                    <div className="rounded-xl border border-zinc-200  overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50  border-b border-zinc-200 ">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">S. No</th>
                                        <th className="px-4 py-3 font-semibold">Name of School</th>
                                        <th className="px-4 py-3 font-semibold">Location</th>
                                        <th className="px-4 py-3 font-semibold">Class/Level Studied</th>
                                        <th className="px-4 py-3 font-semibold">Reason for Leaving</th>
                                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.previousSchools.map((school, index) => (
                                        <tr key={school.id} className="border-b border-zinc-100  last:border-0 bg-white ">
                                            <td className="px-4 py-3 text-zinc-500 font-medium">{index + 1}</td>
                                            <td className="px-2 py-2"><input type="text" value={school.name} onChange={(e) => handleSchoolChange(school.id, 'name', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" placeholder="School Name" /></td>
                                            <td className="px-2 py-2"><input type="text" value={school.location} onChange={(e) => handleSchoolChange(school.id, 'location', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" placeholder="City/Area" /></td>
                                            <td className="px-2 py-2"><input type="text" value={school.levelStudied} onChange={(e) => handleSchoolChange(school.id, 'levelStudied', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" placeholder="From - Upto" /></td>
                                            <td className="px-2 py-2"><input type="text" value={school.reasonForLeaving} onChange={(e) => handleSchoolChange(school.id, 'reasonForLeaving', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" placeholder="Reason" /></td>
                                            <td className="px-4 py-3 text-right">
                                                <button type="button" onClick={() => removePreviousSchool(school.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 :bg-red-950/30 transition-colors" disabled={formData.previousSchools.length === 1}>
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-zinc-50  p-3 border-t border-zinc-200  flex justify-center">
                            <button type="button" onClick={addPreviousSchool} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-2">
                                <span className="text-lg leading-none">+</span> Add Another School
                            </button>
                        </div>
                    </div>
                </section>

                {/* ADMISSION REQUIRED IN */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-l-2 border-secondary pl-3">Admission Required In</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-blue-50/50  p-5 rounded-xl border border-blue-100 ">
                            <label className="flex items-center space-x-3 mb-4 cursor-pointer">
                                <input type="radio" name="admissionSystem" value="cambridge" checked={formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="w-5 h-5 text-primary border-zinc-300 focus:ring-primary" />
                                <span className="font-semibold text-primary ">Cambridge GCE O' Level System</span>
                            </label>

                            <div className={`grid grid-cols-3 gap-y-3 gap-x-2 pl-8 transition-opacity ${formData.admissionSystem !== 'cambridge' ? 'opacity-50 pointer-events-none' : ''}`}>
                                {['Pre-Nursery', 'Nursery', 'K.G.', 'JR-I', 'JR-II', 'JR-III', 'JR-IV', 'JR-V', 'SR-I', 'SR-II', 'SR-III', 'O-I', 'O-II', 'O-III'].map(level => (
                                    <label key={level} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-white :bg-zinc-800 p-1 rounded transition-colors">
                                        <input type="radio" name="admissionLevel" value={level} checked={formData.admissionLevel === level && formData.admissionSystem === "cambridge"} onChange={handleInputChange} className="w-4 h-4 text-primary focus:ring-primary" />
                                        <span className="truncate">{level}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-orange-50/50  p-5 rounded-xl border border-orange-100 ">
                            <label className="flex items-center space-x-3 mb-4 cursor-pointer">
                                <input type="radio" name="admissionSystem" value="secondary" checked={formData.admissionSystem === "secondary"} onChange={handleInputChange} className="w-5 h-5 text-secondary border-zinc-300 focus:ring-secondary" />
                                <span className="font-semibold text-secondary ">Secondary System of Studies</span>
                            </label>

                            <div className={`grid grid-cols-2 gap-y-3 gap-x-2 pl-8 transition-opacity ${formData.admissionSystem !== 'secondary' ? 'opacity-50 pointer-events-none' : ''}`}>
                                {['VI', 'VII', 'VIII', 'IX', 'X'].map(level => (
                                    <label key={level} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-white :bg-zinc-800 p-1 rounded transition-colors">
                                        <input type="radio" name="admissionLevel" value={level} checked={formData.admissionLevel === level && formData.admissionSystem === "secondary"} onChange={handleInputChange} className="w-4 h-4 text-secondary focus:ring-secondary" />
                                        <span>{level}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* MAILING ADDRESS & CONTACTS */}
                <section className="space-y-6">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-l-2 border-secondary pl-3">Mailing Address & Contact Details</h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">House / Apartment Name and No.</label>
                                <input type="text" name="houseNo" value={formData.houseNo} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Area and Block # (If any)</label>
                                <input type="text" name="areaBlock" value={formData.areaBlock} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">City</label>
                                <input type="text" name="city" value={formData.city} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Postal Code</label>
                                <input type="text" name="postalCode" value={formData.postalCode} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Province</label>
                                <input type="text" name="province" value={formData.province} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Country</label>
                                <input type="text" name="country" value={formData.country} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700  mb-1">Home Phone #</label>
                                <input type="text" name="homePhone" value={formData.homePhone} onChange={handleInputChange} className="w-full px-3 py-2 bg-zinc-50  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>

                        <div className="mt-8 rounded-xl border border-zinc-200  overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50  border-b border-zinc-200 ">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Contact Person</th>
                                        <th className="px-4 py-3 font-semibold w-1/4">Cellular Phone #</th>
                                        <th className="px-4 py-3 font-semibold w-1/3">E-mail Address</th>
                                        <th className="px-4 py-3 font-semibold w-1/5">Fax #</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-zinc-100  bg-white ">
                                        <td className="px-4 py-3 font-medium text-zinc-700 ">Candidate</td>
                                        <td className="px-2 py-2"><input type="text" name="candidatePhone" value={formData.candidatePhone} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="email" name="candidateEmail" value={formData.candidateEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="text" disabled className="w-full px-2 py-1.5 bg-zinc-50  text-zinc-400 rounded text-sm cursor-not-allowed" placeholder="N/A" /></td>
                                    </tr>
                                    <tr className="border-b border-zinc-100  bg-white ">
                                        <td className="px-4 py-3 font-medium text-zinc-700 ">Father</td>
                                        <td className="px-2 py-2"><input type="text" name="fatherPhone" value={formData.fatherPhone} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="email" name="fatherEmail" value={formData.fatherEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="text" name="fatherFax" value={formData.fatherFax} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                    </tr>
                                    <tr className="bg-white ">
                                        <td className="px-4 py-3 font-medium text-zinc-700 ">Mother</td>
                                        <td className="px-2 py-2"><input type="text" name="motherPhone" value={formData.motherPhone} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="email" name="motherEmail" value={formData.motherEmail} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                        <td className="px-2 py-2"><input type="text" name="motherFax" value={formData.motherFax} onChange={handleInputChange} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-200 :border-zinc-700 focus:border-primary rounded text-sm outline-none transition-colors" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-red-50/50  p-5 rounded-xl border border-red-100  mt-4">
                            <h4 className="text-xs font-bold text-red-600  uppercase tracking-wider mb-3">Emergency Contact Setup</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700  mb-1">Emergency Contact Name & Number</label>
                                    <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} placeholder="Name - Phone" className="w-full px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-700  mb-1">Relationship with Candidate</label>
                                    <input type="text" name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleInputChange} className="w-full px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* SIGNATURES */}
                <section className="pt-6 border-t border-zinc-200 ">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col">
                            <div className="flex-1 h-16 border-b-2 border-dashed border-zinc-300  mb-2 mt-4 relative">
                                <span className="absolute bottom-2 left-0 text-zinc-400 italic text-sm">Sign here</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-700  whitespace-nowrap">Signature of:</span>
                                <select className="px-2 py-1 text-sm bg-zinc-50  border border-zinc-200  rounded-md outline-none focus:ring-1 focus:ring-primary w-full">
                                    <option>Father</option>
                                    <option>Mother</option>
                                    <option>Guardian</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col justify-end">
                            <input type="text" placeholder="Day" className="h-10 border-b-2 border-dashed border-zinc-300  bg-transparent mb-2 outline-none focus:border-primary text-center" />
                            <span className="text-sm font-semibold text-zinc-700  text-center">Day</span>
                        </div>

                        <div className="flex flex-col justify-end">
                            <input type="date" className="h-10 border-b-2 border-dashed border-zinc-300  bg-transparent mb-2 outline-none focus:border-primary text-center text-sm" />
                            <span className="text-sm font-semibold text-zinc-700  text-center">Date</span>
                        </div>
                    </div>
                </section>

                {/* DO NOT WRITE IN THIS SPACE */}
                <section className="mt-12 bg-zinc-100  p-6 rounded-xl border-2 border-dashed border-zinc-300  relative overflow-hidden">
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                        <span className="text-6xl font-black uppercase text-center transform -rotate-12">Office Use Only</span>
                    </div>

                    <h3 className="text-lg font-black text-center uppercase tracking-widest text-zinc-400 mb-6">Do Not Write In This Space</h3>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Test Interview Allocation</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Day" className="w-1/3 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm" />
                                    <input type="date" placeholder="Date" className="w-1/3 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm" />
                                    <input type="time" placeholder="Time" className="w-1/3 px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Test for Level / Class</label>
                                <input type="text" className="w-full px-3 py-2 bg-white  border border-zinc-200  rounded-lg text-sm" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col justify-end pt-2">
                                <div className="h-10 border-b-2 border-zinc-300  bg-transparent mb-1 w-full max-w-[200px]" />
                                <span className="text-xs font-semibold text-zinc-500 uppercase">Admission Registrar</span>
                            </div>

                            <div className="flex gap-8 items-end pt-2">
                                <div className="flex-1">
                                    <div className="h-10 border-b-2 border-zinc-300  bg-transparent mb-1 w-full" />
                                    <span className="text-xs font-semibold text-zinc-500 uppercase">Issuing Authority</span>
                                </div>
                                <div className="flex-1">
                                    <div className="h-10 border-b-2 border-zinc-300  bg-transparent mb-1 w-full" />
                                    <span className="text-xs font-semibold text-zinc-500 uppercase">Date</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div>

            {/* Submit Button Matrix (Admins Only) */}
            <div className="bg-zinc-50  px-6 py-4 border-t border-zinc-200  flex justify-end gap-3">
                <button className="px-5 py-2.5 text-sm font-semibold text-zinc-700  hover:bg-zinc-200 :bg-zinc-800 rounded-lg transition-colors">
                    Save as Draft
                </button>
                <button className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors">
                    Submit Registration
                </button>
            </div>

        </div>
    );
}
