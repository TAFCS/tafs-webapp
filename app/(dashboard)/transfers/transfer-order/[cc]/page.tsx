"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import TransferOrderForm from "@/components/transfer/TransferOrderForm";

export default function TransferOrderPage() {
    const params = useParams();
    const router = useRouter();
    const cc = parseInt(params.cc as string);

    const [studentData, setStudentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!cc) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { data: res } = await api.get(`/v1/transfers/${cc}/transfer-order`);
                setStudentData(res.data);
            } catch {
                toast.error("Failed to load transfer order data");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [cc]);

    if (!cc) return null;

    return (
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-6 w-6 text-zinc-500" />
                </button>
                <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                    Transfer Order{" "}
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-lg text-zinc-400">
                        CC #{cc}
                    </span>
                </h1>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <Loader2 className="h-10 w-10 text-red-600 animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Loading Transfer Order...
                    </p>
                </div>
            ) : !studentData ? (
                <div className="flex flex-col items-center justify-center p-24 text-center bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <AlertCircle className="h-12 w-12 text-rose-400 mb-4 opacity-40" />
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold">
                        Could not load transfer order data.
                    </p>
                </div>
            ) : (
                <TransferOrderForm student={studentData} />
            )}
        </div>
    );
}
