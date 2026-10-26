import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Don't break words like "Campus" across lines.
Font.registerHyphenationCallback((word) => [word]);

/**
 * TAFSD-345 / Mirza Student Profile Print:
 * - Printed on A4.
 * - Everything in CAPITALS (labels and values).
 * - Important fields in bold: student name, GR, class/section, campus, father's name, contact numbers, status.
 * - School heading by class (Secondary Studies for VI-X, A Level Studies for AS/A2, standard otherwise).
 * - Photos: first ever photo and latest photo side by side with upload dates. Single photo if same.
 * - Siblings section at bottom with photo, name, GR, class/section, campus, status (heading "LINK TO GR").
 * - Multi-sibling rows flow cleanly onto page 2.
 */

export interface ProfileField {
    label: string;
    value: string | null | undefined;
    bold?: boolean;
}

export interface ProfileGuardian {
    relationship: string;
    name: string;
    cnic: string;
    phone: string;
    occupation: string;
    isFather?: boolean;
}

export interface ProfileSibling {
    cc: number | string;
    gr: string;
    name: string;
    grade: string;
    campus: string;
    status: string;
    photoDataUrl?: string | null;
}

export interface ProfileHistoryRow {
    from: string;
    to: string;
    change: string;
    campus: string;
    klass: string;
    section: string;
    house: string;
    year: string;
}

export interface ProfileFeeCell {
    amount: number;
    /** PAID, ISSUED, PART PAID, WAIVED, DISCOUNT, or "" when not issued yet. */
    status: string;
}

export interface ProfileFeeSchedule {
    academicYear: string;
    months: { month: number; label: string }[];
    heads: { name: string; cells: Record<number, ProfileFeeCell> }[];
}

export interface StudentProfileData {
    schoolName: string;
    campusName: string;
    logoUrl: string | null;
    firstPhotoDataUrl: string | null;
    firstPhotoDate: string | null;
    latestPhotoDataUrl: string | null;
    latestPhotoDate: string | null;
    name: string;
    cc: number | string;
    gr: string;
    status: string;
    academicYear: string;
    details: ProfileField[];
    guardians: ProfileGuardian[];
    family: ProfileField[];
    siblings: ProfileSibling[];
    history: ProfileHistoryRow[];
    fees: ProfileFeeSchedule | null;
    feesNote: string | null;
    printedAt: string;
    printedBy: string;
}

const RULE = '#888';

const s = StyleSheet.create({
    page: {
        paddingTop: 24,
        paddingBottom: 40,
        paddingHorizontal: 30,
        fontFamily: 'Helvetica',
        fontSize: 8,
        color: '#000',
    },
    bold: {
        fontFamily: 'Helvetica-Bold',
    },
    regular: {
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottomWidth: 1.25,
        borderColor: '#000',
        marginBottom: 8,
    },
    logo: {
        width: 44,
        height: 44,
        marginRight: 10,
    },
    titleBox: {
        flex: 1,
    },
    school: {
        fontSize: 10.5,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    campus: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        marginTop: 2,
    },
    photoContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginLeft: 8,
        gap: 6,
    },
    photoBox: {
        width: 52,
        alignItems: 'center',
    },
    photoSingleBox: {
        width: 62,
        alignItems: 'center',
    },
    photoInner: {
        width: 52,
        height: 62,
        borderWidth: 0.75,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa',
    },
    photoSingleInner: {
        width: 62,
        height: 74,
        borderWidth: 0.75,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa',
    },
    photoImg: {
        width: 50.5,
        height: 60.5,
        objectFit: 'cover',
    },
    photoSingleImg: {
        width: 60.5,
        height: 72.5,
        objectFit: 'cover',
    },
    photoText: {
        fontSize: 6,
        color: '#666',
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
    },
    photoLabel: {
        fontSize: 5.5,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        marginTop: 2,
        color: '#111',
    },
    strip: {
        flexDirection: 'row',
        marginBottom: 9,
        paddingBottom: 4,
        borderBottomWidth: 0.5,
        borderColor: RULE,
    },
    stripItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    stripLabel: {
        color: '#444',
        marginRight: 4,
        fontSize: 8,
    },
    stripValue: {
        fontSize: 8,
    },
    section: {
        marginBottom: 9,
    },
    sectionTitle: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        paddingBottom: 2,
        borderBottomWidth: 0.75,
        borderColor: '#000',
        marginBottom: 3,
        letterSpacing: 0.3,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    field: {
        width: '50%',
        flexDirection: 'row',
        paddingVertical: 2.2,
        paddingRight: 8,
        borderBottomWidth: 0.5,
        borderColor: RULE,
    },
    field3: {
        width: '33.33%',
        flexDirection: 'row',
        paddingVertical: 2.2,
        paddingRight: 8,
        borderBottomWidth: 0.5,
        borderColor: RULE,
    },
    fieldLabel: {
        width: 82,
        color: '#444',
        fontSize: 7.5,
    },
    fieldValue: {
        flex: 1,
        fontSize: 7.5,
    },
    table: {
        borderTopWidth: 0.5,
        borderColor: RULE,
    },
    tr: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderColor: RULE,
    },
    th: {
        fontFamily: 'Helvetica-Bold',
        paddingVertical: 2.5,
        paddingHorizontal: 3,
        fontSize: 7.5,
        color: '#000',
    },
    td: {
        paddingVertical: 2.5,
        paddingHorizontal: 3,
        fontSize: 7.5,
    },
    empty: {
        color: '#555',
        paddingVertical: 2.5,
        fontSize: 7.5,
        fontStyle: 'italic',
    },
    feeHead: {
        flex: 1,
        paddingVertical: 2,
        paddingHorizontal: 3,
        fontSize: 7,
    },
    feeCell: {
        width: 34,
        textAlign: 'center',
        paddingVertical: 1.5,
        fontSize: 6.5,
    },
    feeTotal: {
        width: 44,
        textAlign: 'right',
        paddingVertical: 1.5,
        paddingRight: 3,
        fontSize: 6.5,
        fontFamily: 'Helvetica-Bold',
    },
    feeStatus: {
        fontSize: 5.5,
        color: '#444',
    },
    siblingPhotoBox: {
        width: 22,
        height: 26,
        borderWidth: 0.5,
        borderColor: '#999',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
    },
    siblingPhotoImg: {
        width: 21,
        height: 25,
        objectFit: 'cover',
    },
    siblingNoPhoto: {
        fontSize: 4.5,
        color: '#777',
        textAlign: 'center',
        fontFamily: 'Helvetica-Bold',
    },
    note: {
        fontSize: 7,
        color: '#444',
        marginTop: 3,
    },
    footer: {
        position: 'absolute',
        bottom: 16,
        left: 30,
        right: 30,
        fontSize: 7,
        color: '#444',
        borderTopWidth: 0.5,
        borderColor: RULE,
        paddingTop: 3,
    },
});

const toUpper = (x: unknown): string => {
    if (x == null) return '—';
    const str = String(x).trim();
    return str ? str.toUpperCase() : '—';
};

const money = (n: number) => Math.round(n).toLocaleString('en-US');

function Fields({ items, cols = 2 }: { items: ProfileField[]; cols?: 2 | 3 }) {
    return (
        <View style={s.grid}>
            {items.map((f, i) => (
                <View key={i} style={cols === 3 ? s.field3 : s.field} wrap={false}>
                    <Text style={s.fieldLabel}>{toUpper(f.label)}</Text>
                    <Text style={[s.fieldValue, f.bold ? s.bold : s.regular]}>
                        {toUpper(f.value)}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function FeeGrid({ fees }: { fees: ProfileFeeSchedule }) {
    const headTotal = (h: ProfileFeeSchedule['heads'][number]) => Object.values(h.cells).reduce((t, c) => t + c.amount, 0);
    const monthTotal = (m: number) => fees.heads.reduce((t, h) => t + (h.cells[m]?.amount ?? 0), 0);
    return (
        <View style={s.table}>
            <View style={s.tr}>
                <Text style={[s.th, { flex: 1 }]}>HEAD</Text>
                {fees.months.map((m) => (
                    <Text key={m.month} style={[s.th, s.feeCell]}>{toUpper(m.label)}</Text>
                ))}
                <Text style={[s.th, s.feeTotal]}>TOTAL</Text>
            </View>
            {fees.heads.map((h) => (
                <View key={h.name} style={s.tr} wrap={false}>
                    <Text style={s.feeHead}>{toUpper(h.name)}</Text>
                    {fees.months.map((m) => {
                        const c = h.cells[m.month];
                        return (
                            <View key={m.month} style={s.feeCell}>
                                <Text>{c ? money(c.amount) : ''}</Text>
                                {c?.status ? <Text style={s.feeStatus}>{toUpper(c.status)}</Text> : null}
                            </View>
                        );
                    })}
                    <Text style={s.feeTotal}>{money(headTotal(h))}</Text>
                </View>
            ))}
            <View style={[s.tr, { borderBottomWidth: 0 }]} wrap={false}>
                <Text style={[s.feeHead, s.bold]}>TOTAL</Text>
                {fees.months.map((m) => (
                    <Text key={m.month} style={[s.feeCell, s.bold]}>{money(monthTotal(m.month))}</Text>
                ))}
                <Text style={s.feeTotal}>{money(fees.heads.reduce((t, h) => t + headTotal(h), 0))}</Text>
            </View>
        </View>
    );
}

export function StudentProfilePDF({ data }: { data: StudentProfileData }) {
    const hasTwoPhotos = Boolean(
        data.firstPhotoDataUrl &&
        data.latestPhotoDataUrl &&
        data.firstPhotoDataUrl !== data.latestPhotoDataUrl
    );
    const singlePhoto = data.latestPhotoDataUrl || data.firstPhotoDataUrl;
    const singlePhotoDate = data.latestPhotoDate || data.firstPhotoDate;

    return (
        <Document title={`STUDENT PROFILE — ${toUpper(data.name)} (CC ${data.cc})`} author="TAFSync">
            <Page size="A4" style={s.page}>
                <View>
                    {/* ── HEADER ── */}
                    <View style={s.header}>
                        {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : <View style={s.logo} />}
                        <View style={s.titleBox}>
                            <Text style={s.school}>{toUpper(data.schoolName)}</Text>
                            <Text style={s.title}>STUDENT PROFILE</Text>
                            {data.campusName ? (
                                <Text style={s.campus}>{toUpper(data.campusName)}</Text>
                            ) : null}
                        </View>

                        {/* ── PHOTOS: First + Latest, or single photo ── */}
                        <View style={s.photoContainer}>
                            {hasTwoPhotos ? (
                                <>
                                    <View style={s.photoBox}>
                                        <View style={s.photoInner}>
                                            <Image src={data.firstPhotoDataUrl!} style={s.photoImg} />
                                        </View>
                                        <Text style={s.photoLabel}>
                                            FIRST PHOTO{data.firstPhotoDate ? `\n${toUpper(data.firstPhotoDate)}` : ''}
                                        </Text>
                                    </View>
                                    <View style={s.photoBox}>
                                        <View style={s.photoInner}>
                                            <Image src={data.latestPhotoDataUrl!} style={s.photoImg} />
                                        </View>
                                        <Text style={s.photoLabel}>
                                            LATEST PHOTO{data.latestPhotoDate ? `\n${toUpper(data.latestPhotoDate)}` : ''}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <View style={s.photoSingleBox}>
                                    <View style={s.photoSingleInner}>
                                        {singlePhoto ? (
                                            <Image src={singlePhoto} style={s.photoSingleImg} />
                                        ) : (
                                            <Text style={s.photoText}>NO PHOTO</Text>
                                        )}
                                    </View>
                                    {singlePhotoDate ? (
                                        <Text style={s.photoLabel}>{toUpper(singlePhotoDate)}</Text>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── STRIP ── */}
                    <View style={s.strip}>
                        <View style={s.stripItem}>
                            <Text style={s.stripLabel}>CC:</Text>
                            <Text style={[s.stripValue, s.bold]}>{toUpper(String(data.cc))}</Text>
                        </View>
                        <View style={s.stripItem}>
                            <Text style={s.stripLabel}>GR:</Text>
                            <Text style={[s.stripValue, s.bold]}>{toUpper(data.gr)}</Text>
                        </View>
                        <View style={s.stripItem}>
                            <Text style={s.stripLabel}>STATUS:</Text>
                            <Text style={[s.stripValue, s.bold]}>{toUpper(data.status)}</Text>
                        </View>
                        <View style={s.stripItem}>
                            <Text style={s.stripLabel}>SESSION:</Text>
                            <Text style={s.stripValue}>{toUpper(data.academicYear)}</Text>
                        </View>
                    </View>

                    {/* ── 1. STUDENT DETAILS ── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>1. STUDENT DETAILS</Text>
                        <Fields items={data.details} />
                    </View>

                    {/* ── 2. GUARDIANS AND FAMILY ── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>2. GUARDIANS AND FAMILY</Text>
                        <View style={s.table}>
                            <View style={s.tr} fixed>
                                <Text style={[s.th, { width: '14%' }]}>RELATION</Text>
                                <Text style={[s.th, { width: '28%' }]}>NAME</Text>
                                <Text style={[s.th, { width: '18%' }]}>CNIC</Text>
                                <Text style={[s.th, { width: '18%' }]}>CONTACT NUMBER</Text>
                                <Text style={[s.th, { width: '22%' }]}>OCCUPATION</Text>
                            </View>
                            {data.guardians.length === 0 ? (
                                <Text style={s.empty}>NO GUARDIANS ON RECORD.</Text>
                            ) : (
                                data.guardians.map((g, i) => (
                                    <View
                                        key={i}
                                        style={[s.tr, i === data.guardians.length - 1 ? { borderBottomWidth: 0 } : {}]}
                                        wrap={false}
                                    >
                                        <Text style={[s.td, { width: '14%' }]}>{toUpper(g.relationship)}</Text>
                                        <Text style={[s.td, { width: '28%' }, g.isFather ? s.bold : s.regular]}>
                                            {toUpper(g.name)}
                                        </Text>
                                        <Text style={[s.td, { width: '18%' }]}>{toUpper(g.cnic)}</Text>
                                        <Text style={[s.td, { width: '18%' }, s.bold]}>{toUpper(g.phone)}</Text>
                                        <Text style={[s.td, { width: '22%' }]}>{toUpper(g.occupation)}</Text>
                                    </View>
                                ))
                            )}
                        </View>

                        <View style={{ marginTop: 4 }}>
                            <Fields items={data.family} />
                        </View>
                    </View>

                    {/* ── 3. HISTORY ── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>3. HISTORY</Text>
                        <View style={s.table}>
                            <View style={s.tr} fixed>
                                <Text style={[s.th, { width: '11%' }]}>FROM</Text>
                                <Text style={[s.th, { width: '11%' }]}>TO</Text>
                                <Text style={[s.th, { width: '12%' }]}>CHANGE</Text>
                                <Text style={[s.th, { width: '23%' }]}>CAMPUS</Text>
                                <Text style={[s.th, { width: '13%' }]}>CLASS</Text>
                                <Text style={[s.th, { width: '9%' }]}>SECTION</Text>
                                <Text style={[s.th, { width: '9%' }]}>HOUSE</Text>
                                <Text style={[s.th, { width: '12%' }]}>SESSION</Text>
                            </View>
                            {data.history.length === 0 ? (
                                <Text style={s.empty}>NO PROGRESSION HISTORY RECORDED.</Text>
                            ) : (
                                data.history.map((h, i) => (
                                    <View
                                        key={i}
                                        style={[s.tr, i === data.history.length - 1 ? { borderBottomWidth: 0 } : {}]}
                                        wrap={false}
                                    >
                                        <Text style={[s.td, { width: '11%' }]}>{toUpper(h.from)}</Text>
                                        <Text style={[s.td, { width: '11%' }]}>{toUpper(h.to)}</Text>
                                        <Text style={[s.td, { width: '12%' }]}>{toUpper(h.change)}</Text>
                                        <Text style={[s.td, { width: '23%' }]}>{toUpper(h.campus)}</Text>
                                        <Text style={[s.td, { width: '13%' }]}>{toUpper(h.klass)}</Text>
                                        <Text style={[s.td, { width: '9%' }]}>{toUpper(h.section)}</Text>
                                        <Text style={[s.td, { width: '9%' }]}>{toUpper(h.house)}</Text>
                                        <Text style={[s.td, { width: '12%' }]}>{toUpper(h.year)}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>

                    {/* ── 4. FEE SCHEDULE (if present) ── */}
                    {data.fees ? (
                        <View style={s.section} wrap={false}>
                            <Text style={s.sectionTitle}>4. FEE SCHEDULE, {toUpper(data.fees.academicYear)}</Text>
                            <FeeGrid fees={data.fees} />
                            <Text style={s.note}>
                                AMOUNT OF EACH FEE HEAD BY MONTH, WITH ITS STATUS UNDERNEATH: PAID, ISSUED, PART PAID OR WAIVED. NO STATUS MEANS NOT ISSUED YET. AS ON FINANCE, STUDENT OVERRIDES.
                            </Text>
                        </View>
                    ) : data.feesNote ? (
                        <Text style={s.note}>{toUpper(data.feesNote)}</Text>
                    ) : null}

                    {/* ── SIBLINGS SECTION (at bottom, flows onto page 2 if many) ── */}
                    <View style={s.section} wrap={true}>
                        <Text style={s.sectionTitle}>
                            {data.fees ? '5. SIBLINGS' : '4. SIBLINGS'}
                        </Text>
                        <View style={s.table}>
                            <View style={s.tr} fixed>
                                <Text style={[s.th, { width: '8%' }]}>PHOTO</Text>
                                <Text style={[s.th, { width: '14%' }]}>LINK TO GR</Text>
                                <Text style={[s.th, { width: '26%' }]}>NAME</Text>
                                <Text style={[s.th, { width: '18%' }]}>CLASS / SECTION</Text>
                                <Text style={[s.th, { width: '22%' }]}>CAMPUS</Text>
                                <Text style={[s.th, { width: '12%' }]}>STATUS</Text>
                            </View>
                            {data.siblings.length === 0 ? (
                                <Text style={s.empty}>NO SIBLINGS IN THIS FAMILY.</Text>
                            ) : (
                                data.siblings.map((sib, i) => (
                                    <View
                                        key={i}
                                        style={[s.tr, i === data.siblings.length - 1 ? { borderBottomWidth: 0 } : {}]}
                                        wrap={false}
                                    >
                                        <View style={[{ width: '8%', paddingVertical: 2, paddingHorizontal: 3 }]}>
                                            <View style={s.siblingPhotoBox}>
                                                {sib.photoDataUrl ? (
                                                    <Image src={sib.photoDataUrl} style={s.siblingPhotoImg} />
                                                ) : (
                                                    <Text style={s.siblingNoPhoto}>NO PHOTO</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={[s.td, s.bold, { width: '14%' }]}>{toUpper(sib.gr)}</Text>
                                        <Text style={[s.td, s.bold, { width: '26%' }]}>{toUpper(sib.name)}</Text>
                                        <Text style={[s.td, s.bold, { width: '18%' }]}>{toUpper(sib.grade)}</Text>
                                        <Text style={[s.td, s.bold, { width: '22%' }]}>{toUpper(sib.campus)}</Text>
                                        <Text style={[s.td, s.bold, { width: '12%' }]}>{toUpper(sib.status)}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                </View>

                {/* ── FOOTER ── */}
                <Text
                    style={s.footer}
                    fixed
                    render={({ pageNumber, totalPages }) =>
                        toUpper(`PRINTED ${data.printedAt} BY ${data.printedBy} FROM TAFSYNC${totalPages > 1 ? ` · PAGE ${pageNumber} OF ${totalPages}` : ''}`)}
                />
            </Page>
        </Document>
    );
}
