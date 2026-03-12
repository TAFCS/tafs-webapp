import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        padding: 10,
        fontSize: 8,
        fontFamily: 'Helvetica',
    },
    section: {
        flex: 1,
        paddingHorizontal: 12,
        borderRightWidth: 1,
        borderRightColor: '#e4e4e4',
        borderRightStyle: 'dashed',
    },
    lastSection: {
        borderRightWidth: 0,
    },
    copyLabel: {
        position: 'absolute',
        right: 12,
        top: -5,
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '1px 5px',
        fontSize: 6,
        fontWeight: 'bold',
        borderRadius: 2,
        textTransform: 'uppercase',
    },
    header: {
        flexDirection: 'column',
        marginBottom: 3,
        alignItems: 'center',
        textAlign: 'center',
    },
    logo: {
        width: 25,
        height: 25,
        marginBottom: 2,
    },
    schoolInfo: {
        alignItems: 'center',
        marginBottom: 3,
    },
    schoolName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1a1a1a',
        letterSpacing: 0.2,
    },
    schoolAddress: {
        fontSize: 6,
        color: '#666666',
        marginTop: 0,
    },
    studentSection: {
        flexDirection: 'column',
        backgroundColor: '#f9f9f9',
        padding: 4,
        borderRadius: 4,
        marginBottom: 4,
        borderWidth: 0.5,
        borderColor: '#efefef',
        gap: 2,
    },
    studentCol: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 5,
        textTransform: 'uppercase',
        color: '#666666',
        fontWeight: 'bold',
    },
    value: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    datesSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
        paddingHorizontal: 2,
    },
    dateItem: {
        width: '24%',
    },
    dateLabel: {
        fontSize: 5,
        color: '#666666',
        textTransform: 'uppercase',
        marginBottom: 1,
    },
    dateValue: {
        fontSize: 6.5,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    feeTable: {
        width: '100%',
        marginBottom: 3,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#333333',
        paddingBottom: 1,
        marginBottom: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 1,
        borderBottomWidth: 0.3,
        borderBottomColor: '#f0f0f0',
    },
    totalRow: {
        flexDirection: 'row',
        marginTop: 2,
        paddingVertical: 2,
        borderTopWidth: 0.5,
        borderTopColor: '#333333',
    },
    colDesc: { flex: 3, fontSize: 6.5 },
    colAmount: { flex: 1, textAlign: 'right', fontSize: 6.5 },
    instructions: {
        fontSize: 5.5,
        color: '#444444',
        lineHeight: 1.1,
    },
    bankDetailsRow: {
        flexDirection: 'row',
        marginBottom: 1,
    },
    bankDetailsLabel: {
        width: 70,
        fontSize: 6,
        color: '#666666',
        fontWeight: 'bold',
    },
    bankDetailsValue: {
        flex: 1,
        fontSize: 6.5,
        color: '#1a1a1a',
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 8,
        flexDirection: 'column',
    },
    signature: {
        borderTopWidth: 0.5,
        borderTopColor: '#cccccc',
        width: 80,
        textAlign: 'center',
        paddingTop: 3,
        fontSize: 7,
        color: '#666666',
        alignSelf: 'flex-end',
        marginTop: 10,
    },
    paymentOptionsTable: {
        width: '100%',
        marginTop: 4,
        borderWidth: 0.5,
        borderColor: '#333333',
    },
    paymentOptionsHeader: {
        padding: 2,
        backgroundColor: '#e2e8f0',
        borderBottomWidth: 0.5,
        borderBottomColor: '#333333',
        fontSize: 5,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    paymentOptionsRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#333333',
    },
    paymentOptionsCol1: {
        flex: 1,
        padding: 2,
        borderRightWidth: 0.5,
        borderRightColor: '#333333',
        fontSize: 4.5,
        justifyContent: 'center',
    },
    paymentOptionsCol2: {
        flex: 1.5,
        padding: 2,
        fontSize: 4.5,
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
        className: string;
        sectionName: string;
        grade_and_section: string;
        gender?: string;
        father_name?: string;
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
    siblings?: {
        full_name: string;
        cc: number | string;
        gr_number: string;
        className: string;
        sectionName: string;
    }[];
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
                <View style={{ flex: 1.5 }}>
                    <Text style={styles.label}>Student Name</Text>
                    <Text style={styles.value}>{student.student_full_name}</Text>
                </View>
                <View style={{ flex: 1.5 }}>
                    <Text style={styles.label}>Father's Name</Text>
                    <Text style={styles.value}>{student.father_name || 'N/A'}</Text>
                </View>
            </View>
            <View style={styles.studentCol}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>CC ID</Text>
                    <Text style={styles.value}>CC-{student.cc}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.label, { textAlign: 'right' }]}>GR No.</Text>
                    <Text style={[styles.value, { textAlign: 'right' }]}>{student.gr_number}</Text>
                </View>
            </View>
            <View style={styles.studentCol}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Class</Text>
                    <Text style={styles.value}>{student.className}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.label}>Gender</Text>
                    <Text style={styles.value}>{student.gender || 'N/A'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.label, { textAlign: 'right' }]}>Section</Text>
                    <Text style={[styles.value, { textAlign: 'right' }]}>{student.sectionName}</Text>
                </View>
            </View>
        </View>

        <View style={[styles.studentSection, { backgroundColor: '#ffffff', borderColor: '#d1d5db', paddingHorizontal: 6 }]}>
            <View style={styles.datesSection}>
                <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Billing</Text>
                    <Text style={styles.dateValue}>{details.month}</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Issue</Text>
                    <Text style={styles.dateValue}>{details.issueDate}</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Due</Text>
                    <Text style={styles.dateValue}>{details.dueDate}</Text>
                </View>
                <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, { textAlign: 'right' }]}>Valid</Text>
                    <Text style={[styles.dateValue, { color: '#e11d48', textAlign: 'right' }]}>{details.validityDate}</Text>
                </View>
            </View>
        </View>

        <View style={[styles.studentSection, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', paddingVertical: 2 }]}>
            <Text style={[styles.value, { textAlign: 'center', fontSize: 7, marginBottom: 1 }]}>Meezan bank limited</Text>
            <Text style={[styles.value, { textAlign: 'center', fontSize: 6, color: '#4b5563', marginBottom: 1 }]}>All meezan bank branches in Pakistan</Text>
            <Text style={[styles.value, { textAlign: 'center', fontSize: 6, color: '#4b5563' }]}>MBL Code: TAFCS</Text>
        </View>

        <View style={[styles.feeTable, { marginTop: 4 }]}>
            <View style={styles.tableHeader}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Description</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>Amount</Text>
            </View>
            {fees.map((fee, idx) => (
                <View key={idx} style={styles.tableRow}>
                    <Text style={styles.colDesc}>{fee.description}</Text>
                    <Text style={styles.colAmount}>{fee.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
            ))}

            <View style={[styles.totalRow, { borderBottomWidth: 0.5, borderBottomColor: '#333333', paddingBottom: 2 }]}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>PAYABLE BY DUE DATE</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold', fontSize: 8 }]}>
                    {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
            </View>

            <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 2 }]}>
                <Text style={styles.colDesc}>Late Payment Surcharge</Text>
                <Text style={styles.colAmount}>{(1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            <View style={[styles.totalRow, { marginTop: 0, paddingTop: 2 }]}>
                <Text style={[styles.colDesc, { fontWeight: 'bold', color: '#e11d48' }]}>PAYABLE AFTER DUE DATE</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold', fontSize: 8, color: '#e11d48' }]}>
                    {(totalAmount + 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
            </View>
        </View>

        <View style={styles.footer}>
            <Text style={{ fontSize: 5, fontWeight: 'bold', marginBottom: 2 }}>NOTE:</Text>
            <Text style={styles.instructions}>1. Only Cash & MBL Cheque/Pay order will be accepted.</Text>
            <Text style={styles.instructions}>2. After Due Date student will pay PKR1000/- as charity on late deposit.</Text>
            <Text style={styles.instructions}>3. The additional amount collected after due date will be donated for Charitable purpose.</Text>
            <Text style={styles.instructions}>4. Admission and Tuition Fee once paid are non-refundable.</Text>

            <View style={styles.paymentOptionsTable}>
                <View style={styles.paymentOptionsHeader}>
                    <Text>Payment Options</Text>
                </View>
                <View style={styles.paymentOptionsRow}>
                    <View style={styles.paymentOptionsCol1}>
                        <Text style={{ fontWeight: 'bold' }}>For MBL Counters</Text>
                    </View>
                    <View style={styles.paymentOptionsCol2}>
                        <Text>Pay via CMS Online Deposit Module.</Text>
                        <Text>Customer Code: TAFCS</Text>
                    </View>
                </View>
                <View style={styles.paymentOptionsRow}>
                    <View style={styles.paymentOptionsCol1}>
                        <Text style={{ fontWeight: 'bold' }}>For Payment via MBL Mobile/internet Banking</Text>
                    </View>
                    <View style={styles.paymentOptionsCol2}>
                        <Text>Select School as beneficiary from Biller Option and Pay</Text>
                    </View>
                </View>
                <View style={[styles.paymentOptionsRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.paymentOptionsCol1}>
                        <Text style={{ fontWeight: 'bold' }}>for Payment via Any Other Bank Counter/Digital Channel</Text>
                    </View>
                    <View style={styles.paymentOptionsCol2}>
                        <Text>Payment via 1 Bill Invoices option using 24 Digit 1 Bill Invoice no.</Text>
                        <Text style={{ fontWeight: 'bold', marginTop: 1 }}>1BILL ID: 1006259110046</Text>
                    </View>
                </View>
            </View>
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
            <View style={{ width: '15%', paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#e4e4e4', borderLeftStyle: 'solid', flexDirection: 'column', height: '100%' }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 5, textTransform: 'uppercase' }}>Siblings Info</Text>
                <View style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 4, flex: 1 }}>
                    {siblings && siblings.length > 0 ? (
                        siblings.map((s, idx) => (
                            <View key={idx} style={{ marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingBottom: 4 }}>
                                <Text style={[styles.value, { fontSize: 7, color: '#0f172a' }]}>{s.full_name}</Text>
                                <View style={{ marginTop: 2, gap: 1 }}>
                                    <Text style={{ fontSize: 5.5, color: '#475569', fontWeight: 'bold' }}>CC ID: {s.cc}</Text>
                                    <Text style={{ fontSize: 5.5, color: '#475569', fontWeight: 'bold' }}>GR NO: {s.gr_number}</Text>
                                    <Text style={{ fontSize: 5.5, color: '#475569', fontWeight: 'bold' }}>{s.className} - {s.sectionName}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={{ fontSize: 6, color: '#64748b', textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
                            No siblings found
                        </Text>
                    )}
                </View>
            </View>
        </Page>
    </Document>
);
