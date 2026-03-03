export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
            {/* Left side: Branding (Split Screen design) */}
            <div className="hidden md:flex flex-col justify-center items-center bg-zinc-900 text-white p-12 relative overflow-hidden">
                {/* Subtle background gradient for premium feel */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-zinc-900 to-zinc-900"></div>
                <div className="relative z-10 text-center flex flex-col items-center">
                    {/* Logo Placeholder */}
                    <div className="w-16 h-16 bg-blue-600 rounded-xl mb-8 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <span className="text-2xl font-bold">T</span>
                    </div>
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">TAFS ERP</h1>
                    <p className="text-zinc-400 text-lg max-w-sm">The American Foundation School Digital Transformation</p>
                </div>
            </div>

            {/* Right side: Auth Form Content */}
            <div className="flex flex-col justify-center items-center p-8 bg-white dark:bg-black">
                {children}
            </div>
        </div>
    );
}
