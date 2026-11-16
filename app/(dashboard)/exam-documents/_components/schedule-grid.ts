/** TAFSD-510: the schedule editor's grid rows. Schedules are made on the page (TAFSD-524: no paste from Excel). */

export interface GridRow {
    key: string;
    date: string;
    time: string;
    cells: Record<number, string>;
}

export const newKey = () => Math.random().toString(36).slice(2);
