import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
            {/* Left side: Branding (Split Screen design) */}
            <div className="hidden md:flex flex-col justify-center items-center bg-zinc-900 text-white p-12 relative overflow-hidden">
                {/* Subtle background gradient for premium feel */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-zinc-900 to-zinc-900"></div>
                <div className="relative z-10 text-center flex flex-col items-center">
                    {/* Logo */}
                    <div className="mb-8">
                        <Image
                            src="/logo.png"
                            alt="TAFS Logo"
                            width={120}
                            height={120}
                            className="object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                            priority
                        />
                    </div>
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">TAFS ERP</h1>
                    <p className="text-zinc-400 text-lg max-w-sm">The American Foundation School Digital Transformation</p>
                </div>
            </div>

            {/* Right side: Auth Form Content */}
            <div className="flex flex-col justify-center items-center p-8 bg-white ">
                {/* Logo visible on mobile (left panel is hidden) */}
                <div className="md:hidden mb-8">
                    <Image
                        src="/logo.png"
                        alt="TAFS Logo"
                        width={80}
                        height={80}
                        className="object-contain"
                        priority
                    />
                </div>
                {children}
            </div>
        </div>
    );
}
