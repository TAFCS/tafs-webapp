export const ZK_DEVICE_NAMES: Record<string, string> = {
    NYU7261205221: 'Campus 2 Device 1',
    NYU7261205141: 'Campus 2 Device 2',
    NYU7261205172: 'TAFSAL',
    NYU7261205142: 'Campus 3 Device 1',
    NYU7261205128: 'Campus 3 Device 2',
    NYU7251000240: 'Johar Faculty',
};

export function getDeviceName(sn: string | null | undefined): string {
    if (!sn) return '—';
    return ZK_DEVICE_NAMES[sn] ?? sn;
}
