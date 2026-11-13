/** TAFSD-510: the schedule editor's grid rows, and reading rows pasted from the school's Excel sheets. */

export interface GridRow {
    key: string;
    date: string;
    time: string;
    cells: Record<number, string>;
}

export const newKey = () => Math.random().toString(36).slice(2);

const DATE_RE = /(\d{1,2})\s*[-–/.]\s*(\d{1,2})\s*[-–/.]\s*(\d{4})/;
const TIME_RE = /^\s*\d{1,2}\s*:\s*\d{2}\s*[-–]\s*\d{1,2}\s*:\s*\d{2}/;

/**
 * Rows copied from the school's Excel / Word schedules: [S. #,] DAY, DATE, then
 * either TIME followed by one subject per class (most sheets), or subject / time
 * pairs per class (the O Level sheet). Subjects are matched to the ticked classes
 * in order; "-" means no paper.
 */
export function parsePaste(text: string, classIds: number[], fallbackTime: string): GridRow[] {
    const rows: GridRow[] = [];
    const isTime = (c: string) => TIME_RE.test(c);
    const tidyTime = (c: string) => c.match(/\d{1,2}\s*:\s*\d{2}\s*[-–]\s*\d{1,2}\s*:\s*\d{2}/)![0].replace(/\s*[-–]\s*/, " – ").replace(/\s*:\s*/g, ":");
    for (const line of text.split(/\r?\n/)) {
        const cells = line.split("\t").map((c) => c.replace(/\s+/g, " ").trim());
        const dateIdx = cells.findIndex((c) => DATE_RE.test(c));
        if (dateIdx === -1) continue;
        const m = DATE_RE.exec(cells[dateIdx])!;
        const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        const rest = cells.slice(dateIdx + 1);
        while (rest.length && rest[rest.length - 1] === "") rest.pop();

        let time = fallbackTime;
        let subjects: string[];
        if (rest.length && isTime(rest[0])) {
            time = tidyTime(rest[0]);
            subjects = rest.slice(1);
        } else if (rest.some((c, i) => i % 2 === 1 && isTime(c))) {
            // subject, time, subject, time …
            subjects = rest.filter((_, i) => i % 2 === 0);
            const firstTime = rest.find((c, i) => i % 2 === 1 && isTime(c));
            if (firstTime) time = tidyTime(firstTime);
        } else {
            subjects = rest;
        }
        const row: GridRow = { key: newKey(), date, time, cells: {} };
        classIds.forEach((id, i) => {
            const s = subjects[i];
            if (s && s !== "-") row.cells[id] = s.toUpperCase();
        });
        rows.push(row);
    }
    return rows;
}
