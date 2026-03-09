import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 30,
        fontSize: 9,
        fontFamily: 'Helvetica',
    },
    section: {
        borderBottomWidth: 1,
        borderBottomColor: '#e4e4e4',
        borderBottomStyle: 'dashed',
        marginBottom: 20,
        paddingBottom: 20,
    },
    copyLabel: {
        position: 'absolute',
        right: 0,
        top: 10,
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        alignItems: 'center',
    },
    logo: {
        width: 50,
        height: 50,
    },
    schoolInfo: {
        flex: 1,
        marginLeft: 15,
    },
    schoolName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    schoolAddress: {
        fontSize: 8,
        color: '#666666',
        marginTop: 2,
    },
    bankInfo: {
        textAlign: 'right',
    },
    bankName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    accountNo: {
        fontSize: 8,
        color: '#666666',
        marginTop: 2,
    },
    studentSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#efefef',
    },
    studentCol: {
        flex: 1,
    },
    label: {
        fontSize: 7,
        textTransform: 'uppercase',
        color: '#999999',
        marginBottom: 2,
    },
    value: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    datesSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    dateItem: {
        textAlign: 'center',
        flex: 1,
    },
    feeTable: {
        width: '100%',
        marginBottom: 15,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        paddingBottom: 4,
        marginBottom: 4,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 3,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    totalRow: {
        flexDirection: 'row',
        marginTop: 5,
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: '#333333',
        fontWeight: 'bold',
    },
    colDesc: { flex: 3 },
    colAmount: { flex: 1, textAlign: 'right' },
    instructions: {
        fontSize: 7,
        color: '#888888',
        marginTop: 10,
        fontStyle: 'italic',
    },
    bankDetailsSection: {
        marginTop: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e4e4e4',
        borderRadius: 6,
    },
    bankDetailsRow: {
        flexDirection: 'row',
        marginBottom: 4,
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    signature: {
        borderTopWidth: 1,
        borderTopColor: '#cccccc',
        width: 120,
        textAlign: 'center',
        paddingTop: 5,
        fontSize: 8,
        color: '#666666',
    }
});

interface FeeChallanPDFProps {
    student: {
        cc: number | string;
        student_full_name: string;
        gr_number: string;
        campus: string;
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
}

const ChallanCopy = ({ copyType, student, details }: { copyType: string } & FeeChallanPDFProps) => (
    <View style={styles.section}>
        <Text style={styles.copyLabel}>{copyType}</Text>

        <View style={styles.header}>
            <Image src="/logo.png" style={styles.logo} />
            <View style={styles.schoolInfo}>
                <Text style={styles.schoolName}>TAFSYNC SCHOOL SYSTEM</Text>
                <Text style={styles.schoolAddress}>{student.campus || "Main Campus"} - Karachi, Pakistan</Text>
            </View>
            <View style={styles.bankInfo}>
                <Text style={styles.bankName}>{details.bank.name}</Text>
                <Text style={styles.accountNo}>A/C: {details.bank.account}</Text>
            </View>
        </View>

        <View style={styles.studentSection}>
            <View style={styles.studentCol}>
                <Text style={styles.label}>Student Name</Text>
                <Text style={styles.value}>{student.student_full_name}</Text>
            </View>
            <View style={[styles.studentCol, { alignItems: 'center' }]}>
                <Text style={styles.label}>Class / Section</Text>
                <Text style={styles.value}>{student.grade_and_section}</Text>
            </View>
            <View style={[styles.studentCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.label}>CC ID / GR No.</Text>
                <Text style={styles.value}>CC-{student.cc} / {student.gr_number}</Text>
            </View>
        </View>

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

        <View style={styles.bankDetailsSection}>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Account Title:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.title}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Branch Code:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.branch}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>IBAN:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.iban}</Text>
            </View>
            <View style={styles.bankDetailsRow}>
                <Text style={styles.bankDetailsLabel}>Address:</Text>
                <Text style={styles.bankDetailsValue}>{details.bank.address}</Text>
            </View>
        </View>

        <View style={styles.feeTable}>
            <View style={styles.tableHeader}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Description</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>Amount (PKR)</Text>
            </View>
            <View style={styles.tableRow}>
                <Text style={styles.colDesc}>Monthly Tuition Fee</Text>
                <Text style={styles.colAmount}>8,500.00</Text>
            </View>
            <View style={styles.tableRow}>
                <Text style={styles.colDesc}>Exam Fund</Text>
                <Text style={styles.colAmount}>1,000.00</Text>
            </View>
            {details.applyLateFee && (
                <View style={styles.tableRow}>
                    <Text style={styles.colDesc}>Late Payment Surcharge</Text>
                    <Text style={styles.colAmount}>500.00</Text>
                </View>
            )}
            <View style={styles.totalRow}>
                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>NET PAYABLE AMOUNT</Text>
                <Text style={[styles.colAmount, { fontWeight: 'bold', fontSize: 12 }]}>
                    {details.applyLateFee ? '10,000.00' : '9,500.00'}
                </Text>
            </View>
        </View>

        <View style={styles.footer}>
            <Text style={styles.instructions}>
                * Please pay by the due date to avoid late fee.{"\n"}
                * This is a computer generated document and does not require a stamp.
            </Text>
            <View style={styles.signature}>
                <Text>Authorized Signatory</Text>
            </View>
        </View>
    </View>
);

export const FeeChallanPDF = ({ student, details }: FeeChallanPDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <ChallanCopy copyType="Bank Copy" student={student} details={details} />
            <ChallanCopy copyType="School Copy" student={student} details={details} />
            <ChallanCopy copyType="Student Copy" student={student} details={details} />
        </Page>
    </Document>
);
