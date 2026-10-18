import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Don't break words like "Campus" across lines.
Font.registerHyphenationCallback((word) => [word]);

/**
 * TAFSD-345: one-page A4 student profile, printed from the Student Directory
 * window. Laid out like the leaving and transfer certificates: crest and
 * school heading, photo box, ruled sections. Holds only what the printing
 * user's own requests returned, so it never shows more than their scope.
 */

export interface ProfileField {
    label: string;
    value: string | null | undefined;
}

export interface ProfileGuardian {
    relationship: string;
    name: string;
    cnic: string;
    phone: string;
    occupation: string;
}

export interface ProfileSibling {
    cc: number | string;
    gr: string;
    name: string;
    klass: string;
    status: string;
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

export interface ProfileFeeSchedule {
    academicYear: string;
    months: { month: number; label: string }[];
    heads: { name: string; cells: Record<number, string> }[];
}

export interface StudentProfileData {
    schoolName: string;
    campusName: string;
    logoUrl: string | null;
        photoUrl: string | null;
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
    /** Why the fee schedule isn't printed, when it isn't. */
    feesNote: string | null;
    printedAt: string;
    printedBy: string;
}

// Plain on purpose: black on white, normal case, ruled tables. Easy to read
// on a photocopy, no colour needed.
const RULE = '#999';

const s = StyleSheet.create({
    page: { paddingTop: 24, paddingBottom: 40, paddingHorizontal: 30, fontFamily: 'Helvetica', fontSize: 8.5, color: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderColor: '#000', marginBottom: 8 },
    logo: { width: 44, height: 44, marginRight: 10 },
    titleBox: { flex: 1 },
    school: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
    title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    campus: { fontSize: 9, marginTop: 2 },
    photo: { width: 62, height: 74, borderWidth: 0.75, borderColor: '#000', marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
    photoImg: { width: 61, height: 73, objectFit: 'cover' },
    photoText: { fontSize: 7, color: '#555' },
    strip: { flexDirection: 'row', marginBottom: 10 },
    stripItem: { flex: 1, flexDirection: 'row' },
    stripLabel: { color: '#444', marginRight: 4 },
    stripValue: { fontFamily: 'Helvetica-Bold' },
    section: { marginBottom: 10 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.75, borderColor: '#000', marginBottom: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    field: { width: '50%', flexDirection: 'row', paddingVertical: 2.5, paddingRight: 10, borderBottomWidth: 0.5, borderColor: RULE },
    field3: { width: '33.33%', flexDirection: 'row', paddingVertical: 2.5, paddingRight: 10, borderBottomWidth: 0.5, borderColor: RULE },
    fieldLabel: { width: 82, color: '#444' },
    fieldValue: { flex: 1, fontFamily: 'Helvetica-Bold' },
    table: { borderTopWidth: 0.5, borderColor: RULE },
    tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: RULE },
    th: { fontFamily: 'Helvetica-Bold', paddingVertical: 2.5, paddingHorizontal: 3 },
    td: { paddingVertical: 2.5, paddingHorizontal: 3 },
    sub: { fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2 },
    empty: { color: '#555', paddingVertical: 2 },
    feeCell: { width: 36, textAlign: 'center', paddingVertical: 2.5, fontSize: 7.5 },
    note: { fontSize: 7.5, color: '#444', marginTop: 3 },
    footer: { position: 'absolute', bottom: 18, left: 30, right: 30, fontSize: 7.5, color: '#444', borderTopWidth: 0.5, borderColor: RULE, paddingTop: 4 },
});

const v = (x: string | null | undefined) => (x && String(x).trim() ? String(x) : '—');

function Fields({ items, cols = 2 }: { items: ProfileField[]; cols?: 2 | 3 }) {
    return (
        <View style={s.grid}>
            {items.map((f) => (
                <View key={f.label} style={cols === 3 ? s.field3 : s.field} wrap={false}>
                    <Text style={s.fieldLabel}>{f.label}</Text>
                    <Text style={s.fieldValue}>{v(f.value)}</Text>
                </View>
            ))}
        </View>
    );
}

function Table<T>({ cols, rows, empty }: { cols: { title: string; width: string | number; get: (r: T) => string }[]; rows: T[]; empty: string }) {
    if (!rows.length) return <Text style={s.empty}>{empty}</Text>;
    return (
        <View style={s.table}>
            <View style={s.tr} fixed>
                {cols.map((c) => (
                    <Text key={c.title} style={[s.th, { width: c.width }]}>{c.title}</Text>
                ))}
            </View>
            {rows.map((r, i) => (
                <View key={i} style={[s.tr, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                    {cols.map((c) => (
                        <Text key={c.title} style={[s.td, { width: c.width }]}>{v(c.get(r))}</Text>
                    ))}
                </View>
            ))}
        </View>
    );
}

export function StudentProfilePDF({ data }: { data: StudentProfileData }) {
    return (
        <Document title={`Student Profile — ${data.name} (CC ${data.cc})`} author="TAFSync">
            <Page size="A4" style={s.page}>
                <View>
                    <View style={s.header}>
                        {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : <View style={s.logo} />}
                        <View style={s.titleBox}>
                            <Text style={s.school}>{data.schoolName}</Text>
                            <Text style={s.title}>Student Profile</Text>
                            {data.campusName ? <Text style={s.campus}>{data.campusName}</Text> : null}
                        </View>
                        <View style={s.photo}>
                            {data.photoUrl ? <Image src={data.photoUrl} style={s.photoImg} /> : <Text style={s.photoText}>No photo</Text>}
                        </View>
                    </View>

                    <View style={s.strip}>
                        <View style={s.stripItem}><Text style={s.stripLabel}>CC</Text><Text style={s.stripValue}>{v(String(data.cc))}</Text></View>
                        <View style={s.stripItem}><Text style={s.stripLabel}>GR</Text><Text style={s.stripValue}>{v(data.gr)}</Text></View>
                        <View style={s.stripItem}><Text style={s.stripLabel}>Status</Text><Text style={s.stripValue}>{v(data.status)}</Text></View>
                        <View style={s.stripItem}><Text style={s.stripLabel}>Session</Text><Text style={s.stripValue}>{v(data.academicYear)}</Text></View>
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>1. Student details</Text>
                        <Fields items={data.details} />
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>2. Guardians and family</Text>
                        <Table<ProfileGuardian>
                            rows={data.guardians}
                            empty="No guardians on record."
                            cols={[
                                { title: 'Relation', width: '13%', get: (g) => g.relationship },
                                { title: 'Name', width: '29%', get: (g) => g.name },
                                { title: 'CNIC', width: '19%', get: (g) => g.cnic },
                                { title: 'Phone', width: '17%', get: (g) => g.phone },
                                { title: 'Occupation', width: '22%', get: (g) => g.occupation },
                            ]}
                        />
                        <View style={{ marginTop: 4 }}>
                            <Fields items={data.family} />
                        </View>
                        <Text style={s.sub}>Siblings</Text>
                        <Table<ProfileSibling>
                            rows={data.siblings}
                            empty="No siblings in this family."
                            cols={[
                                { title: 'CC', width: '10%', get: (r) => String(r.cc) },
                                { title: 'GR', width: '14%', get: (r) => r.gr },
                                { title: 'Name', width: '38%', get: (r) => r.name },
                                { title: 'Class', width: '20%', get: (r) => r.klass },
                                { title: 'Status', width: '18%', get: (r) => r.status },
                            ]}
                        />
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionTitle}>3. History</Text>
                        <Table<ProfileHistoryRow>
                            rows={data.history}
                            empty="No progression history recorded."
                            cols={[
                                { title: 'From', width: '11%', get: (r) => r.from },
                                { title: 'To', width: '11%', get: (r) => r.to },
                                { title: 'Change', width: '12%', get: (r) => r.change },
                                { title: 'Campus', width: '23%', get: (r) => r.campus },
                                { title: 'Class', width: '13%', get: (r) => r.klass },
                                { title: 'Section', width: '9%', get: (r) => r.section },
                                { title: 'House', width: '9%', get: (r) => r.house },
                                { title: 'Session', width: '12%', get: (r) => r.year },
                            ]}
                        />
                    </View>

                    {data.fees ? (
                        <View style={s.section} wrap={false}>
                            <Text style={s.sectionTitle}>4. Fee schedule, {data.fees.academicYear}</Text>
                            <View style={s.table}>
                                <View style={s.tr}>
                                    <Text style={[s.th, { flex: 1 }]}>Head</Text>
                                    {data.fees.months.map((m) => (
                                        <Text key={m.month} style={[s.th, s.feeCell]}>{m.label}</Text>
                                    ))}
                                </View>
                                {data.fees.heads.map((h, i) => (
                                    <View key={h.name} style={[s.tr, i === data.fees!.heads.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                                        <Text style={[s.td, { flex: 1 }]}>{h.name}</Text>
                                        {data.fees!.months.map((m) => (
                                            <Text key={m.month} style={s.feeCell}>{h.cells[m.month] ?? ''}</Text>
                                        ))}
                                    </View>
                                ))}
                            </View>
                            <Text style={s.note}>Status of each fee head by month, as on Finance, Student Overrides. Amounts not shown.</Text>
                        </View>
                    ) : data.feesNote ? (
                        <Text style={s.note}>{data.feesNote}</Text>
                    ) : null}
                </View>

                <Text
                    style={s.footer}
                    fixed
                    render={({ pageNumber, totalPages }) =>
                        `Printed ${data.printedAt} by ${data.printedBy} from TAFSync${totalPages > 1 ? `   ·   Page ${pageNumber} of ${totalPages}` : ''}`}
                />
            </Page>
        </Document>
    );
}
