import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'row', // Horizontal layout for the 3 copies side-by-side
        backgroundColor: '#ffffff',
        padding: 15,
        fontSize: 9,
        fontFamily: 'Helvetica',
    },
    section: {
        flex: 1, // Each copy takes 1/3 of the page horizontally
        paddingHorizontal: 15,
        borderRightWidth: 1, // Vertical separator instead of horizontal dashed border
        borderRightColor: '#e4e4e4',
        borderRightStyle: 'dashed',
    },
    lastSection: {
        borderRightWidth: 0, // Remove right border for the last (3rd) copy
    },
    copyLabel: {
        position: 'absolute',
        right: 15,
        top: 0,
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '2px 8px',
        fontSize: 8,
        fontWeight: 'bold',
        borderRadius: 4,
        transform: 'rotate(0deg)',
        textTransform: 'uppercase',
    },
    header: {
        flexDirection: 'column',
        marginBottom: 5,
        alignItems: 'center',
        textAlign: 'center',
    },
    logo: {
        width: 30,
        height: 30,
        marginBottom: 5,
    },
    schoolInfo: {
        alignItems: 'center',
        marginBottom: 5,
    },
    schoolName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    schoolAddress: {
        fontSize: 7,
        color: '#666666',
        marginTop: 1,
    },
    bankInfo: {
        alignItems: 'center',
    },
    bankName: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    accountNo: {
        fontSize: 7,
        color: '#666666',
        marginTop: 1,
    },
    studentSection: {
        flexDirection: 'column', // Stack vertically instead of row since it's narrower
        backgroundColor: '#f9f9f9',
        padding: 5,
        borderRadius: 8,
        marginBottom: 5,
        borderWidth: 1,
        borderColor: '#efefef',
        gap: 3,
    },
    studentCol: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    label: {
        fontSize: 6,
        textTransform: 'uppercase',
        color: '#999999',
    },
    value: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    datesSection: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Allow wrapping if space is tight
        marginBottom: 5,
        gap: 2,
    },
    dateItem: {
        width: '48%', // Show 2 per row now that columns are narrower
    },
    feeTable: {
        width: '100%',
        marginBottom: 5,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        paddingBottom: 2,
        marginBottom: 2,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 2,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    totalRow: {
        flexDirection: 'row',
        marginTop: 3,
        paddingVertical: 3,
        borderTopWidth: 1,
        borderTopColor: '#333333',
        fontWeight: 'bold',
    },
    colDesc: { flex: 3 },
    colAmount: { flex: 1, textAlign: 'right' },
    instructions: {
        fontSize: 6,
        color: '#888888',
        lineHeight: 1.2,
    },
    bankDetailsSection: {
        marginTop: 10,
        marginBottom: 10,
        padding: 5,
        borderWidth: 1,
        borderColor: '#e4e4e4',
        borderRadius: 6,
    },
    bankDetailsRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    bankDetailsLabel: {
        width: 100,
        fontSize: 7,
        color: '#666666',
        fontWeight: 'bold',
    },
    bankDetailsValue: {
        flex: 1,
        fontSize: 8,
        color: '#1a1a1a',
    },
    footer: {
        marginTop: 15,
        flexDirection: 'column',
    },
    signature: {
        borderTopWidth: 1,
        borderTopColor: '#cccccc',
        width: 100,
        textAlign: 'center',
        paddingTop: 5,
        fontSize: 8,
        color: '#666666',
        alignSelf: 'flex-end',
        marginTop: 20,
    }
});

export interface FeeItem {
    description: string;
    amount: number;
}

interface FeeChallanPDFProps {
    student: {
        cc: number | string;
        student_full_name: string;
        gr_number: string;
        campus: string;
        class_id: number;
        section_id?: number;
        grade_and_section: string;
    };
    details: {
        month: string;
        issueDate: string;
        dueDate: string;
        validityDate: string;
        applyLateFee: boolean;
        bank: {
            name: string;
            title: string;
            account: string;
            branch: string;
            address: string;
            iban: string;
        }
    };
    fees: FeeItem[];
    totalAmount: number;
    siblings?: { full_name: string; gr_number: string; }[];
}

const ChallanCopy = ({ copyType, student, details, fees, totalAmount, siblings, isLast }: { copyType: string, isLast?: boolean } & FeeChallanPDFProps) => (
    <View style={[styles.section, isLast ? styles.lastSection : {}]}>
        <Text style={styles.copyLabel}>{copyType}</Text>

        <View style={styles.header}>
            <Image src="/logo.png" style={styles.logo} />
            <View style={styles.schoolInfo}>
                <Text style={styles.schoolName}>THE AMERICAN FOUNDATION SCHOOL</Text>
                <Text style={styles.schoolAddress}>{student.campus || "Main Campus"}</Text>
            </View>
        </View>

        <View style={styles.studentSection}>
            <View style={styles.studentCol}>
                <Text style={styles.label}>Student Name</Text>
                <Text style={styles.value}>{student.student_full_name}</Text>
            </View>
            <View style={styles.studentCol}>
                <Text style={styles.label}>Class / Section</Text>
                <Text style={styles.value}>{student.grade_and_section}</Text>
            </View>
            <View style={styles.studentCol}>
                <Text style={styles.label}>CC ID / GR No.</Text>
                <Text style={styles.value}>CC-{student.cc} / {student.gr_number}</Text>
            </View>
        </View>

        <View style={[styles.studentSection, { backgroundColor: '#ffffff', borderColor: '#d1d5db' }]}>
            <View style={styles.datesSection}>
                <View style={styles.dateItem}>
                    <Text style={styles.label}>Billing Month</Text>
                    <Text style={styles.value}>{details.month} 2026</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={styles.label}>Issue Date</Text>
                    <Text style={styles.value}>{details.issueDate}</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={styles.label}>Due Date</Text>
                    <Text style={styles.value}>{details.dueDate}</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={styles.label}>Valid Till</Text>
                    <Text style={[styles.value, { color: '#e11d48' }]}>{details.validityDate}</Text>
                </View>
            </View>
        </View>

        <View style={[styles.studentSection, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Collection Bank:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.name}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Account Title:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.title}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Account No:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.account}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Branch Code:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.branch}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>IBAN:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.iban}</Text>
            </View>
        </View>

        <View style={[styles.feeTable, { marginTop: 5 }]}>
            <View style={styles.tableHeader}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Description</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>Amount (PKR)</Text>
            </View>
            {fees.map((fee, idx) => (
                <View key={idx} style={styles.tableRow}>
                    <Text style={styles.colDesc}>{fee.description}</Text>
                    <Text style={styles.colAmount}>{fee.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
            ))}
            {details.applyLateFee && (
                <View style={styles.tableRow}>
                    <Text style={styles.colDesc}>Late Payment Surcharge</Text>
                    <Text style={styles.colAmount}>{(500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
            )}
            <View style={styles.totalRow}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>NET PAYABLE AMOUNT</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold', fontSize: 12 }]}>
                    {(totalAmount + (details.applyLateFee ? 500 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
            </View>
        </View>

        <View style={styles.footer}>
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.instructions, { fontStyle: 'normal', fontWeight: 'bold' }]}>
                    MBL CODE: TAFCS
                </Text>
                <Text style={[styles.instructions, { fontStyle: 'normal', fontWeight: 'bold', marginTop: 2 }]}>NOTE:</Text>
                <Text style={styles.instructions}>
                    {"• "} Only Cash & MBL Cheque/Pay order will be accepted.{"\n"}
                    {"• "} After Due Date student will pay PKR 1000/- as charity on late deposit.{"\n"}
                    {"• "} The additional amount collected after due date will be donated for Charitable purpose.{"\n"}
                    {"• "} Admission and Tuition Fee once paid are non-refundable.
                </Text>
                <Text style={[styles.instructions, { fontStyle: 'normal', fontWeight: 'bold', marginTop: 3 }]}>Payment Options:</Text>
                <Text style={styles.instructions}>
                    For MBL Counters:{"\n"}
                    Pay via CMS Online Deposit Module — Customer Code: TAFCS{"\n"}
                    For Payment via MBL Mobile/Internet Banking:{"\n"}
                    Select School as beneficiary from Biller Option and Pay.{"\n"}
                    For Payment via Any Other Bank Counter/Digital Channel:{"\n"}
                    Payment via 1Bill Invoices option using 24-digit 1Bill Invoice No.
                </Text>
            </View>
        </View>
        <View style={styles.signature}>
            <Text>Authorized Signatory</Text>
        </View>
    </View>
);

export const FeeChallanPDF = ({ student, details, fees, totalAmount, siblings }: FeeChallanPDFProps) => (
    <Document>
        <Page size={[841.89, 595.28]} wrap={false} style={styles.page}>
            {/* Left 85% for the 3 Challan Copies */}
            <View style={{ width: '85%', flexDirection: 'row' }}>
                <ChallanCopy copyType="Bank Copy" student={student} details={details} fees={fees} totalAmount={totalAmount} siblings={siblings} />
                <ChallanCopy copyType="School Copy" student={student} details={details} fees={fees} totalAmount={totalAmount} siblings={siblings} />
                <ChallanCopy copyType="Student Copy" student={student} details={details} fees={fees} totalAmount={totalAmount} siblings={siblings} isLast={true} />
            </View>

            {/* Right 15% for the 4th Column */}
            <View style={{ width: '15%', paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: '#e4e4e4', borderLeftStyle: 'solid', flexDirection: 'column', height: '100%' }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 10, textTransform: 'uppercase' }}>Future Features</Text>
                <View style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, flex: 1 }}>
                    <Text style={{ fontSize: 8, color: '#64748b', lineHeight: 1.4, textAlign: 'center', marginTop: 20 }}>
                        This column will contain sibling data, payment history and discount breakdowns.
                    </Text>
                </View>
            </View>
        </Page>
    </Document>
);
