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

Font.register({
    family: 'Saira Stencil One',
    src: 'https://fonts.gstatic.com/s/sairastencilone/v19/SLXSc03I6HkvZGJ1GvvipLoYSTEL9AsM.ttf',
});

Font.register({
    family: 'Black Ops One',
    src: 'https://fonts.gstatic.com/s/blackopsone/v21/qWcsB6-ypo7xBdr6Xshe96H3WDw.ttf',
});

export interface LeavingCertificateData {
    header_title?: string;
    header_prefix?: string;
    font_weight_style?: 'STANDARD' | 'SUPER_BOLD' | 'ULTRA_HEAVY';
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
    footer_font_size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE' | number;
}

/** Shared layout constants */
const LAYOUT = {
    contentWidth: 540,
    sidebarWidth: 120,
    fieldGap: 10,
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
        width: LAYOUT.contentWidth - LAYOUT.sidebarWidth,
        paddingHorizontal: 8,
        paddingTop: 4,
        paddingBottom: 4,
        justifyContent: 'space-between',
    },
    fieldRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 1.5,
    },
    fieldRowWithSublabels: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 1.5,
    },
    labelColWithSublabels: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginRight: 4,
    },
    fieldLabelInline: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'left',
        marginRight: 4,
        paddingBottom: 0.5,
    },
    fieldLabelWithSublabels: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'left',
        marginRight: 4,
        paddingTop: 1,
    },
    fieldValuesRow: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        marginTop: 1.5,
        textAlign: 'center',
    },
    subLabelSpacer: {
        fontSize: 6,
        fontFamily: 'Helvetica-Bold',
        marginTop: 1.5,
        opacity: 0,
    },
    checkboxRow: {
        flex: 1,
        width: '100%',
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
        paddingBottom: 0.5,
    },
    sigLineWrap: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 0.5,
        alignItems: 'center',
    },
    sigLineText: {
        textAlign: 'center',
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
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
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        color: '#000000',
        lineHeight: 1.18,
    },
    linkText: {
        fontSize: 6.5,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
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
                key === 'footer_font_size' ||
                key === 'font_weight_style' ||
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
    const isSuperBold = data.font_weight_style === 'SUPER_BOLD' || data.font_weight_style === 'ULTRA_HEAVY';
    const isUltra = data.font_weight_style === 'ULTRA_HEAVY';
    const headerFont = isUltra ? 'Black Ops One' : isSuperBold ? 'Saira Stencil One' : 'Stardos Stencil';

    const getFooterFontSize = () => {
        if (typeof data.footer_font_size === 'number') {
            return data.footer_font_size;
        }
        switch (data.footer_font_size) {
            case 'SMALL':
                return 5.5;
            case 'LARGE':
                return 7.5;
            case 'XLARGE':
                return 8.5;
            case 'MEDIUM':
            default:
                return 6.5;
        }
    };

    const footerFontSize = getFooterFontSize();
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
                        <Text style={[styles.docTitle, { fontFamily: headerFont, fontSize: isSuperBold ? 14 : 13.5, letterSpacing: isSuperBold ? 0.6 : 1 }]}>
                            {data.header_title || 'TAFS LEAVING CERTIFICATE'}
                        </Text>
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
                                <Text style={styles.sidebarLabel}>COMPUTER CODE #</Text>
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
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>NAME :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.name?.last || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.name?.first || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.name?.middle || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>NAME :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>LAST</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>FIRST</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>MIDDLE</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 2. FATHER'S / GUARDIAN'S NAME */}
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>FATHER'S / GUARDIAN'S NAME :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.father_name?.last || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.father_name?.first || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.father_name?.middle || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>FATHER'S / GUARDIAN'S NAME :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>LAST</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>FIRST</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>MIDDLE</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 3. DATE OF BIRTH */}
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>DATE OF BIRTH :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.dob?.month || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.dob?.day || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.dob?.year || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>DATE OF BIRTH :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>MONTH</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>DAY</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>YEAR</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 4. PLACE OF BIRTH */}
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>PLACE OF BIRTH :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.place_of_birth?.country || 'PAKISTAN'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.place_of_birth?.province || 'SINDH'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.place_of_birth?.city || 'KARACHI'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>PLACE OF BIRTH :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>COUNTRY</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>PROVINCE</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>CITY</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 5. NATIONALITY */}
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>NATIONALITY :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.nationality || 'PAKISTANI'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>NATIONALITY :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>COUNTRY</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 6. SEX */}
                            <View style={styles.fieldRow}>
                                <View style={{ width: 62 }}>
                                    <Text style={styles.fieldLabelInline}>SEX :</Text>
                                </View>
                                <View style={{ width: 72, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.checkbox}>
                                        {isMale && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MALE</Text>
                                </View>
                                <View style={{ width: 85, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.checkbox}>
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
                                <View style={{ width: 62 }}>
                                    <Text style={styles.fieldLabelInline}>RELIGION :</Text>
                                </View>
                                <View style={{ width: 72, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.checkbox}>
                                        {isMuslim && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MUSLIM</Text>
                                </View>
                                <View style={{ width: 85, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.checkbox}>
                                        {isChristian && (
                                            <Svg width="7" height="7" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>CHRISTIAN</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.fieldLabelInline, { marginRight: 4 }]}>OTHERS</Text>
                                    <View style={{ width: 70, alignItems: 'center' }}>
                                        <Text style={styles.underlinedValue}>
                                            {isOtherReligion ? religionStr : ''}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* 8. MARK (S) OF IDENTIFICATION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>MARK (S) OF IDENTIFICATION :</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.identification_marks || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 9. LAST SCHOOL ATTENDED */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>LAST SCHOOL ATTENDED :</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.last_school_attended || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 10. DATE OF ADMISSION */}
                            <View style={styles.fieldRowWithSublabels}>
                                <View style={{ flex: 1, flexDirection: 'column' }}>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={styles.fieldLabelInline}>DATE OF ADMISSION :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.date_of_admission?.month || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.underlinedValue}>{data.date_of_admission?.day || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.underlinedValue}>{data.date_of_admission?.year || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
                                        <Text style={[styles.fieldLabelInline, { opacity: 0 }]}>DATE OF ADMISSION :</Text>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>MONTH</Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: LAYOUT.fieldGap }}>
                                                <Text style={styles.subLabel}>DAY</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.subLabel}>YEAR</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 11. SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <Text style={styles.squareBox}>{data.scholastic_year_admitted?.from || '—'}</Text>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <Text style={styles.squareBox}>{data.scholastic_year_admitted?.to || '—'}</Text>
                                </View>
                            </View>

                            {/* 12. CLASS TO WHICH THE CHILD WAS ADMITTED */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>{classAdmittedLabel} :</Text>
                                <View style={{ marginLeft: 2 }}>
                                    <Text style={styles.squareBox}>{data.class_admitted || '—'}</Text>
                                </View>
                            </View>

                            {/* 13. PRESENT CLASS & SECTION */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>PRESENT CLASS :</Text>
                                <View style={{ flex: 1.2, marginRight: 10, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.present_level || '—'}
                                    </Text>
                                </View>
                                <Text style={styles.fieldLabelInline}>SECTION :</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.section || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 14. SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <Text style={styles.squareBox}>{data.scholastic_year_present?.from || '—'}</Text>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <Text style={styles.squareBox}>{data.scholastic_year_present?.to || '—'}</Text>
                                </View>
                            </View>

                            {/* 15. LAST DATE OF ATTENDANCE AT THIS SCHOOL */}
                            <View style={{ width: '100%', flexDirection: 'column', marginVertical: 2 }}>
                                <Text style={[styles.fieldLabelInline, { width: '100%', marginBottom: 2.5 }]}>
                                    LAST DATE OF ATTENDANCE AT THIS SCHOOL :
                                </Text>
                                <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
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
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.reason_for_leaving || "ON PARENT'S REQUEST"}
                                    </Text>
                                </View>
                            </View>

                            {/* 17. RESULT AT THE END OF THE SCHOLASTIC YEAR */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>RESULT AT THE END OF THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                                    <Text style={styles.squareBox}>{data.result_scholastic_year?.from || '—'}</Text>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <Text style={styles.squareBox}>{data.result_scholastic_year?.to || '—'}</Text>
                                </View>
                            </View>

                            {/* 18. a ) PASSED & PROMOTED TO CLASS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>a ) PASSED & PROMOTED TO CLASS :</Text>
                                <View style={{ flex: 1, marginRight: 6, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.passed_promoted_level || '—'}
                                    </Text>
                                </View>
                                <Text style={[styles.fieldLabelInline, { marginRight: 3 }]}>FOR THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.squareBox}>{data.passed_promoted_year?.from || '—'}</Text>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <Text style={styles.squareBox}>{data.passed_promoted_year?.to || '—'}</Text>
                                </View>
                            </View>

                            {/* 19. b ) THE CHILD HAS TO RESIT IN THE FOLLOWING SUBJECTS */}
                            <View style={{ width: '100%', flexDirection: 'column', marginVertical: 1.5 }}>
                                <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end' }}>
                                    <Text style={styles.fieldLabelInline}>b ) THE CHILD HAS TO RESIT IN THE FOLLOWING SUBJECTS :</Text>
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={styles.underlinedValue}>
                                            {data.resit_subjects || '—'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
                                    <View style={{ flex: 1, marginLeft: 16, alignItems: 'center' }}>
                                        <Text style={styles.underlinedValue}>
                                            {'—'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* 20. c ) DETAINED IN CLASS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>c ) DETAINED IN CLASS :</Text>
                                <View style={{ flex: 1, marginRight: 6, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.detained_level || '—'}
                                    </Text>
                                </View>
                                <Text style={[styles.fieldLabelInline, { marginRight: 3 }]}>FOR THE SCHOLASTIC YEAR :</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.squareBox}>{data.detained_year?.from || '—'}</Text>
                                    <Text style={{ marginHorizontal: 2, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>/</Text>
                                    <Text style={styles.squareBox}>{data.detained_year?.to || '—'}</Text>
                                </View>
                            </View>

                            {/* 21. TAFS / TAFSS / TAFCS DUES (IF ANY) */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>{`${prefix} DUES (IF ANY) :`}</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.school_dues || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 22. REMARKS */}
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabelInline}>REMARKS :</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.underlinedValue}>
                                        {data.remarks || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* 23. Signatures Section */}
                            <View style={styles.signaturesSection}>
                                <View style={styles.sigRow}>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>PREPARED BY :</Text>
                                        <View style={[styles.sigLineWrap, { marginRight: 6 }]}>
                                            <Text style={styles.sigLineText}>{data.prepared_by || ''}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>RECHECKED BY :</Text>
                                        <View style={[styles.sigLineWrap, { marginRight: 6 }]}>
                                            <Text style={styles.sigLineText}>{data.rechecked_by || ''}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>POSTED BY :</Text>
                                        <View style={styles.sigLineWrap}>
                                            <Text style={styles.sigLineText}>{data.posted_by || ''}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.sigRow}>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>LEAD TEACHER :</Text>
                                        <View style={[styles.sigLineWrap, { marginRight: 10 }]}>
                                            <Text style={styles.sigLineText}>{data.class_teacher || ''}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.sigField}>
                                        <Text style={styles.sigLabel}>PROGRAMME DIRECTRESS :</Text>
                                        <View style={styles.sigLineWrap}>
                                            <Text style={styles.sigLineText}>{data.programme_directress || ''}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={[styles.sigRow, { justifyContent: 'space-between' }]}>
                                    <View style={[styles.sigField, { flex: 0.8, marginRight: 16 }]}>
                                        <Text style={styles.sigLabel}>DAY :</Text>
                                        <View style={styles.sigLineWrap}>
                                            <Text style={styles.sigLineText}>{data.day || ''}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.sigField, { flex: 1.2 }]}>
                                        <Text style={styles.sigLabel}>DATE :</Text>
                                        <View style={styles.sigLineWrap}>
                                            <Text style={styles.sigLineText}>{data.date || ''}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Disclaimer */}
                    <Text style={styles.disclaimerText}>
                        ANY ERASING, OVERWRITING, OR ALTERATION INVALIDATES THIS CERTIFICATE.
                    </Text>

                    {/* Footer Campuses */}
                    <View style={styles.footer}>
                        {/* GULISTAN-E-JAUHAR */}
                        {showJauhar && (
                            <View style={[styles.campusBlock, !showKaneez && !showNazimabad ? { marginBottom: 0 } : {}]}>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    C - 61, 62, 63, 64 & 65, BLOCK # 13, GULISTAN-E-JAUHAR, KARACHI.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    HELLO # (92-21) 3476-5111, 3476-5112, 3476-5113 FAX # : (92-21) 3476-5114, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Email : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>american@cyber.net.pk</Text> , / <Text style={[styles.linkText, { fontSize: footerFontSize }]}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Website : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}

                        {/* GULSHAN-E-KANEEZ FATIMA */}
                        {showKaneez && (
                            <View style={[styles.campusBlock, !showNazimabad ? { marginBottom: 0 } : {}]}>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    B-2, BLOCK # 2, GULSHAN-E-KANEEZ FATIMA SOCIETY,
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    GULZAR-E-HIJRI, K.D.A. SCHEME # 33, KARACHI.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    HELLO # : (92-21) 3469-0972, 3469-0973, 3469-0975 FAX # : (92-21) 3469-0978, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Email : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>american@cyber.net.pk</Text> , / <Text style={[styles.linkText, { fontSize: footerFontSize }]}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Website : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}

                        {/* NORTH NAZIMABAD */}
                        {showNazimabad && (
                            <View style={[styles.campusBlock, { marginBottom: 0 }]}>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    C – 22, BLOCK – I NORTH NAZIMABAD KARACHI.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    HELLO # : (92-21) 3663-1051, 3663-1052, HELP LINE # : 0300-8258061.
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Email : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>american@cyber.net.pk</Text> , / <Text style={[styles.linkText, { fontSize: footerFontSize }]}>info@tafs.edu.pk</Text>
                                </Text>
                                <Text style={[styles.addressText, { fontSize: footerFontSize }]}>
                                    Website : <Text style={[styles.linkText, { fontSize: footerFontSize }]}>www.tafs.edu.pk</Text>.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Page>
        </Document>
    );
};
