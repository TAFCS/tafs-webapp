import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';

export interface LeavingCertificateData {
    header_title?: string;
    header_prefix?: string;
    slc_number?: string;
    cc?: number;
    gr_number?: string;
    name?: {
        last?: string;
        first?: string;
        middle?: string;
    };
    father_name?: {
        last?: string;
        first?: string;
        middle?: string;
    };
    dob?: {
        month?: string;
        day?: string;
        year?: string;
    };
    place_of_birth?: {
        country?: string;
        province?: string;
        city?: string;
    };
    nationality?: string;
    gender?: string;
    religion?: string;
    identification_marks?: string;
    last_school_attended?: string;
    date_of_admission?: {
        month?: string;
        day?: string;
        year?: string;
    };
    scholastic_year_admitted?: {
        from?: string;
        to?: string;
    };
    class_admitted?: string;
    present_level?: string;
    section?: string;
    scholastic_year_present?: {
        from?: string;
        to?: string;
    };
    last_date_of_attendance?: {
        month?: string;
        day?: string;
        year?: string;
    };
    reason_for_leaving?: string;
    result_scholastic_year?: {
        from?: string;
        to?: string;
    };
    passed_promoted_level?: string;
    passed_promoted_year?: {
        from?: string;
        to?: string;
    };
    resit_subjects?: string;
    detained_level?: string;
    detained_year?: {
        from?: string;
        to?: string;
    };
    school_dues?: string;
    remarks?: string;
    prepared_by?: string;
    rechecked_by?: string;
    posted_by?: string;
    class_teacher?: string;
    programme_directress?: string;
    day?: string;
    date?: string;
    photograph_url?: string | null;
    campus_address?: string;
}

const styles = StyleSheet.create({
    page: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 30,
        paddingRight: 30,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        fontSize: 8.5,
        color: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    docTitleContainer: {
        alignItems: 'center',
        marginVertical: 4,
    },
    docTitle: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        textDecoration: 'underline',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    mainGrid: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#000000',
        minHeight: 620,
    },
    leftSidebar: {
        width: 125,
        borderRightWidth: 1,
        borderRightColor: '#000000',
        padding: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sidebarBoxGroup: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 14,
    },
    sidebarLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 3,
        textAlign: 'center',
    },
    sidebarValueBox: {
        borderWidth: 1,
        borderColor: '#000000',
        width: '100%',
        paddingVertical: 5,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    sidebarValueText: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
    },
    photoBox: {
        width: 105,
        height: 140,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        backgroundColor: '#fafafa',
        marginTop: 'auto',
    },
    photoImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    photoPlaceholderText: {
        fontSize: 7.5,
        textAlign: 'center',
        color: '#444444',
        paddingHorizontal: 8,
        lineHeight: 1.3,
    },
    rightContent: {
        flex: 1,
        padding: 8,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 4.5,
    },
    fieldLabel: {
        fontSize: 8.5,
        fontFamily: 'Helvetica',
        marginRight: 4,
    },
    underlinedValueContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginHorizontal: 3,
    },
    underlinedValue: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingHorizontal: 8,
        paddingBottom: 1,
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        minWidth: 50,
    },
    subLabel: {
        fontSize: 6.5,
        color: '#333333',
        marginTop: 1.5,
        textAlign: 'center',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 4,
    },
    checkbox: {
        width: 9,
        height: 9,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 3,
    },
    checkboxTick: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        marginTop: -1,
    },
    checkboxLabel: {
        fontSize: 8.5,
        marginRight: 12,
    },
    lineFill: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        flex: 1,
        paddingBottom: 1,
        paddingLeft: 4,
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
    },
    squareBox: {
        borderWidth: 1,
        borderColor: '#000000',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        minWidth: 26,
        textAlign: 'center',
    },
    signaturesSection: {
        marginTop: 18,
        paddingTop: 4,
    },
    sigRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginVertical: 4,
    },
    sigField: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    sigLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        width: 100,
        textAlign: 'center',
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        paddingBottom: 1,
    },
    disclaimerText: {
        fontSize: 8,
        fontFamily: 'Helvetica-Oblique',
        textAlign: 'center',
        marginTop: 12,
    },
    footer: {
        marginTop: 10,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 7.5,
        textAlign: 'center',
        color: '#111111',
        lineHeight: 1.3,
    },
});

export const LeavingCertificatePDF = ({ data }: { data: LeavingCertificateData }) => {
    const g = (data.gender || 'MALE').trim().toUpperCase();
    const isMale = g === 'MALE' || g === 'M';
    const isFemale = g === 'FEMALE' || g === 'F';

    const religionStr = (data.religion || 'MUSLIM').trim().toUpperCase();
    const isMuslim = religionStr === 'MUSLIM' || religionStr === 'ISLAM';
    const isChristian = religionStr === 'CHRISTIAN' || religionStr === 'CHRISTIANITY';
    const isOtherReligion = Boolean(religionStr) && !isMuslim && !isChristian;

    return (
        <Document title={`TAFS_Leaving_Certificate_${data.cc || ''}`}>
            <Page size="A4" style={styles.page}>
                {/* Header Logos */}
                <View style={styles.header}>
                    <View style={{ width: 120, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1a365d' }}>
                          THE AMERICAN FOUNDATION SCHOOL
                        </Text>
                    </View>
                    <View style={{ width: 140, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a365d' }}>
                          THE AMERICAN FOUNDATION
                        </Text>
                    </View>
                </View>

                {/* Title */}
                <View style={styles.docTitleContainer}>
                    <Text style={styles.docTitle}>{data.header_title || 'TAFS LEAVING CERTIFICATE'}</Text>
                </View>

                {/* Main Grid Container */}
                <View style={styles.mainGrid}>
                    {/* Left Sidebar */}
                    <View style={styles.leftSidebar}>
                        <View style={{ width: '100%' }}>
                            {/* SLC # Box */}
                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>S. L. C. #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>{data.slc_number || '—'}</Text>
                                </View>
                            </View>

                            {/* GR # Box */}
                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>G. R. #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>{data.gr_number || '—'}</Text>
                                </View>
                            </View>

                            {/* Computer Code # Box */}
                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>Computer Code #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>
                                        {`${data.header_prefix || 'TAF'}/SLC  ${data.cc || '—'}`}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Photograph Box */}
                        <View style={styles.photoBox}>
                            {data.photograph_url ? (
                                <Image src={data.photograph_url} style={styles.photoImage} />
                            ) : (
                                <Text style={styles.photoPlaceholderText}>Recent photograph{'\n'}1.5" x 2"</Text>
                            )}
                        </View>
                    </View>

                    {/* Right Content Area */}
                    <View style={styles.rightContent}>
                        {/* Name */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Name :</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 90 }]}>{data.name?.last || '—'}</Text>
                                <Text style={styles.subLabel}>Last</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 90 }]}>{data.name?.first || '—'}</Text>
                                <Text style={styles.subLabel}>First</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 90 }]}>{data.name?.middle || '—'}</Text>
                                <Text style={styles.subLabel}>Middle</Text>
                            </View>
                        </View>

                        {/* Father's Name */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Father's /Guardian's Name</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 80 }]}>{data.father_name?.last || '—'}</Text>
                                <Text style={styles.subLabel}>Last</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 80 }]}>{data.father_name?.first || '—'}</Text>
                                <Text style={styles.subLabel}>First</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 80 }]}>{data.father_name?.middle || '—'}</Text>
                                <Text style={styles.subLabel}>Middle</Text>
                            </View>
                        </View>

                        {/* Date of Birth */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Date of Birth</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 80 }]}>{data.dob?.month || '—'}</Text>
                                <Text style={styles.subLabel}>Month</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 40 }]}>{data.dob?.day || '—'}</Text>
                                <Text style={styles.subLabel}>Day</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 50 }]}>{data.dob?.year || '—'}</Text>
                                <Text style={styles.subLabel}>Year</Text>
                            </View>
                        </View>

                        {/* Place of Birth */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Place of Birth</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 80 }]}>{data.place_of_birth?.country || 'PAKISTAN'}</Text>
                                <Text style={styles.subLabel}>Country</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 70 }]}>{data.place_of_birth?.province || 'SINDH'}</Text>
                                <Text style={styles.subLabel}>Province</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 70 }]}>{data.place_of_birth?.city || 'KARACHI'}</Text>
                                <Text style={styles.subLabel}>City</Text>
                            </View>
                        </View>

                        {/* Nationality */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Nationality</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 140 }]}>{data.nationality || 'PAKISTANI'}</Text>
                                <Text style={styles.subLabel}>Country</Text>
                            </View>
                        </View>

                        {/* Sex */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Sex :</Text>
                            <View style={styles.checkboxRow}>
                                <View style={styles.checkbox}>
                                    {isMale && (
                                        <Svg width="6" height="6" viewBox="0 0 24 24">
                                            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </Svg>
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Male</Text>

                                <View style={styles.checkbox}>
                                    {isFemale && (
                                        <Svg width="6" height="6" viewBox="0 0 24 24">
                                            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </Svg>
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Female</Text>
                            </View>
                        </View>

                        {/* Religion */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Religion :</Text>
                            <View style={styles.checkboxRow}>
                                <View style={styles.checkbox}>
                                    {isMuslim && (
                                        <Svg width="6" height="6" viewBox="0 0 24 24">
                                            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </Svg>
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Muslim</Text>

                                <View style={styles.checkbox}>
                                    {isChristian && (
                                        <Svg width="6" height="6" viewBox="0 0 24 24">
                                            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </Svg>
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Christian</Text>

                                <View style={styles.checkbox}>
                                    {isOtherReligion && (
                                        <Svg width="6" height="6" viewBox="0 0 24 24">
                                            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </Svg>
                                    )}
                                </View>
                                <Text style={styles.fieldLabel}>Others</Text>
                                <Text style={[styles.lineFill, { maxWidth: 90 }]}>
                                    {isOtherReligion ? religionStr : ''}
                                </Text>
                            </View>
                        </View>

                        {/* Mark of Identification */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Mark (s) of Identification</Text>
                            <Text style={styles.lineFill}>{data.identification_marks || '—'}</Text>
                        </View>

                        {/* Last School Attended */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Last School Attended</Text>
                            <Text style={styles.lineFill}>{data.last_school_attended || '—'}</Text>
                        </View>

                        {/* Date of Admission & Scholastic Year Admitted */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Date of Admission</Text>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 60 }]}>{data.date_of_admission?.month || '—'}</Text>
                                <Text style={styles.subLabel}>Month</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 35 }]}>{data.date_of_admission?.day || '—'}</Text>
                                <Text style={styles.subLabel}>Day</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 45 }]}>{data.date_of_admission?.year || '—'}</Text>
                                <Text style={styles.subLabel}>Year</Text>
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Scholastic year</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.scholastic_year_admitted?.from || '—'}</Text>
                            </View>
                            <Text style={{ marginHorizontal: 2 }}>/</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.scholastic_year_admitted?.to || '—'}</Text>
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Class to which he / she was admitted</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.class_admitted || '—'}</Text>
                            </View>
                        </View>

                        {/* Present Level & Section */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Present Level</Text>
                            <Text style={[styles.underlinedValue, { minWidth: 70, marginRight: 10 }]}>{data.present_level || '—'}</Text>
                            <Text style={styles.fieldLabel}>Section</Text>
                            <Text style={[styles.underlinedValue, { minWidth: 50 }]}>{data.section || '—'}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Scholastic year</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.scholastic_year_present?.from || '—'}</Text>
                            </View>
                            <Text style={{ marginHorizontal: 2 }}>/</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.scholastic_year_present?.to || '—'}</Text>
                            </View>
                        </View>

                        {/* Last date of attendance */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Last date of attendance at this school</Text>
                        </View>
                        <View style={[styles.fieldRow, { marginTop: -2 }]}>
                            <View style={[styles.underlinedValueContainer, { marginLeft: 20 }]}>
                                <Text style={[styles.underlinedValue, { minWidth: 70 }]}>{data.last_date_of_attendance?.month || '—'}</Text>
                                <Text style={styles.subLabel}>Month</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 40 }]}>{data.last_date_of_attendance?.day || '—'}</Text>
                                <Text style={styles.subLabel}>Day</Text>
                            </View>
                            <View style={styles.underlinedValueContainer}>
                                <Text style={[styles.underlinedValue, { minWidth: 50 }]}>{data.last_date_of_attendance?.year || '—'}</Text>
                                <Text style={styles.subLabel}>Year</Text>
                            </View>
                        </View>

                        {/* Reason for leaving */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Reason for leaving the school</Text>
                            <Text style={styles.lineFill}>{data.reason_for_leaving || "ON PARENT'S REQUEST"}</Text>
                        </View>

                        {/* Result */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Result at the end of the scholastic year</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.result_scholastic_year?.from || '—'}</Text>
                            </View>
                            <Text style={{ marginHorizontal: 2 }}>/</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.result_scholastic_year?.to || '—'}</Text>
                            </View>
                        </View>

                        <View style={[styles.fieldRow, { paddingLeft: 8 }]}>
                            <Text style={styles.fieldLabel}>a) Passed & promoted to level</Text>
                            <Text style={[styles.underlinedValue, { minWidth: 60 }]}>{data.passed_promoted_level || '—'}</Text>
                            <Text style={[styles.fieldLabel, { marginLeft: 6 }]}>for the scholastic year</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.passed_promoted_year?.from || '—'}</Text>
                            </View>
                            <Text style={{ marginHorizontal: 2 }}>/</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.passed_promoted_year?.to || '—'}</Text>
                            </View>
                        </View>

                        <View style={[styles.fieldRow, { paddingLeft: 8 }]}>
                            <Text style={styles.fieldLabel}>b) He/She has to resit in the following subjects</Text>
                            <Text style={styles.lineFill}>{data.resit_subjects || '—'}</Text>
                        </View>

                        <View style={[styles.fieldRow, { paddingLeft: 8 }]}>
                            <Text style={styles.fieldLabel}>c) Detained in Level</Text>
                            <Text style={[styles.underlinedValue, { minWidth: 50 }]}>{data.detained_level || '—'}</Text>
                            <Text style={[styles.fieldLabel, { marginLeft: 6 }]}>for the scholastic year</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.detained_year?.from || '—'}</Text>
                            </View>
                            <Text style={{ marginHorizontal: 2 }}>/</Text>
                            <View style={styles.squareBox}>
                                <Text>{data.detained_year?.to || '—'}</Text>
                            </View>
                        </View>

                        {/* School Dues */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>School Dues (If any)</Text>
                            <Text style={styles.lineFill}>{data.school_dues || '—'}</Text>
                        </View>

                        {/* Remarks */}
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Remarks</Text>
                            <Text style={styles.lineFill}>{data.remarks || '—'}</Text>
                        </View>

                        {/* Signatures */}
                        <View style={styles.signaturesSection}>
                            <View style={styles.sigRow}>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Prepared by</Text>
                                    <Text style={styles.sigLine}>{data.prepared_by || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Rechecked by</Text>
                                    <Text style={styles.sigLine}>{data.rechecked_by || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Posted by</Text>
                                    <Text style={styles.sigLine}>{data.posted_by || ''}</Text>
                                </View>
                            </View>

                            <View style={styles.sigRow}>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Class Teacher</Text>
                                    <Text style={styles.sigLine}>{data.class_teacher || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Programme Directress</Text>
                                    <Text style={styles.sigLine}>{data.programme_directress || ''}</Text>
                                </View>
                            </View>

                            <View style={styles.sigRow}>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Day</Text>
                                    <Text style={[styles.sigLine, { width: 80 }]}>{data.day || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.fieldLabel}>Date</Text>
                                    <Text style={[styles.sigLine, { width: 120 }]}>{data.date || ''}</Text>
                                </View>
                            </View>

                            <Text style={styles.disclaimerText}>This certificate is issued without alteration or erasure</Text>
                        </View>
                    </View>
                </View>

                {/* Footer Address & Phone Numbers */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {data.campus_address || 'C-61 - 65, Block # 13, Gulistan-e-Jauhar, Karachi, Pakistan.'}
                    </Text>
                    <Text style={styles.footerText}>
                        Hello # : 3463-5481, 3463-5482, 3463-5483, Fax # : (92-21) 3463-5484 E-mail : american@cyber.net.pk
                    </Text>
                </View>
            </Page>
        </Document>
    );
};
