export type ChartColor =
    | 'chart-1'
    | 'chart-2'
    | 'chart-3'
    | 'chart-4'
    | 'chart-5'
    | 'chart-6'
    | 'chart-7'
    | 'chart-8'
    | 'chart-9'
    | 'chart-10'
    | 'chart-11';

export type ChartDisabled = 'chart-disabled';

export type ValueFormatter = (total: number) => { unit?: string; value: string };

export type XCategories = string[];
export type YTickFormatter = (tick: any, index: number, ticks: any[]) => string | number;

export interface XYData {
    x: number | string;
    y: number;
}

export const emptyColorsToken: ChartDisabled[] = ['chart-disabled'];
export const fullColorsToken: ChartColor[] = [
    'chart-1',
    'chart-2',
    'chart-3',
    'chart-4',
    'chart-5',
    'chart-6',
    'chart-7',
    'chart-8',
    'chart-9',
    'chart-10',
    'chart-11'
];
export const emptyColors = emptyColorsToken.map(token => `var(--${token})`);
export const fullColors = fullColorsToken.map(token => `var(--${token})`);

export const hexToRgb = (hex: any) =>
    hex
        //@ts-ignore
        .replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1)
        .match(/.{2}/g)
        .map((x: any) => parseInt(x, 16));
