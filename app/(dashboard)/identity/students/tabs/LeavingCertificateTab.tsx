"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LeavingCertificateForm from "@/components/leaving-certificate/LeavingCertificateForm";

interface Props {
    cc: number;
}

export function LeavingCertificateTab({ cc }: Props) {
    const [certificateData, setCertificateData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (cc) fetchData();
    }, [cc]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: res } = await api.get(`/v1/enrollments/${cc}/leaving-certificate`);
            setCertificateData(res.data);
        } catch (error) {
            toast.error("Failed to load leaving certificate data");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Loader2 className="h-8 w-8 text-red-600 animate-spin mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Leaving Certificate Data...</p>
            </div>
        );
    }

    if (!certificateData) {
        return (
            <div className="p-10 text-center">
                <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2 opacity-20" />
                <p className="text-zinc-500 font-bold">Could not load leaving certificate.</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-950 -m-6 p-6 min-h-screen">
            <LeavingCertificateForm data={certificateData} />
        </div>
    );
}
