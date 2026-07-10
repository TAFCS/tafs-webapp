import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "Privacy Policy for TAFSync — The American Foundation School's digital platform.",
};

const LAST_UPDATED = "July 10, 2026";

function Section({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
                {title}
            </h2>
            <div className="space-y-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {children}
            </div>
        </section>
    );
}

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950">
            {/* Header */}
            <header className="border-b border-zinc-100 dark:border-zinc-900">
                <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
                    <Image
                        src="/logo.png"
                        alt="TAFS Logo"
                        width={36}
                        height={36}
                        className="object-contain"
                    />
                    <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                            The American Foundation School
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                            TAFSync Platform
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                        Last updated: {LAST_UPDATED}
                    </p>
                </div>

                <div className="space-y-10">
                    <Section id="introduction" title="1. Introduction">
                        <p>
                            This Privacy Policy explains how The American Foundation School
                            (&quot;TAFS&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses,
                            discloses, and safeguards information through TAFSync, our school
                            management platform, including the TAFSync web application (accessible at{" "}
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                tafs.edu.pk
                            </span>
                            ) and the TAFSync mobile application (together, the &quot;Platform&quot;).
                        </p>
                        <p>
                            The Platform is used by TAFS students, parents/guardians, teachers,
                            and staff for purposes such as attendance, fee management,
                            communication, academic records, and school administration. By
                            using the Platform, you agree to the collection and use of
                            information in accordance with this policy.
                        </p>
                    </Section>

                    <Section id="who-we-are" title="2. Scope of This Policy">
                        <p>
                            This policy applies to all users of the Platform, including
                            students, parents/guardians, employees (teaching and
                            non-teaching staff), and administrators of TAFS. Where the
                            Platform is used by or on behalf of a minor (a student under 18
                            years of age), the student&apos;s account and related data are
                            managed under the supervision of the school and the student&apos;s
                            parent or guardian, who provides consent on the student&apos;s
                            behalf.
                        </p>
                    </Section>

                    <Section id="information-we-collect" title="3. Information We Collect">
                        <p>We collect the following categories of information:</p>
                        <div className="space-y-4">
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    a. Identity &amp; Contact Information
                                </p>
                                <p>
                                    Full name, date of birth, gender, photograph, phone
                                    number, email address, home address, CNIC/B-Form number,
                                    and emergency contact details for students, parents, and
                                    employees.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    b. Academic &amp; Enrollment Records
                                </p>
                                <p>
                                    Class/section enrollment, academic progression, grades,
                                    attendance records, rollcall/check-in data, and
                                    disciplinary or notice-board communications.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    c. Financial Information
                                </p>
                                <p>
                                    Fee vouchers, payment history, discounts, bank and
                                    postdated cheque details, and other billing records
                                    necessary to manage tuition and fee accounts. We do not
                                    store full payment card numbers; payments are processed
                                    through the relevant bank or payment channel.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    d. Communications
                                </p>
                                <p>
                                    Messages, attachments, and voice notes sent through the
                                    in-app chat and support ticket features, and notifications
                                    sent to your device.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    e. Device, Authentication &amp; Usage Information
                                </p>
                                <p>
                                    Login session data, IP address, device/browser type,
                                    app version, and push-notification tokens. On the mobile
                                    app, if you enable biometric login (fingerprint/face
                                    unlock), the biometric data itself is processed and
                                    stored entirely on your device by your device&apos;s
                                    operating system — TAFS never receives or stores your
                                    biometric data.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    f. Media &amp; Permissions (Mobile App)
                                </p>
                                <p>
                                    With your permission, the mobile app may access your
                                    camera/photo library to upload a profile photo or share
                                    images in chat, and your microphone to record and send
                                    voice notes. These permissions are only used when you
                                    actively choose to use the related feature.
                                </p>
                            </div>
                        </div>
                    </Section>

                    <Section id="how-we-use" title="4. How We Use Your Information">
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Provide, operate, and maintain the Platform&apos;s features (attendance, fees, enrollment, timetables, HR, reporting, etc.);</li>
                            <li>Verify identity and secure accounts, including through login sessions and OTP verification;</li>
                            <li>Facilitate communication between school, staff, students, and parents, including notices, alerts, and support tickets;</li>
                            <li>Process and record fee payments, generate vouchers, and maintain financial records;</li>
                            <li>Track attendance and academic progress;</li>
                            <li>Send service-related push notifications and email/SMS alerts;</li>
                            <li>Maintain the security, integrity, and proper functioning of our systems, including detecting and preventing fraud or misuse; and</li>
                            <li>Comply with applicable legal, regulatory, and educational record-keeping obligations.</li>
                        </ul>
                    </Section>

                    <Section id="sharing" title="5. How We Share Information">
                        <p>
                            We do not sell your personal information. We may share
                            information only in the following circumstances:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Within the school community</span> — e.g., a student&apos;s attendance, fee, or academic data is visible to authorized school staff and the student&apos;s own parent/guardian account;
                            </li>
                            <li>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Service providers</span> — infrastructure, hosting, and notification providers (such as Firebase Cloud Messaging for push notifications) who process data on our behalf and are bound to protect it;
                            </li>
                            <li>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Legal requirements</span> — where required to comply with a legal obligation, court order, or to protect the rights, property, or safety of TAFS, its students, or the public; and
                            </li>
                            <li>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">Business transfers</span> — in connection with a merger, reorganization, or transfer of school operations, subject to continued protection of your data.
                            </li>
                        </ul>
                    </Section>

                    <Section id="cookies" title="6. Cookies &amp; Local Storage">
                        <p>
                            The web application uses a secure, HTTP-only session cookie
                            to keep you signed in; this cookie cannot be read or modified
                            by JavaScript. We may also use local storage on your device to
                            remember preferences such as theme (light/dark mode). We do not
                            use third-party advertising or tracking cookies.
                        </p>
                    </Section>

                    <Section id="security" title="7. Data Security">
                        <p>
                            We implement administrative, technical, and physical
                            safeguards designed to protect your information, including
                            role-based access controls, encrypted transmission (HTTPS),
                            secure httpOnly session cookies, and server-side authorization
                            checks on every request. Access to student, parent, and
                            employee records is restricted to authorized personnel based on
                            their role within the school. While we work hard to protect
                            your data, no method of electronic storage or transmission is
                            100% secure, and we cannot guarantee absolute security.
                        </p>
                    </Section>

                    <Section id="retention" title="8. Data Retention">
                        <p>
                            We retain personal information for as long as necessary to
                            provide the Platform&apos;s services and to fulfil the purposes
                            described in this policy, including satisfying academic
                            record-keeping, financial, and legal requirements. Academic and
                            financial records may be retained beyond the end of enrollment
                            as required by law or school policy. When information is no
                            longer needed, we take reasonable steps to securely delete or
                            anonymize it.
                        </p>
                    </Section>

                    <Section id="children" title="9. Children's Privacy">
                        <p>
                            The Platform is used by students of TAFS, including minors, as
                            part of their enrolment at the school. Student accounts and data
                            are created and managed by the school in cooperation with the
                            student&apos;s parent or guardian. Parents/guardians may contact us
                            at any time (see Section 12) to review, correct, or request
                            deletion of their child&apos;s information, subject to the school&apos;s
                            record-keeping obligations.
                        </p>
                    </Section>

                    <Section id="rights" title="10. Your Rights and Choices">
                        <p>Subject to applicable law, you may:</p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Request access to, or a copy of, the personal information we hold about you;</li>
                            <li>Request correction of inaccurate or incomplete information;</li>
                            <li>Request deletion of your information, where retention is not otherwise required for academic, financial, or legal purposes;</li>
                            <li>Withdraw consent for optional features such as push notifications or biometric login at any time through your device settings; and</li>
                            <li>Object to certain uses of your information by contacting us.</li>
                        </ul>
                        <p>
                            To exercise any of these rights, please contact us using the
                            details in Section 12.
                        </p>
                    </Section>

                    <Section id="third-party" title="11. Third-Party Services">
                        <p>
                            The Platform may use trusted third-party service providers to
                            deliver certain functionality, such as cloud hosting, and push
                            notification delivery (Firebase Cloud Messaging). These
                            providers only process data as necessary to provide their
                            service to us and are contractually obligated to protect it.
                            The Platform does not integrate third-party advertising
                            networks or sell data to data brokers.
                        </p>
                    </Section>

                    <Section id="changes" title="12. Changes to This Policy">
                        <p>
                            We may update this Privacy Policy from time to time to reflect
                            changes in our practices or for legal, operational, or
                            regulatory reasons. We will update the &quot;Last updated&quot;
                            date at the top of this page when we make changes, and, where
                            appropriate, notify users through the Platform.
                        </p>
                    </Section>

                    <Section id="contact" title="13. Contact Us">
                        <p>
                            If you have any questions, concerns, or requests regarding this
                            Privacy Policy or how your information is handled, please
                            contact us at:
                        </p>
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/50">
                            <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                The American Foundation School
                            </p>
                            <p>
                                Email:{" "}
                                <a
                                    href="mailto:info@tafs.edu.pk"
                                    className="text-primary hover:underline"
                                >
                                    info@tafs.edu.pk
                                </a>
                            </p>
                            <p>
                                Website:{" "}
                                <a
                                    href="https://tafs.edu.pk"
                                    className="text-primary hover:underline"
                                >
                                    tafs.edu.pk
                                </a>
                            </p>
                        </div>
                    </Section>
                </div>

                <div className="mt-14 pt-6 border-t border-zinc-100 dark:border-zinc-900">
                    <Link
                        href="/auth/login"
                        className="text-sm text-primary hover:underline"
                    >
                        &larr; Back to sign in
                    </Link>
                </div>
            </main>
        </div>
    );
}
