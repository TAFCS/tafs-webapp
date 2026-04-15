"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import AdmissionOrderForm from "@/components/enrollment/AdmissionOrderForm";

interface Props {
    cc: number;
}

export function AdmissionOrderTab({ cc }: Props) {
    const [studentData, setStudentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (cc) fetchData();
    }, [cc]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: res } = await api.get(`/v1/enrollments/${cc}/admission-order`);
            setStudentData(res.data);
        } catch (error) {
            toast.error("Failed to load admission order data");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Order Data...</p>
            </div>
        );
    }

    if (!studentData) return (
        <div className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2 opacity-20" />
            <p className="text-zinc-500 font-bold">Could not load admission order.</p>
        </div>
    );

    return (
        <div className="bg-zinc-50 -m-6 p-6 min-h-screen">
            <AdmissionOrderForm student={studentData} />
        </div>
    );
}
