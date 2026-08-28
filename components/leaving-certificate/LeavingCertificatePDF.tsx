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

/** Shared layout constants — keeps label columns and name fields aligned across rows */
const LAYOUT = {
    contentWidth: 535,
    labelWidth: 126,
    nameColWidth: 82,
    dobMonthWidth: 70,
    dobDayWidth: 34,
    dobYearWidth: 42,
    pobCountryWidth: 70,
    pobProvinceWidth: 62,
    pobCityWidth: 62,
    fieldGap: 8,
    sidebarWidth: 125,
};

const styles = StyleSheet.create({
    page: {
        paddingTop: 14,
        paddingBottom: 14,
        paddingHorizontal: 26,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        fontSize: 8,
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
        marginBottom: 4,
    },
    leftLogoWrap: {
        height: 54,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    rightLogoWrap: {
        height: 54,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    docTitleContainer: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 2,
        marginBottom: 6,
    },
    docTitle: {
        fontSize: 14,
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
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'stretch',
        marginBottom: 6,
    },
    leftSidebar: {
        width: LAYOUT.sidebarWidth,
        borderRightWidth: 1,
        borderRightColor: '#000000',
        paddingHorizontal: 6,
        paddingTop: 10,
        paddingBottom: 10,
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
        paddingVertical: 3.5,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    sidebarValueText: {
        fontSize: 9.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 0.8,
    },
    photoBox: {
        width: 100,
        height: 125,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        backgroundColor: '#fafafa',
    },
    photoImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    photoPlaceholderText: {
        fontSize: 7,
        textAlign: 'center',
        color: '#444444',
        paddingHorizontal: 6,
        lineHeight: 1.2,
    },
    rightContent: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 6,
        justifyContent: 'space-between',
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 3,
    },
    fieldLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica',
        width: LAYOUT.labelWidth,
        paddingRight: 4,
        textAlign: 'left',
    },
    fieldValuesRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
    },
    underlinedValueContainer: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    underlinedValue: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingHorizontal: 4,
        paddingBottom: 0.5,
        fontSize: 8,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subLabel: {
        fontSize: 6,
        color: '#333333',
        marginTop: 1,
        textAlign: 'center',
    },
    checkboxRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    checkbox: {
        width: 8.5,
        height: 8.5,
        borderWidth: 1,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 3,
    },
    checkboxTick: {
        fontSize: 6.5,
        fontFamily: 'Helvetica-Bold',
        marginTop: -1,
    },
    checkboxLabel: {
        fontSize: 8,
        marginRight: 10,
    },
    lineFill: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        flex: 1,
        paddingBottom: 0.5,
        paddingLeft: 4,
        fontSize: 8,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
    },
    squareBox: {
        borderWidth: 1,
        borderColor: '#000000',
        paddingHorizontal: 3,
        paddingVertical: 1,
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        minWidth: 24,
        textAlign: 'center',
    },
    signaturesSection: {
        marginTop: 8,
        paddingTop: 2,
    },
    sigRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginVertical: 2.5,
    },
    sigField: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    sigLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica',
        marginRight: 4,
    },
    sigLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        width: 95,
        textAlign: 'center',
        fontSize: 7.5,
        fontFamily: 'Stardos Stencil',
        fontWeight: 'bold',
        paddingBottom: 0.5,
    },
    disclaimerText: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Oblique',
        textAlign: 'center',
        marginTop: 5,
    },
    footer: {
        marginTop: 5,
        width: '100%',
        alignItems: 'center',
    },
    campusBlock: {
        alignItems: 'center',
        marginBottom: 4,
    },
    campusTitle: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        color: '#000000',
        marginBottom: 1,
        textTransform: 'uppercase',
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

function UnderlinedCell({
    value,
    subLabel,
    width,
    marginRight = LAYOUT.fieldGap,
}: {
    value?: string | null;
    subLabel: string;
    width: number;
    marginRight?: number;
}) {
    return (
        <View style={[styles.underlinedValueContainer, { width, marginRight }]}>
            <Text style={[styles.underlinedValue, { width }]}>{value || '—'}</Text>
            <Text style={styles.subLabel}>{subLabel ? subLabel.toUpperCase() : ''}</Text>
        </View>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{label ? label.toUpperCase() : ''}</Text>
            <View style={styles.fieldValuesRow}>{children}</View>
        </View>
    );
}

function TripleNameFields({
    last,
    first,
    middle,
}: {
    last?: string | null;
    first?: string | null;
    middle?: string | null;
}) {
    const w = LAYOUT.nameColWidth;
    return (
        <>
            <UnderlinedCell value={last} subLabel="LAST" width={w} />
            <UnderlinedCell value={first} subLabel="FIRST" width={w} />
            <UnderlinedCell value={middle} subLabel="MIDDLE" width={w} marginRight={0} />
        </>
    );
}

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

    const prefix = (data.header_prefix || '').trim().toUpperCase();
    const title = (data.header_title || '').toUpperCase();
    const isTafsal = prefix === 'TAFSAL' || title.includes('TAFSAL');
    const isTafss = prefix === 'TAFSS' || title.includes('TAFSS') || title.includes('SECONDARY');
    const isTafsol = prefix === 'TAFSOL' || title.includes('TAFSOL');

    const classAdmittedLabel = isTafss
        ? 'IN SECONDARY CLASS TO WHICH HE / SHE WAS ADMITTED'
        : isTafsal
        ? 'IN TAFSAL CLASS TO WHICH HE / SHE WAS ADMITTED'
        : isTafsol
        ? 'IN TAFSOL CLASS TO WHICH HE / SHE WAS ADMITTED'
        : 'CLASS TO WHICH HE / SHE WAS ADMITTED';

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
                    {/* Header Logos — left logo flush with main grid border */}
                    <View style={[styles.header, { minHeight: Math.max(leftDims.height, rightDims.height) + 4 }]}>
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
                            <FieldRow label="NAME :">
                                <TripleNameFields
                                    last={data.name?.last}
                                    first={data.name?.first}
                                    middle={data.name?.middle}
                                />
                            </FieldRow>

                            <FieldRow label={"FATHER'S /GUARDIAN'S NAME"}>
                                <TripleNameFields
                                    last={data.father_name?.last}
                                    first={data.father_name?.first}
                                    middle={data.father_name?.middle}
                                />
                            </FieldRow>

                            <FieldRow label="DATE OF BIRTH">
                                <UnderlinedCell value={data.dob?.month} subLabel="MONTH" width={LAYOUT.dobMonthWidth} />
                                <UnderlinedCell value={data.dob?.day} subLabel="DAY" width={LAYOUT.dobDayWidth} />
                                <UnderlinedCell value={data.dob?.year} subLabel="YEAR" width={LAYOUT.dobYearWidth} marginRight={0} />
                            </FieldRow>

                            <FieldRow label="PLACE OF BIRTH">
                                <UnderlinedCell value={data.place_of_birth?.country || 'PAKISTAN'} subLabel="COUNTRY" width={LAYOUT.pobCountryWidth} />
                                <UnderlinedCell value={data.place_of_birth?.province || 'SINDH'} subLabel="PROVINCE" width={LAYOUT.pobProvinceWidth} />
                                <UnderlinedCell value={data.place_of_birth?.city || 'KARACHI'} subLabel="CITY" width={LAYOUT.pobCityWidth} marginRight={0} />
                            </FieldRow>

                            <FieldRow label="NATIONALITY">
                                <UnderlinedCell value={data.nationality || 'PAKISTANI'} subLabel="COUNTRY" width={140} marginRight={0} />
                            </FieldRow>

                            <FieldRow label="SEX :">
                                <View style={styles.checkboxRow}>
                                    <View style={styles.checkbox}>
                                        {isMale && (
                                            <Svg width="6" height="6" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MALE</Text>

                                    <View style={styles.checkbox}>
                                        {isFemale && (
                                            <Svg width="6" height="6" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>FEMALE</Text>
                                </View>
                            </FieldRow>

                            <FieldRow label="RELIGION :">
                                <View style={styles.checkboxRow}>
                                    <View style={styles.checkbox}>
                                        {isMuslim && (
                                            <Svg width="6" height="6" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>MUSLIM</Text>

                                    <View style={styles.checkbox}>
                                        {isChristian && (
                                            <Svg width="6" height="6" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.checkboxLabel}>CHRISTIAN</Text>

                                    <View style={styles.checkbox}>
                                        {isOtherReligion && (
                                            <Svg width="6" height="6" viewBox="0 0 24 24">
                                                <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </Svg>
                                        )}
                                    </View>
                                    <Text style={styles.sigLabel}>OTHERS</Text>
                                    <Text style={[styles.lineFill, { maxWidth: 90, textAlign: 'center' }]}>
                                        {isOtherReligion ? religionStr : ''}
                                    </Text>
                                </View>
                            </FieldRow>

                            <FieldRow label="MARK (S) OF IDENTIFICATION">
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.identification_marks || '—'}</Text>
                            </FieldRow>

                            <FieldRow label="LAST SCHOOL ATTENDED">
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.last_school_attended || '—'}</Text>
                            </FieldRow>

                            <FieldRow label="DATE OF ADMISSION">
                                <UnderlinedCell value={data.date_of_admission?.month} subLabel="MONTH" width={LAYOUT.dobMonthWidth} />
                                <UnderlinedCell value={data.date_of_admission?.day} subLabel="DAY" width={LAYOUT.dobDayWidth} />
                                <UnderlinedCell value={data.date_of_admission?.year} subLabel="YEAR" width={LAYOUT.dobYearWidth} marginRight={0} />
                            </FieldRow>

                            <FieldRow label="SCHOLASTIC YEAR">
                                <View style={styles.squareBox}>
                                    <Text>{data.scholastic_year_admitted?.from || '—'}</Text>
                                </View>
                                <Text style={{ marginHorizontal: 2 }}>/</Text>
                                <View style={styles.squareBox}>
                                    <Text>{data.scholastic_year_admitted?.to || '—'}</Text>
                                </View>
                            </FieldRow>

                            <FieldRow label={classAdmittedLabel}>
                                <View style={styles.squareBox}>
                                    <Text>{data.class_admitted || '—'}</Text>
                                </View>
                            </FieldRow>

                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>PRESENT LEVEL</Text>
                                <View style={styles.fieldValuesRow}>
                                    <Text style={[styles.underlinedValue, { width: 70, marginRight: LAYOUT.fieldGap, textAlign: 'center' }]}>
                                        {data.present_level || '—'}
                                    </Text>
                                    <Text style={[styles.sigLabel, { width: 48 }]}>SECTION</Text>
                                    <Text style={[styles.underlinedValue, { width: 50, textAlign: 'center' }]}>{data.section || '—'}</Text>
                                </View>
                            </View>

                            <FieldRow label="SCHOLASTIC YEAR">
                                <View style={styles.squareBox}>
                                    <Text>{data.scholastic_year_present?.from || '—'}</Text>
                                </View>
                                <Text style={{ marginHorizontal: 2 }}>/</Text>
                                <View style={styles.squareBox}>
                                    <Text>{data.scholastic_year_present?.to || '—'}</Text>
                                </View>
                            </FieldRow>

                            <FieldRow label="LAST DATE OF ATTENDANCE AT THIS SCHOOL">
                                <UnderlinedCell value={data.last_date_of_attendance?.month} subLabel="MONTH" width={LAYOUT.dobMonthWidth} />
                                <UnderlinedCell value={data.last_date_of_attendance?.day} subLabel="DAY" width={LAYOUT.dobDayWidth} />
                                <UnderlinedCell value={data.last_date_of_attendance?.year} subLabel="YEAR" width={LAYOUT.dobYearWidth} marginRight={0} />
                            </FieldRow>

                            <FieldRow label="REASON FOR LEAVING THE SCHOOL">
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.reason_for_leaving || "ON PARENT'S REQUEST"}</Text>
                            </FieldRow>

                            <FieldRow label="RESULT AT THE END OF THE SCHOLASTIC YEAR">
                                <View style={styles.squareBox}>
                                    <Text>{data.result_scholastic_year?.from || '—'}</Text>
                                </View>
                                <Text style={{ marginHorizontal: 2 }}>/</Text>
                                <View style={styles.squareBox}>
                                    <Text>{data.result_scholastic_year?.to || '—'}</Text>
                                </View>
                            </FieldRow>

                            <View style={styles.fieldRow}>
                                <Text style={[styles.fieldLabel, { width: LAYOUT.labelWidth + 8 }]}>A) PASSED & PROMOTED TO LEVEL</Text>
                                <View style={styles.fieldValuesRow}>
                                    <Text style={[styles.underlinedValue, { width: 56, marginRight: LAYOUT.fieldGap, textAlign: 'center' }]}>
                                        {data.passed_promoted_level || '—'}
                                    </Text>
                                    <Text style={[styles.sigLabel, { marginRight: 4 }]}>FOR THE SCHOLASTIC YEAR</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.passed_promoted_year?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.passed_promoted_year?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.fieldRow}>
                                <Text style={[styles.fieldLabel, { width: LAYOUT.labelWidth + 8 }]}>B) HE/SHE HAS TO RESIT IN THE FOLLOWING SUBJECTS</Text>
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.resit_subjects || '—'}</Text>
                            </View>

                            <View style={styles.fieldRow}>
                                <Text style={[styles.fieldLabel, { width: LAYOUT.labelWidth + 8 }]}>C) DETAINED IN LEVEL</Text>
                                <View style={styles.fieldValuesRow}>
                                    <Text style={[styles.underlinedValue, { width: 46, marginRight: LAYOUT.fieldGap, textAlign: 'center' }]}>
                                        {data.detained_level || '—'}
                                    </Text>
                                    <Text style={[styles.sigLabel, { marginRight: 4 }]}>FOR THE SCHOLASTIC YEAR</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.detained_year?.from || '—'}</Text>
                                    </View>
                                    <Text style={{ marginHorizontal: 2 }}>/</Text>
                                    <View style={styles.squareBox}>
                                        <Text>{data.detained_year?.to || '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            <FieldRow label="SCHOOL DUES (IF ANY)">
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.school_dues || '—'}</Text>
                            </FieldRow>

                            <FieldRow label="REMARKS">
                                <Text style={[styles.lineFill, { textAlign: 'center' }]}>{data.remarks || '—'}</Text>
                            </FieldRow>

                        <View style={styles.signaturesSection}>
                            <View style={styles.sigRow}>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>PREPARED BY</Text>
                                    <Text style={styles.sigLine}>{data.prepared_by || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>RECHECKED BY</Text>
                                    <Text style={styles.sigLine}>{data.rechecked_by || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>POSTED BY</Text>
                                    <Text style={styles.sigLine}>{data.posted_by || ''}</Text>
                                </View>
                            </View>

                            <View style={styles.sigRow}>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>LEAD TEACHER</Text>
                                    <Text style={styles.sigLine}>{data.class_teacher || ''}</Text>
                                </View>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>PROGRAMME DIRECTRESS</Text>
                                    <Text style={styles.sigLine}>{data.programme_directress || ''}</Text>
                                </View>
                            </View>

                            <View style={[styles.sigRow, { justifyContent: 'center' }]}>
                                <View style={styles.sigField}>
                                    <Text style={styles.sigLabel}>DAY</Text>
                                    <Text style={[styles.sigLine, { width: 80 }]}>{data.day || ''}</Text>
                                </View>
                                <View style={[styles.sigField, { marginLeft: 40 }]}>
                                    <Text style={styles.sigLabel}>DATE</Text>
                                    <Text style={[styles.sigLine, { width: 120 }]}>{data.date || ''}</Text>
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
