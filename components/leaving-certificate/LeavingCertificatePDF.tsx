import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Svg, Path, Font } from '@react-pdf/renderer';

Font.register({
    family: 'Stardos Stencil',
    fonts: [
        {
            src: 'https://fonts.gstatic.com/s/stardosstencil/v15/X7n94bcuGPC8hrvEOHXOgaKCc2TR7w.ttf',
            fontWeight: 'normal',
        },
        {
            src: 'https://fonts.gstatic.com/s/stardosstencil/v15/X7n44bcuGPC8hrvEOHXOgaKCc2TpU3tTvg.ttf',
            fontWeight: 'bold',
        },
    ],
});

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
    logo_url?: string | null;
    right_logo_url?: string | null;
    left_logo_id?: string;
    right_logo_id?: string;
    left_logo_size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';
    right_logo_size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';
    campus_name?: string;
    campus_address?: string;
    selected_campus?: 'AUTO' | 'ALL' | 'JAUHAR' | 'KANEEZ' | 'NAZIMABAD';
}

/** Shared layout constants */
const LAYOUT = {
    contentWidth: 540,
    sidebarWidth: 120,
    fieldGap: 6,
};

const styles = StyleSheet.create({
    page: {
        paddingTop: 10,
        paddingBottom: 8,
        paddingHorizontal: 22,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica-Bold',
        fontSize: 7.5,
        color: '#000000',
        alignItems: 'center',
    },
    contentWrap: {
        width: LAYOUT.contentWidth,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    leftLogoWrap: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    rightLogoWrap: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    docTitleContainer: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 1,
        marginBottom: 4,
    },
    docTitle: {
        fontSize: 13.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        textDecoration: 'underline',
        letterSpacing: 1,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    mainGrid: {
        width: '100%',
        flex: 1,
        flexDirection: 'row',
        borderWidth: 1.2,
        borderColor: '#000000',
        alignItems: 'stretch',
        marginBottom: 3,
    },
    leftSidebar: {
        width: LAYOUT.sidebarWidth,
        borderRightWidth: 1.2,
        borderRightColor: '#000000',
        paddingHorizontal: 6,
        paddingTop: 8,
        paddingBottom: 8,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sidebarBoxGroup: {
        width: '100%',
        alignItems: 'center',
    },
    sidebarLabel: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
        textAlign: 'center',
    },
    sidebarValueBox: {
        borderWidth: 1,
        borderColor: '#000000',
        width: '100%',
        paddingVertical: 3,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    sidebarValueText: {
        fontSize: 9,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 0.8,
    },
    photoBox: {
        width: 96,
        height: 120,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        backgroundColor: '#ffffff',
    },
    photoImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    photoPlaceholderText: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        color: '#000000',
        paddingHorizontal: 4,
        lineHeight: 1.2,
    },
    rightContent: {
        flex: 1,
        paddingHorizontal: 7,
        paddingTop: 4,
        paddingBottom: 4,
        justifyContent: 'space-between',
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 1.5,
    },
    fieldLabelInline: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'left',
        marginRight: 4,
    },
    fieldValuesRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    underlinedCol: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
    },
    underlinedValue: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        width: '100%',
        paddingBottom: 0.5,
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subLabel: {
        fontSize: 6,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        marginTop: 1,
        textAlign: 'center',
    },
    checkboxRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 9,
        height: 9,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    checkboxLabel: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        marginRight: 10,
    },
    lineFill: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        flex: 1,
        paddingBottom: 0.5,
        paddingHorizontal: 2,
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
    },
    squareBox: {
        borderWidth: 1,
        borderColor: '#000000',
        paddingHorizontal: 4,
        paddingVertical: 1,
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        minWidth: 26,
        textAlign: 'center',
    },
    signaturesSection: {
        marginTop: 3,
        paddingTop: 1,
    },
    sigRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginVertical: 1.8,
    },
    sigField: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        flex: 1,
    },
    sigLabel: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        marginRight: 3,
    },
    sigLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        flex: 1,
        textAlign: 'center',
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        paddingBottom: 0.5,
        marginRight: 6,
    },
    disclaimerText: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        marginTop: 3,
        letterSpacing: 0.5,
    },
    footer: {
        marginTop: 3,
        width: '100%',
        alignItems: 'center',
    },
    campusBlock: {
        alignItems: 'center',
        marginBottom: 3,
    },
    addressText: {
        fontSize: 6.5,
        fontFamily: 'Helvetica',
        textAlign: 'center',
        color: '#111111',
        lineHeight: 1.15,
    },
    linkText: {
        fontSize: 6.5,
        fontFamily: 'Helvetica',
        color: '#0055cc',
        textDecoration: 'underline',
    },
});

export function formatGrNumber(val?: string | null): string {
    if (!val) return '—';
    const s = String(val).toUpperCase().trim();
    return s.replace(/\s*-\s*/g, ' - ');
}

export function deepUppercase<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
        if (
            obj.startsWith('data:') ||
            obj.startsWith('http://') ||
            obj.startsWith('https://') ||
            obj.startsWith('/') ||
            obj.endsWith('.png') ||
            obj.endsWith('.jpg') ||
            obj.endsWith('.jpeg')
        ) {
            return obj as any;
        }
        return obj.toUpperCase() as any;
    }
    if (Array.isArray(obj)) {
        return obj.map(deepUppercase) as any;
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            if (
                key === 'photograph_url' ||
                key === 'logo_url' ||
                key === 'right_logo_url' ||
                key === 'left_logo_id' ||
                key === 'right_logo_id' ||
                key === 'left_logo_size' ||
                key === 'right_logo_size' ||
                key === 'selected_campus'
            ) {
                result[key] = (obj as any)[key];
            } else {
                result[key] = deepUppercase((obj as any)[key]);
            }
        }
        return result;
    }
    return obj;
}

export const LeavingCertificatePDF = ({ data: rawData }: { data: LeavingCertificateData }) => {
    const data = deepUppercase(rawData);
    const g = (data.gender || 'MALE').trim().toUpperCase();
    const isMale = g === 'MALE' || g === 'M';
    const isFemale = g === 'FEMALE' || g === 'F';

    const religionStr = (data.religion || 'MUSLIM').trim().toUpperCase();
    const isMuslim = religionStr === 'MUSLIM' || religionStr === 'ISLAM';
    const isChristian = religionStr === 'CHRISTIAN' || religionStr === 'CHRISTIANITY';
    const isOtherReligion = Boolean(religionStr) && !isMuslim && !isChristian;

    const campusChoice = data.selected_campus || 'AUTO';

    let showJauhar = false;
    let showKaneez = false;
    let showNazimabad = false;

    if (campusChoice === 'JAUHAR') {
        showJauhar = true;
    } else if (campusChoice === 'KANEEZ') {
        showKaneez = true;
    } else if (campusChoice === 'NAZIMABAD') {
        showNazimabad = true;
    } else if (campusChoice === 'ALL') {
        showJauhar = true;
        showKaneez = true;
        showNazimabad = true;
    } else {
        const cn = ((data.campus_name || '') + ' ' + (data.campus_address || '')).toUpperCase();
        if (cn.includes('KANEEZ') || cn.includes('HIJRI') || cn.includes('FATIMA')) {
            showKaneez = true;
        } else if (cn.includes('NAZIMABAD') || cn.includes('NORTH')) {
            showNazimabad = true;
        } else if (cn.includes('JAUHAR') || cn.includes('GULISTAN')) {
            showJauhar = true;
        } else {
            showJauhar = true;
            showKaneez = true;
            showNazimabad = true;
        }
    }

    const prefix = (data.header_prefix || 'TAFS').trim().toUpperCase();
    const title = (data.header_title || '').toUpperCase();
    const isTafsal = prefix === 'TAFSAL' || title.includes('TAFSAL');
    const isTafss = prefix === 'TAFSS' || title.includes('TAFSS') || title.includes('SECONDARY');
    const isTafsol = prefix === 'TAFSOL' || title.includes('TAFSOL');

    const classAdmittedLabel = isTafss
        ? 'IN SECONDARY CLASS TO WHICH THE CHILD WAS ADMITTED'
        : isTafsal
        ? 'IN TAFSAL CLASS TO WHICH THE CHILD WAS ADMITTED'
        : isTafsol
        ? 'IN TAFSOL CLASS TO WHICH THE CHILD WAS ADMITTED'
        : 'CLASS TO WHICH THE CHILD WAS ADMITTED';

    const defaultLeftLogo = isTafsal
        ? '/logo-tafsal.png'
        : isTafss
        ? '/logo-tafss.png'
        : isTafsol
        ? '/logo-tafsol.png'
        : '/logo.png';

    const getLeftDims = () => {
        const size = data.left_logo_size || 'MEDIUM';
        switch (size) {
            case 'SMALL':
                return { width: 46, height: 44 };
            case 'LARGE':
                return { width: 75, height: 72 };
            case 'XLARGE':
                return { width: 91, height: 88 };
            case 'MEDIUM':
            default:
                return { width: 60, height: 58 };
        }
    };

    const getRightDims = () => {
        const size = data.right_logo_size || 'MEDIUM';
        const rightId = data.right_logo_id || 'FLAG';
        const isCamb = rightId === 'CAMB';

        switch (size) {
            case 'SMALL':
                return isCamb ? { width: 162, height: 32 } : { width: 133, height: 38 };
            case 'LARGE':
                return isCamb ? { width: 232, height: 46 } : { width: 203, height: 58 };
            case 'XLARGE':
                return isCamb ? { width: 273, height: 54 } : { width: 238, height: 68 };
            case 'MEDIUM':
            default:
                return isCamb ? { width: 192, height: 38 } : { width: 168, height: 48 };
        }
    };

    const leftDims = getLeftDims();
    const rightDims = getRightDims();

    return (
        <Document title={`TAFS_Leaving_Certificate_${data.cc || ''}`}>
            <Page size="A4" style={styles.page}>
                <View style={styles.contentWrap}>
                    {/* Header Logos */}
                    <View style={[styles.header, { minHeight: Math.max(leftDims.height, rightDims.height) + 2 }]}>
                        <View style={[styles.leftLogoWrap, { height: leftDims.height }]}>
                            <Image
                                src={data.logo_url || defaultLeftLogo}
                                style={{ width: leftDims.width, height: leftDims.height, objectFit: 'contain' }}
                            />
                        </View>
                        <View style={[styles.rightLogoWrap, { height: rightDims.height }]}>
                            <Image
                                src={data.right_logo_url || '/logo-each-one-teach-one.png'}
                                style={{ width: rightDims.width, height: rightDims.height, objectFit: 'contain' }}
                            />
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
                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>S. L. C. #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>{data.slc_number || '—'}</Text>
                                </View>
                            </View>

                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>G. R. #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>{formatGrNumber(data.gr_number)}</Text>
                                </View>
                            </View>

                            <View style={styles.sidebarBoxGroup}>
                                <Text style={styles.sidebarLabel}>Computer Code #</Text>
                                <View style={styles.sidebarValueBox}>
                                    <Text style={styles.sidebarValueText}>
                                        {`${data.header_prefix || 'TAF'}/SLC  ${data.cc || '—'}`}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.photoBox}>
                                {data.photograph_url ? (
                                    <Image src={data.photograph_url} style={styles.photoImage} />
                                ) : (
                                    <Text style={styles.photoPlaceholderText}>
                                        RECENT PHOTOGRAPH{'\n'}1.5" X 2"
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Right Content Area */}
                        <View style={styles.rightContent}>
                            {/* 1. NAME */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>NAME :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.name?.last || '—'}</Text>
                                        <Text style={styles.subLabel}>LAST</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.name?.first || '—'}</Text>
                                        <Text style={styles.subLabel}>FIRST</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.name?.middle || '—'}</Text>
                                        <Text style={styles.subLabel}>MIDDLE</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 2. FATHER'S / GUARDIAN'S NAME */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>FATHER'S / GUARDIAN'S NAME :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.father_name?.last || '—'}</Text>
                                        <Text style={styles.subLabel}>LAST</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.father_name?.first || '—'}</Text>
                                        <Text style={styles.subLabel}>FIRST</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.father_name?.middle || '—'}</Text>
                                        <Text style={styles.subLabel}>MIDDLE</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 3. DATE OF BIRTH */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>DATE OF BIRTH :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.dob?.month || '—'}</Text>
                                        <Text style={styles.subLabel}>MONTH</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.dob?.day || '—'}</Text>
                                        <Text style={styles.subLabel}>DAY</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.dob?.year || '—'}</Text>
                                        <Text style={styles.subLabel}>YEAR</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 4. PLACE OF BIRTH */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>PLACE OF BIRTH :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.place_of_birth?.country || 'PAKISTAN'}</Text>
                                        <Text style={styles.subLabel}>COUNTRY</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.place_of_birth?.province || 'SINDH'}</Text>
                                        <Text style={styles.subLabel}>PROVINCE</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.place_of_birth?.city || 'KARACHI'}</Text>
                                        <Text style={styles.subLabel}>CITY</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 5. NATIONALITY */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>NATIONALITY :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.nationality || 'PAKISTANI'}</Text>
                                        <Text style={styles.subLabel}>COUNTRY</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 6. SEX */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>SEX :</Text>
                                <View style={styles.checkboxRow}>
                                    <View style={[styles.checkbox, { marginLeft: 14 }]}>
                                        {isMale && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MALE</Text>

                                    <View style={[styles.checkbox, { marginLeft: 16 }]}>
                                        {isFemale && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>FEMALE</Text>
                                </View>
                            </View>

                            {/* 7. RELIGION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>RELIGION :</Text>
                                <View style={styles.checkboxRow}>
                                    <View style={[styles.checkbox, { marginLeft: 8 }]}>
                                        {isMuslim && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MUSLIM</Text>

                                    <View style={[styles.checkbox, { marginLeft: 12 }]}>
                                        {isChristian && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>CHRISTIAN</Text>

                                    <Text style={[styles.fieldLabelInline, { marginLeft: 12, marginRight: 4 }]}>OTHERS</Text>
                                    <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                        {isOtherReligion ? religionStr : ''}
                                    </Text>
                                </View>
                            </View>

                            {/* 8. MARK (S) OF IDENTIFICATION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>MARK (S) OF IDENTIFICATION :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                    {data.identification_marks || '—'}
                                </Text>
                            </View>

                            {/* 9. LAST SCHOOL ATTENDED */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>LAST SCHOOL ATTENDED :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                    {data.last_school_attended || '—'}
                                </Text>
                            </View>

                            {/* 10. DATE OF ADMISSION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>DATE OF ADMISSION :</Text>
                                <View style={styles.fieldValuesRow}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.date_of_admission?.month || '—'}</Text>
                                        <Text style={styles.subLabel}>MONTH</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.date_of_admission?.day || '—'}</Text>
                                        <Text style={styles.subLabel}>DAY</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.date_of_admission?.year || '—'}</Text>
                                        <Text style={styles.subLabel}>YEAR</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 11. SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.scholastic_year_admitted?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.scholastic_year_admitted?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 12. CLASS TO WHICH THE CHILD WAS ADMITTED */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>{classAdmittedLabel} :</Text>
                                <View style={{ marginLeft: 2 }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.class_admitted || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 13. PRESENT CLASS & SECTION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>PRESENT CLASS :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center', flex: 1, marginRight: 8 }]}>
                                    {data.present_level || '—'}
                                </Text>
                                <Text style={styles.fieldLabelInline}>SECTION :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center', flex: 1 }]}>
                                    {data.section || '—'}
                                </Text>
                            </View>

                            {/* 14. SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.scholastic_year_present?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.scholastic_year_present?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 15. LAST DATE OF ATTENDANCE AT THIS SCHOOL */}
                            <View style={{ marginVertical: 1.5 }}>
                                <Text style={styles.fieldLabelInline}>LAST DATE OF ATTENDANCE AT THIS SCHOOL :</Text>
                                <View style={[styles.fieldValuesRow, { marginTop: 1.5 }]}>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.last_date_of_attendance?.month || '—'}</Text>
                                        <Text style={styles.subLabel}>MONTH</Text>
                                    </View>
                                    <View style={[styles.underlinedCol, { marginRight: LAYOUT.fieldGap }]}>
                                        <Text style={styles.underlinedValue}>{data.last_date_of_attendance?.day || '—'}</Text>
                                        <Text style={styles.subLabel}>DAY</Text>
                                    </View>
                                    <View style={styles.underlinedCol}>
                                        <Text style={styles.underlinedValue}>{data.last_date_of_attendance?.year || '—'}</Text>
                                        <Text style={styles.subLabel}>YEAR</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 16. REASON FOR LEAVING */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>{`REASON FOR LEAVING ${prefix} :`}</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                    {data.reason_for_leaving || "ON PARENT'S REQUEST"}
                                </Text>
                            </View>

                            {/* 17. RESULT AT THE END OF THE SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>RESULT AT THE END OF THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.result_scholastic_year?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.result_scholastic_year?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 18. a ) PASSED & PROMOTED TO CLASS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>a ) PASSED & PROMOTED TO CLASS :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center', flex: 1, marginRight: 6 }]}>
                                    {data.passed_promoted_level || '—'}
                                </Text>
                                <Text style={[styles.fieldLabelInline, { marginRight: 3 }]}>FOR THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.passed_promoted_year?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.passed_promoted_year?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 19. b ) THE CHILD HAS TO RESIT IN THE FOLLOWING SUBJECTS */}
                            <View style={{ marginVertical: 1.2 }}>
                                <View style={styles.fieldRow}>
                                    <Text style={styles.fieldLabelInline}>b ) THE CHILD HAS TO RESIT IN THE FOLLOWING SUBJECTS :</Text>
                                    <Text style={[styles.lineFill, { textAlign: 'center', flex: 1 }]}>
                                        {data.resit_subjects || '—'}
                                    </Text>
                                </View>
                                <View style={[styles.fieldRow, { marginTop: 1.5 }]}>
                                    <Text style={[styles.lineFill, { textAlign: 'center', width: '100%' }]}>
                                        {'—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 20. c ) DETAINED IN CLASS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>c ) DETAINED IN CLASS :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center', flex: 1, marginRight: 6 }]}>
                                    {data.detained_level || '—'}
                                </Text>
                                <Text style={[styles.fieldLabelInline, { marginRight: 3 }]}>FOR THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.squareBox}>
                                        <Text>{data.detained_year?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.detained_year?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 21. TAFS / TAFSS / TAFCS DUES (IF ANY) */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>{`${prefix} DUES (IF ANY) :`}</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                    {data.school_dues || '—'}
                                </Text>
                            </View>

                            {/* 22. REMARKS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>REMARKS :</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>
                                    {data.remarks || '—'}
                                </Text>
                            </View>

                            {/* 23. Signatures Section */}
                            <View style={styles.signaturesSection}>
                                <View style={styles.sigRow}>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>PREPARED BY :</Text>
                                        <Text style={styles.sigLine}>{data.prepared_by || ''}</Text>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>RECHECKED BY :</Text>
                                        <Text style={styles.sigLine}>{data.rechecked_by || ''}</Text>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>POSTED BY :</Text>
                                        <Text style={styles.sigLine}>{data.posted_by || ''}</Text>
                                    </View>
                                </View>

                                <View style={styles.sigRow}>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>LEAD TEACHER :</Text>
                                        <Text style={[styles.sigLine, { width: 120 }]}>{data.class_teacher || ''}</Text>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>PROGRAMME DIRECTRESS :</Text>
                                        <Text style={[styles.sigLine, { width: 120 }]}>{data.programme_directress || ''}</Text>
                                    </View>
                                </View>

                                <View style={[styles.sigRow, { justifyContent: 'space-between', paddingHorizontal: 16 }]}>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>DAY :</Text>
                                        <Text style={[styles.sigLine, { width: 90 }]}>{data.day || ''}</Text>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>DATE :</Text>
                                        <Text style={[styles.sigLine, { width: 130 }]}>{data.date || ''}</Text>
                                    </View>
                                </View>

                                <Text style={styles.disclaimerText}>THIS CERTIFICATE IS ISSUED WITHOUT ALTERATION OR ERASURE</Text>
                            </View>
                        </View>
                    </View>

                    {/* Footer 3-Campus Addresses */}
                    <View style={styles.footer}>
                        {/* GULISTAN-E-JAUHAR */}
                        {showJauhar && (
                            <View style={[styles.campusBlock, !showKaneez && !showNazimabad ? { marginBottom: 0 } : {}]}>
                                <Text style={styles.addressText}>
                                    C - 61, 62, 63, 64 & 65, BLOCK # 13, GULISTAN-E-JAUHAR, KARACHI.
                                </Text>
                                <Text style={styles.addressText}>
                                    HELLO # (92-21) 3476-5111, 3476-5112, 3476-5113 FAX # : (92-21) 3476-5114, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={styles.addressText}>
                                    Email : <Text style={styles.linkText}>american@cyber.net.pk</Text> , / <Text style={styles.linkText}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={styles.addressText}>
                                    Website : <Text style={styles.linkText}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}

                        {/* GULSHAN-E-KANEEZ FATIMA */}
                        {showKaneez && (
                            <View style={[styles.campusBlock, !showNazimabad ? { marginBottom: 0 } : {}]}>
                                <Text style={styles.addressText}>
                                    B-2, BLOCK # 2, GULSHAN-E-KANEEZ FATIMA SOCIETY,
                                </Text>
                                <Text style={styles.addressText}>
                                    GULZAR-E-HIJRI, K.D.A. SCHEME # 33, KARACHI.
                                </Text>
                                <Text style={styles.addressText}>
                                    HELLO # : (92-21) 3469-0972, 3469-0973, 3469-0975 FAX # : (92-21) 3469-0978, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={styles.addressText}>
                                    Email : <Text style={styles.linkText}>american@cyber.net.pk</Text> , / <Text style={styles.linkText}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={styles.addressText}>
                                    Website : <Text style={styles.linkText}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}

                        {/* NORTH NAZIMABAD */}
                        {showNazimabad && (
                            <View style={[styles.campusBlock, { marginBottom: 0 }]}>
                                <Text style={styles.addressText}>
                                    C – 22, BLOCK – I NORTH NAZIMABAD KARACHI.
                                </Text>
                                <Text style={styles.addressText}>
                                    HELLO # : (92-21) 3663-1051, 3663-1052, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={styles.addressText}>
                                    Email : <Text style={styles.linkText}>american@cyber.net.pk</Text> , / <Text style={styles.linkText}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={styles.addressText}>
                                    Website : <Text style={styles.linkText}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Page>
        </Document>
    );
};
