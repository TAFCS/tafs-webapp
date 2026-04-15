import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#000000',
    },
    borderContainer: {
        borderWidth: 1.5,
        borderColor: '#000000',
        padding: 10,
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    logo: {
        width: 60,
        height: 60,
    },
    titleContainer: {
        alignItems: 'center',
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2b5a9e',
        textTransform: 'uppercase',
    },
    schoolName: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#a02020',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginTop: 2,
    },
    campusName: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 5,
        textTransform: 'uppercase',
    },
    topMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 5,
    },
    metricCol: {
        width: '45%',
    },
    metricRow: {
        flexDirection: 'row',
        marginBottom: 4,
        alignItems: 'center',
    },
    metricLabel: {
        fontWeight: 'bold',
        width: 50,
        fontSize: 9,
    },
    metricValue: {
        borderBottomWidth: 0.5,
        borderBottomColor: '#000000',
        flex: 1,
        paddingLeft: 5,
        fontSize: 9,
        minHeight: 12,
    },
    detailsSection: {
        marginTop: 5,
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'center',
    },
    detailLabel: {
        fontWeight: 'bold',
        marginRight: 10,
        fontSize: 9,
    },
    detailValue: {
        borderBottomWidth: 0.5,
        borderBottomColor: '#000000',
        flex: 1,
        paddingLeft: 5,
        fontSize: 9,
        minHeight: 12,
    },
    multiDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 15,
    },
    flexItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkbox: {
        width: 10,
        height: 10,
        borderWidth: 1,
        borderColor: '#000000',
        marginLeft: 5,
    },
    checkboxChecked: {
        backgroundColor: '#000000',
    },
    footer: {
        marginTop: 'auto',
    },
    copiesToList: {
        fontSize: 8,
        fontWeight: 'bold',
        fontStyle: 'italic',
        marginBottom: 10,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 5,
    },
    ccList: {
        fontSize: 8,
        marginBottom: 20,
    },
    signatureSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
    },
    signatureLine: {
        borderTopWidth: 1.5,
        borderColor: '#000000',
        width: 160,
        textAlign: 'center',
        paddingTop: 5,
        alignItems: 'center',
    },
    signatureName: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    signatureTitle: {
        fontSize: 7,
        fontWeight: 'bold',
    },
    stampLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});

export interface AdmissionOrderData {
    day?: string;
    date?: string;
    from?: string;
    reg_number?: string;
    cc: number | string;
    gr_number?: string;
    link_gr_number?: string;
    full_name: string;
    father_name?: string;
    dob?: string;
    gender?: string;
    doa?: string;
    academic_year?: string;
    campus_name?: string;
    class_name?: string;
    section_name?: string;
    remarks?: string;
    address?: string;
    home_phone?: string;
    fax?: string;
    father_cell?: string;
    mother_cell?: string;
    nearest_phone?: string;
    nearest_name?: string;
    relationship?: string;
    email?: string;
    remarks_general?: string;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
    } catch {
        return dateStr;
    }
};

export const AdmissionOrderPDF = ({ data }: { data: AdmissionOrderData }) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.borderContainer}>
                    <View style={styles.header}>
                        <Image src="/logo.png" style={styles.logo} />
                        <View style={styles.titleContainer}>
                            <Text style={[styles.title, { color: '#0047AB' }]}>ADMISSION ORDER</Text>
                            <Text style={styles.schoolName}>The American Foundation School for A Level Studies</Text>
                            <Text style={styles.campusName}>{data.campus_name || '________________'}</Text>
                        </View>
                        <View style={{ width: 60 }} />
                    </View>

                    {/* Top Metrics */}
                    <View style={styles.topMetrics}>
                        <View style={styles.metricCol}>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>DAY :</Text>
                                <Text style={styles.metricValue}>{data.day}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>DATE :</Text>
                                <Text style={styles.metricValue}>{data.date}</Text>
                            </View>
                        </View>
                        <View style={styles.metricCol}>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>REG. # :</Text>
                                <Text style={styles.metricValue}>{data.reg_number}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>C.C. # :</Text>
                                <Text style={styles.metricValue}>{data.cc}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>G.R. # :</Text>
                                <Text style={styles.metricValue}>{data.gr_number}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>LINK TO G.R. # :</Text>
                                <Text style={styles.metricValue}>{data.link_gr_number}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Student Details */}
                    <View style={styles.detailsSection}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>STUDENT'S NAME :</Text>
                            <Text style={styles.detailValue}>{data.full_name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>FATHER'S NAME :</Text>
                            <Text style={styles.detailValue}>{data.father_name}</Text>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>DATE OF BIRTH :</Text>
                                <Text style={styles.detailValue}>{formatDate(data.dob)}</Text>
                            </View>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>GENDER : MALE</Text>
                                <View style={[styles.checkbox, data.gender?.toUpperCase() === 'MALE' ? styles.checkboxChecked : {}]} />
                                <Text style={[styles.detailLabel, { marginLeft: 10 }]}>FEMALE</Text>
                                <View style={[styles.checkbox, data.gender?.toUpperCase() === 'FEMALE' ? styles.checkboxChecked : {}]} />
                            </View>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>DATE OF ADMISSION :</Text>
                                <Text style={styles.detailValue}>{formatDate(data.doa)}</Text>
                            </View>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>SCHOLASTIC YEAR :</Text>
                                <Text style={styles.detailValue}>{data.academic_year}</Text>
                            </View>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.detailLabel}>CLASS IN WHICH ALLOCATED :</Text>
                                <Text style={styles.detailValue}>{data.class_name}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.detailLabel}>SECTION :</Text>
                                <Text style={styles.detailValue}>{data.section_name}</Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>REMARKS :</Text>
                            <Text style={styles.detailValue}>{data.remarks}</Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>PERMANENT ADDRESS # :</Text>
                            <Text style={styles.detailValue}>{data.address}</Text>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>HOME PHONE # :</Text>
                                <Text style={styles.detailValue}>{data.home_phone}</Text>
                            </View>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>FAX # :</Text>
                                <Text style={styles.detailValue}>{data.fax}</Text>
                            </View>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>CELLULAR # ( FATHER'S ) :</Text>
                                <Text style={styles.detailValue}>{data.father_cell}</Text>
                            </View>
                            <View style={styles.flexItem}>
                                <Text style={styles.detailLabel}>CELLULAR # ( MOTHER'S ) :</Text>
                                <Text style={styles.detailValue}>{data.mother_cell}</Text>
                            </View>
                        </View>

                        <View style={styles.multiDetailRow}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.detailLabel}>NEAREST # :</Text>
                                <Text style={styles.detailValue}>{data.nearest_phone}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.detailLabel}>NAME :</Text>
                                <Text style={styles.detailValue}>{data.nearest_name}</Text>
                            </View>
                            <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.detailLabel}>RELATIONSHIP :</Text>
                                <Text style={styles.detailValue}>{data.relationship}</Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>E-MAIL ADDRESS :</Text>
                            <Text style={styles.detailValue}>{data.email}</Text>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.copiesToList}>COPIES TO : PERSONAL FILE / PARENTS / ACCOUNTS DEPARTMENT / SCHOOL LIST</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>REMARKS (IF ANY) :</Text>
                            <Text style={styles.detailValue}>{data.remarks_general}</Text>
                        </View>

                        <View style={styles.ccList}>
                            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>C.C.to;</Text>
                            <Text>C.E.O. & M.D.</Text>
                            <Text>Deputy Directress Admin & P - G.</Text>
                            <Text>Segment Head - ________________</Text>
                        </View>

                        <View style={styles.signatureSection}>
                            <Text style={styles.stampLabel}>School Stamp</Text>
                            <View style={styles.signatureLine}>
                                <Text style={styles.signatureName}>System Analyst</Text>
                            </View>
                            <View style={styles.signatureLine}>
                                <Text style={styles.signatureName}>MRS. FOZIA HUSSAIN</Text>
                                <Text style={styles.signatureTitle}>Directress A. & P. - G</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};
