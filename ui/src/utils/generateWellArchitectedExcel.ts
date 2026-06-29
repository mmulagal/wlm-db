import * as ExcelJS from 'exceljs';
import { t } from 'i18next';

import store from '../store/store';
import {
    formatOptimizationBreakDown,
    formatFlatAssessments,
    getOrderedAssessmentIdsByCategory
} from '../workloadFactory/GetWell/GetWellUtils';
import {
    getOracleCardsData,
    formatOracleOptimizationBreakDown
} from '../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { buildSubConfigValues, getColumnConfig, getDialogContentConfig, type DialogSectionDef } from './configRegistry';
import { getRecommendation } from './recommendations';
import { ASSESSMENT_CONFIG_IDS, ASSESSMENT_CONFIG_NAMES, DBType } from './consts';
import type { FlatAssessmentItem, FlatAssessmentResponse } from './types/getWellTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailSheetRow = Record<string, string>;

interface ConfigurationStatusRow {
    'Configuration name': string;
    Category: string;
    Status: string;
    Severity: string;
    'Resource type': string;
    'Impacted resources (X out of Y)': string;
}

interface WorkbookInput {
    fileName: string;
    generalInfo: Record<string, string>;
    configurationStatus: ConfigurationStatusRow[];
    displayToInternal: Map<string, string>;
    assessmentsById: Map<string, FlatAssessmentItem>;
    orderedIds: string[];
}

interface TableConfig<T = Record<string, string>> {
    title: string;
    columnHeaders: string[];
    columnSpan: number;
    dataExtractor: (row: T) => string[];
    dataFilter: (row: T) => boolean;
}

// ---------------------------------------------------------------------------
// Config ordering (v2 flat API — by category, matching GetWell UI sections)
// ---------------------------------------------------------------------------

const MULTI_TABLE_CONFIGS = ['compute-rightsizing', 'rss-config', 'clone-management', 'sql-license'];

function usesMultiTableLayout(configId: string, assessment: FlatAssessmentItem): boolean {
    if (configId === 'sql-license') {
        return Boolean((assessment as any).sqlServerInstances?.length);
    }
    return MULTI_TABLE_CONFIGS.includes(configId);
}

const DETAIL_SHEET_SUMMARY_ROW = 1;
const DETAIL_SHEET_HYPERLINK_ROW = 4;
const DETAIL_SHEET_FIRST_TABLE_ROW = 6;
const DETAIL_SHEET_TABLE_GAP_ROWS = 2;

const IMPACTED_TABLE_TITLE_MARKERS = [
    'Impacted resources',
    'Impacted Resources',
    'Impacted volumes',
    'Impacted luns',
    'Impacted drives',
    'Impacted databases',
    'Impacted adapters',
    'File systems',
    'SQL Instances License details',
    'Recommended Adapter Settings',
    'RSS Adapters',
    'Sub-configuration settings'
];

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

const COLORS = {
    LIGHT_BLUE: 'FFADD8E6',
    STEEL_BLUE: 'FF4682B4',
    SKY_BLUE: 'FF87CEEB',
    WHITE: 'FFFFFFFF',
    BLACK: 'FF000000'
};

const COLUMN_WIDTH_PADDING = 3;
const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 60;

const createCellStyle = (fill?: string, font?: any, alignment?: Partial<ExcelJS.Alignment>, border = true) => ({
    ...(fill && {
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: fill } }
    }),
    ...(font && { font }),
    ...(alignment && { alignment }),
    ...(border && {
        border: {
            top: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            left: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            bottom: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            right: { style: 'thin' as const, color: { argb: COLORS.BLACK } }
        }
    })
});

function applyCellStyle(cell: ExcelJS.Cell, style: ReturnType<typeof createCellStyle>): void {
    const targetCell = cell;
    if (style.fill) targetCell.fill = style.fill;
    if (style.font) targetCell.font = style.font;
    if (style.alignment) targetCell.alignment = style.alignment;
    if (style.border) targetCell.border = style.border;
}

function addHeaderStyling(worksheet: ExcelJS.Worksheet, data: Record<string, string>[]): void {
    if (!data?.length) return;
    const targetWorksheet = worksheet;
    const columns = Object.keys(data[0] || {});
    targetWorksheet.getRow(1).height = 25;
    const headerStyle = createCellStyle(
        COLORS.LIGHT_BLUE,
        { bold: true, color: { argb: COLORS.BLACK } },
        { horizontal: 'center', vertical: 'middle', wrapText: true }
    );
    columns.forEach((columnKey, index) => {
        const cell = targetWorksheet.getCell(1, index + 1);
        cell.value = columnKey.toUpperCase();
        applyCellStyle(cell, headerStyle);
    });
}

function styleDataRows(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
): void {
    const dataStyle = createCellStyle(COLORS.WHITE, undefined, {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true
    });
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            applyCellStyle(worksheet.getCell(row, col), dataStyle);
        }
    }
}

function styleTableBorders(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
): void {
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            const cell = worksheet.getCell(row, col);
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.BLACK } },
                left: { style: 'thin', color: { argb: COLORS.BLACK } },
                bottom: { style: 'thin', color: { argb: COLORS.BLACK } },
                right: { style: 'thin', color: { argb: COLORS.BLACK } }
            };
        }
    }
}

function getDataColumnKeys(data: Record<string, string>[]): string[] {
    const allColumns = new Set<string>();
    data.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => allColumns.add(key));
        }
    });
    return Array.from(allColumns);
}

function addDataToWorksheet(worksheet: ExcelJS.Worksheet, data: Record<string, string>[]): void {
    if (!data?.length) return;
    const targetWorksheet = worksheet;
    const columns = getDataColumnKeys(data);
    columns.forEach((header, index) => {
        targetWorksheet.getCell(1, index + 1).value = header;
    });
    data.forEach((row, rowIndex) => {
        columns.forEach((column, colIndex) => {
            targetWorksheet.getCell(rowIndex + 2, colIndex + 1).value = row[column] || '';
        });
    });
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, data: Record<string, string>[]): void {
    if (!data?.length) return;
    const targetWorksheet = worksheet;
    const allKeys = new Set<string>();
    data.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => allKeys.add(key));
        }
    });
    Array.from(allKeys).forEach((key, index) => {
        let maxWidth = key.length;
        data.forEach(row => {
            if (row?.[key] !== undefined && row[key] !== null) {
                maxWidth = Math.max(maxWidth, row[key].toString().length);
            }
        });
        if (key.toUpperCase() === 'RECOMMENDATION') maxWidth = Math.max(maxWidth, 20);
        targetWorksheet.getColumn(index + 1).width = Math.min(
            Math.max(maxWidth + COLUMN_WIDTH_PADDING, MIN_COLUMN_WIDTH),
            MAX_COLUMN_WIDTH
        );
    });
}

function getExcelColumnLetter(columnNumber: number): string {
    let letter = '';
    let num = columnNumber;
    while (num > 0) {
        const remainder = (num - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        num = Math.floor((num - 1) / 26);
    }
    return letter;
}

function addAutoFilter(worksheet: ExcelJS.Worksheet, data: Record<string, string>[]): void {
    if (!data?.length) return;
    const targetWorksheet = worksheet;
    const colCount = getDataColumnKeys(data).length;
    if (colCount > 0) {
        targetWorksheet.autoFilter = {
            from: 'A1',
            to: `${getExcelColumnLetter(colCount)}${data.length + 1}`
        };
    }
}

function sanitizeWorksheetName(name: string): string {
    let sanitized = name.replace(/[*?:\\/[\]]/g, '_');
    if (sanitized.length > 31) sanitized = sanitized.substring(0, 31);
    return sanitized;
}

function uniqueWorksheetName(name: string, usedNames: Set<string>): string {
    let candidate = sanitizeWorksheetName(name);
    let counter = 2;
    while (usedNames.has(candidate.toLowerCase())) {
        const suffix = `_${counter}`;
        candidate = sanitizeWorksheetName(`${name}${suffix}`);
        counter += 1;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
}

function addConfigurationStatusHyperlink(
    worksheet: ExcelJS.Worksheet,
    row = DETAIL_SHEET_HYPERLINK_ROW,
    column = 1
): void {
    const hyperlinkCell = worksheet.getCell(row, column);
    hyperlinkCell.value = {
        text: '↖ Back to Configuration Status',
        hyperlink: "#'Configuration Status'!A1",
        tooltip: 'Navigate to Configuration Status sheet'
    };
    hyperlinkCell.font = { color: { argb: 'FF0000FF' }, underline: true, bold: true, size: 10 };
    hyperlinkCell.alignment = { horizontal: 'left', vertical: 'middle' };
}

function createBaseConfigTable(worksheet: ExcelJS.Worksheet, data: Record<string, string>[], startRow = 1): number {
    if (!data.length) return startRow;
    const baseColumns = Object.keys(data[0] || {});
    baseColumns.forEach((header, index) => {
        const cell = worksheet.getCell(startRow, index + 1);
        cell.value = header.toUpperCase();
        applyCellStyle(
            cell,
            createCellStyle(
                COLORS.LIGHT_BLUE,
                { bold: true, color: { argb: COLORS.BLACK } },
                { horizontal: 'center', vertical: 'middle', wrapText: true }
            )
        );
    });
    data.forEach((row, rowIndex) => {
        if (row && Object.keys(row).length > 0) {
            baseColumns.forEach((column, colIndex) => {
                const cell = worksheet.getCell(startRow + rowIndex + 1, colIndex + 1);
                cell.value = row[column] || '';
                applyCellStyle(
                    cell,
                    createCellStyle(COLORS.WHITE, undefined, {
                        horizontal: 'left',
                        vertical: 'middle',
                        wrapText: true
                    })
                );
            });
        }
    });
    return startRow + data.length + 1;
}

function createStyledTable<T extends Record<string, string>>(
    worksheet: ExcelJS.Worksheet,
    config: TableConfig<T>,
    data: T[],
    startRow: number
): number {
    const filteredData = data.filter(config.dataFilter);
    if (!filteredData.length) return startRow;

    const targetWorksheet = worksheet;
    let currentRow = startRow;
    const headerCell = targetWorksheet.getCell(currentRow, 1);
    headerCell.value = config.title;
    targetWorksheet.mergeCells(`A${currentRow}:${getExcelColumnLetter(config.columnSpan)}${currentRow}`);
    applyCellStyle(
        headerCell,
        createCellStyle(
            COLORS.STEEL_BLUE,
            { bold: true, color: { argb: COLORS.WHITE } },
            { horizontal: 'center', vertical: 'middle', wrapText: true }
        )
    );
    targetWorksheet.getRow(currentRow).height = 25;
    currentRow += 1;

    config.columnHeaders.forEach((header, colIndex) => {
        const cell = targetWorksheet.getCell(currentRow, colIndex + 1);
        cell.value = header;
        applyCellStyle(
            cell,
            createCellStyle(
                COLORS.SKY_BLUE,
                { bold: true, color: { argb: COLORS.BLACK } },
                { horizontal: 'center', vertical: 'middle', wrapText: true }
            )
        );
    });
    targetWorksheet.getRow(currentRow).height = 25;
    currentRow += 1;

    const dataStartRow = currentRow;
    filteredData.forEach(row => {
        config.dataExtractor(row).forEach((value, colIndex) => {
            const cell = targetWorksheet.getCell(currentRow, colIndex + 1);
            cell.value = value;
            applyCellStyle(
                cell,
                createCellStyle(COLORS.WHITE, undefined, {
                    horizontal: 'left',
                    vertical: 'middle',
                    wrapText: true
                })
            );
        });
        currentRow += 1;
    });

    const tableEndRow = currentRow - 1;
    styleTableBorders(targetWorksheet, dataStartRow - 2, tableEndRow, 1, config.columnSpan);
    if (tableEndRow >= dataStartRow) {
        targetWorksheet.autoFilter = {
            from: `A${dataStartRow - 1}`,
            to: `${getExcelColumnLetter(config.columnSpan)}${tableEndRow}`
        };
    }
    return currentRow + 1;
}

function isEmptyDetailRow(row?: DetailSheetRow): boolean {
    return !row || Object.keys(row).length === 0 || Object.values(row).every(value => value === '');
}

function isColumnHeaderRow(row: DetailSheetRow): boolean {
    return Object.entries(row).every(([key, value]) => value === key);
}

function getTableTitleFromRow(row: DetailSheetRow): string | undefined {
    const values = Object.values(row).filter(value => value !== '');
    if (values.length !== 1) return undefined;
    const title = values[0];
    if (IMPACTED_TABLE_TITLE_MARKERS.includes(title)) return title;
    if (title.startsWith('Impacted ') || title.endsWith(' settings')) return title;
    return undefined;
}

function isImpactedTableTitle(value: string): boolean {
    return (
        IMPACTED_TABLE_TITLE_MARKERS.includes(value) ||
        value.startsWith('Impacted ') ||
        value === 'Recommendation Options' ||
        value === 'Objects in Violation'
    );
}

function writeStyledDataTable(
    worksheet: ExcelJS.Worksheet,
    title: string,
    headerRow: DetailSheetRow,
    dataRows: DetailSheetRow[],
    startRow: number
): number {
    const columnHeaders = Object.keys(headerRow);
    const columnSpan = columnHeaders.length;
    if (!columnSpan) return startRow;

    const tableRows = [headerRow, ...dataRows];
    return createStyledTable(
        worksheet,
        {
            title,
            columnHeaders,
            columnSpan,
            dataFilter: row =>
                Boolean(
                    row &&
                        Object.keys(row).length > 0 &&
                        !isColumnHeaderRow(row) &&
                        !Object.values(row).some(value => isImpactedTableTitle(value))
                ),
            dataExtractor: row => columnHeaders.map(header => row[header] || '')
        },
        tableRows,
        startRow
    );
}

interface ParsedDetailTable {
    title: string;
    headerRow: DetailSheetRow;
    dataRows: DetailSheetRow[];
}

function parseDetailSheetTables(rows: DetailSheetRow[]): ParsedDetailTable[] {
    const tables: ParsedDetailTable[] = [];
    let index = 1;

    while (index < rows.length) {
        while (index < rows.length && isEmptyDetailRow(rows[index])) index += 1;
        if (index >= rows.length) break;

        const tableTitle = getTableTitleFromRow(rows[index]);
        const headerRow = rows[index + 1];
        if (tableTitle && headerRow && isColumnHeaderRow(headerRow)) {
            index += 2;
            const dataRows: DetailSheetRow[] = [];
            while (index < rows.length && !isEmptyDetailRow(rows[index]) && !getTableTitleFromRow(rows[index])) {
                dataRows.push(rows[index]);
                index += 1;
            }
            tables.push({ title: tableTitle, headerRow, dataRows });
        } else {
            index += 1;
        }
    }

    return tables;
}

function addSectionedDetailSheetToWorksheet(worksheet: ExcelJS.Worksheet, rows: DetailSheetRow[]): void {
    if (!rows.length) return;

    if (rows[0]) {
        createBaseConfigTable(worksheet, [rows[0]], DETAIL_SHEET_SUMMARY_ROW);
    }

    const tables = parseDetailSheetTables(rows);
    let nextRow = DETAIL_SHEET_FIRST_TABLE_ROW;

    tables.forEach((table, tableIndex) => {
        if (tableIndex > 0) {
            nextRow += DETAIL_SHEET_TABLE_GAP_ROWS;
        }
        nextRow = writeStyledDataTable(worksheet, table.title, table.headerRow, table.dataRows, nextRow);
    });
}

// ---------------------------------------------------------------------------
// V2 flat data layer
// ---------------------------------------------------------------------------

function validateFlatAssessmentResponse(data: unknown): FlatAssessmentResponse {
    if (!data || typeof data !== 'object') {
        throw new Error('Malformed input data: expected a flat assessment response object.');
    }
    const response = data as Partial<FlatAssessmentResponse>;
    if (!Array.isArray(response.assessments)) {
        throw new Error('Malformed input data: missing or invalid "assessments" array. V2 flat API is required.');
    }
    if (!response.metadata || typeof response.metadata !== 'object') {
        throw new Error('Malformed input data: missing or invalid "metadata" object. V2 flat API is required.');
    }
    return response as FlatAssessmentResponse;
}

function getDisplayNameFromConfigId(configId: string): string | undefined {
    const configKey = (Object.keys(ASSESSMENT_CONFIG_IDS) as Array<keyof typeof ASSESSMENT_CONFIG_IDS>).find(
        key => ASSESSMENT_CONFIG_IDS[key] === configId
    );
    if (!configKey) {
        return undefined;
    }
    return ASSESSMENT_CONFIG_NAMES[configKey as keyof typeof ASSESSMENT_CONFIG_NAMES];
}

function getConfigurationDisplayName(configId: string, assessment?: FlatAssessmentItem): string {
    return getDisplayNameFromConfigId(configId) ?? assessment?.name ?? configId;
}

function getStaticRecommendationText(configId: string, databaseType: string, displayName: string): string {
    const recommendation = getRecommendation(configId, databaseType);
    if (!recommendation) return '';
    const parts: string[] = [];
    if (recommendation.description) parts.push(recommendation.description);
    if (recommendation.valuesHeading && recommendation.values?.length) {
        parts.push(`${recommendation.valuesHeading}\n${recommendation.values.join('\n')}`);
    }
    if (recommendation.descriptionList?.length) {
        recommendation.descriptionList.forEach(item => parts.push(`${item.title}\n${item.description}`));
    }
    if (recommendation.info) parts.push(recommendation.info);
    return parts.join('\n\n') || recommendation.title || `${displayName} recommendation`;
}

function translateSectionField(value?: string): string {
    if (!value) return '';
    return value.startsWith('databases.') ? t(value) : value;
}

function formatSectionContent(section: DialogSectionDef): string {
    const content = translateSectionField(section.content);
    if (section.type === 'bullets' && section.items?.length) {
        return section.items.map(item => `• ${translateSectionField(item)}`).join('\n');
    }
    if (section.type === 'numberedSteps' && section.items?.length) {
        return section.items.map((item, index) => `${index + 1}. ${translateSectionField(item)}`).join('\n');
    }
    return content;
}

function getSubConfigKey(detail: { id?: string; name?: string }): string {
    return detail.id ?? detail.name ?? '';
}

function formatSubConfigDisplayName(subConfigId?: string): string {
    if (!subConfigId) return '';
    return (
        getDisplayNameFromConfigId(subConfigId) ??
        subConfigId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    );
}

function buildGuidanceSummaryText(configId: string, databaseType: string, isWad: boolean): string {
    const dialogConfig = getDialogContentConfig(configId, databaseType);
    if (!dialogConfig?.sections?.length) return '';

    const parts: string[] = [];
    dialogConfig.sections.forEach(section => {
        if (section.hideWhenWad && isWad) return;
        const heading = translateSectionField(section.heading);
        const content = formatSectionContent(section);
        if (heading) parts.push(heading);
        if (content) parts.push(content);
    });
    return parts.join('\n\n');
}

function formatImpactedResourcesDisplay(
    assessment: FlatAssessmentItem,
    violationCountLabel?: (count: number) => string
): string {
    if (assessment.errorMessage) return assessment.errorMessage;
    if (typeof assessment.totalObjectsAssessed === 'number') {
        return `${assessment.totalObjectsInViolation || 0} out of ${assessment.totalObjectsAssessed}`;
    }
    const violationCount = assessment.objectsInViolation?.length;
    if (violationCount) {
        return violationCountLabel ? violationCountLabel(violationCount) : `${violationCount} out of ${violationCount}`;
    }
    return 'n/a';
}

function buildSummaryBlock(
    assessment: FlatAssessmentItem,
    configId: string,
    databaseType: string,
    isWad: boolean
): DetailSheetRow {
    const displayName = getConfigurationDisplayName(configId, assessment);
    const impacted = formatImpactedResourcesDisplay(assessment, count => `${count} impacted`);
    const actionSummary = buildGuidanceSummaryText(configId, databaseType, isWad);

    return {
        'Configuration name': displayName,
        ...(assessment.status && { Status: assessment.status }),
        ...(assessment.severity && {
            Severity: assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)
        }),
        Recommendation: getStaticRecommendationText(configId, databaseType, displayName),
        ...(assessment.current !== undefined && assessment.current !== '' && { Current: String(assessment.current) }),
        ...(assessment.recommended !== undefined &&
            assessment.recommended !== '' && { Recommended: String(assessment.recommended) }),
        ...(actionSummary && { 'Action Summary': actionSummary }),
        'Well-Architected categories': (assessment.categories || []).join(', '),
        'Impacted resources (X out of Y)': impacted
    };
}

function buildTableA(configDetails: FlatAssessmentItem['configDetails'] = []): DetailSheetRow[] {
    if (!configDetails?.length) return [];
    const rows: DetailSheetRow[] = [
        {},
        { 'Sub-configuration': 'Sub-configuration settings' },
        { 'Sub-configuration': 'Sub-configuration', Recommended: 'Recommended', 'Object type': 'Object type' }
    ];
    configDetails.forEach(detail => {
        const subConfigKey = getSubConfigKey(detail);
        if (!subConfigKey) return;
        rows.push({
            'Sub-configuration': formatSubConfigDisplayName(subConfigKey),
            Recommended: detail.recommended ?? '',
            'Object type': detail.objectType || ''
        });
    });
    return rows;
}

function addImpactedResourcesHeader(details: DetailSheetRow[], columnKeys: string[], title = 'Impacted resources') {
    details.push({}, {});
    const headerRow: DetailSheetRow = {};
    columnKeys.forEach((key, index) => {
        headerRow[key] = index === 0 ? title : '';
    });
    details.push(headerRow);
}

interface SizingDriveRow {
    logAccessPath?: string;
    tempdbAccessPath?: string;
    lunPath?: string;
    databases?: string[];
    sizePercentToDataDrive?: number;
}

/** Log drive size and TempDB drive size expose drive rows under sizingViolations, not violationDetails. */
function buildSizingViolationsDriveTable(
    sizingViolations: NonNullable<FlatAssessmentItem['sizingViolations']>,
    configId: string
): DetailSheetRow[] {
    const drivePathKey: 'logAccessPath' | 'tempdbAccessPath' =
        configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE ? 'logAccessPath' : 'tempdbAccessPath';
    const percentColumnLabel =
        configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE
            ? t('databases.well-architect.log-drive-size-percentage')
            : t('databases.well-architect.tempdb-drive-size-percentage');
    const columns = [
        t('databases.well-architect.drive-name'),
        t('databases.well-architect.lun-path'),
        t('databases.well-architect.databases'),
        t('databases.well-architect.status'),
        percentColumnLabel
    ];

    const mapDrives = (drives: SizingDriveRow[] | undefined, statusLabel: string): DetailSheetRow[] =>
        (drives || []).map(drive => ({
            [columns[0]]: drive[drivePathKey] || '',
            [columns[1]]: drive.lunPath || '',
            [columns[2]]: (drive.databases || []).join(', '),
            [columns[3]]: statusLabel,
            [columns[4]]: drive.sizePercentToDataDrive != null ? `${drive.sizePercentToDataDrive}%` : ''
        }));

    const dataRows: DetailSheetRow[] = [
        ...mapDrives(
            sizingViolations.overProvisionedDrives as SizingDriveRow[] | undefined,
            t('databases.well-architect.over-provisioned')
        ),
        ...mapDrives(
            sizingViolations.underProvisionedDrives as SizingDriveRow[] | undefined,
            t('databases.well-architect.under-provisioned')
        ),
        ...mapDrives(
            sizingViolations.ignoredDrives as SizingDriveRow[] | undefined,
            t('databases.well-architect.shared-drive')
        )
    ];

    if (!dataRows.length) return [];

    const tableTitle = getColumnConfig(configId)?.tableTitle || 'Impacted drives';
    const rows: DetailSheetRow[] = [];
    addImpactedResourcesHeader(rows, columns, tableTitle);
    rows.push(Object.fromEntries(columns.map(label => [label, label])));
    rows.push(...dataRows);
    return rows;
}

function buildTableB(assessment: FlatAssessmentItem, configId: string, databaseType: string): DetailSheetRow[] {
    const columnConfig = getColumnConfig(configId, databaseType);
    const hasSubConfigs = columnConfig?.hasSubConfigs || Boolean(assessment.configDetails?.length);
    const configDetails = assessment.configDetails || [];

    if (assessment.status === 'optimized' || assessment.status === 'n/a') return [];

    const rows: DetailSheetRow[] = [];

    if (hasSubConfigs && assessment.violationDetails?.length) {
        const columns = columnConfig?.columns || [
            { key: 'objectName', label: 'Object name' },
            { key: 'current', label: 'Current' },
            { key: 'recommended', label: 'Recommended' }
        ];
        const columnLabels = columns.map(col => col.label);
        addImpactedResourcesHeader(rows, columnLabels, columnConfig?.tableTitle || 'Impacted resources');
        rows.push(Object.fromEntries(columnLabels.map(label => [label, label])));
        assessment.violationDetails.forEach((violation: any) => {
            const { current, recommended } = buildSubConfigValues(violation, configDetails);
            const dataRow: DetailSheetRow = {};
            columns.forEach(col => {
                if (col.accessor === 'current') dataRow[col.label] = current;
                else if (col.accessor === 'recommended') dataRow[col.label] = recommended;
                else if (col.key === 'objectName') dataRow[col.label] = violation.objectName || '';
                else if (col.key === 'objectType') dataRow[col.label] = violation.objectType || '';
                else if (col.key === 'dataCategory') dataRow[col.label] = violation.dataCategory || '';
                else dataRow[col.label] = violation[col.key] ?? violation.value ?? '';
            });
            rows.push(dataRow);
        });
        return rows;
    }

    if (assessment.violationDetails?.length) {
        const firstViolation = assessment.violationDetails[0];
        const hasValueColumn = firstViolation.value !== undefined && firstViolation.value !== '';
        const hasRecommended = firstViolation.recommended !== undefined;

        if (configId === 'mtu-alignment' || hasRecommended) {
            addImpactedResourcesHeader(rows, ['Object name', 'Current', 'Recommended']);
            rows.push({ 'Object name': 'Object name', Current: 'Current', Recommended: 'Recommended' });
            assessment.violationDetails.forEach((violation: any) => {
                rows.push({
                    'Object name': violation.objectName || '',
                    Current: violation.value || '',
                    Recommended: violation.recommended || ''
                });
            });
            return rows;
        }

        if (hasValueColumn) {
            addImpactedResourcesHeader(rows, ['Object name', 'Current value']);
            rows.push({ 'Object name': 'Object name', 'Current value': 'Current value' });
            assessment.violationDetails.forEach((violation: any) => {
                rows.push({ 'Object name': violation.objectName || '', 'Current value': violation.value || '' });
            });
            return rows;
        }

        addImpactedResourcesHeader(rows, ['Object name']);
        rows.push({ 'Object name': 'Object name' });
        assessment.violationDetails.forEach((violation: any) => {
            rows.push({ 'Object name': violation.objectName || violation.value || '' });
        });
        return rows;
    }

    if (
        (configId === ASSESSMENT_CONFIG_IDS.LOG_DRIVE_SIZE || configId === ASSESSMENT_CONFIG_IDS.TEMPDB_DRIVE_SIZE) &&
        assessment.sizingViolations
    ) {
        const sizingRows = buildSizingViolationsDriveTable(assessment.sizingViolations, configId);
        if (sizingRows.length) return sizingRows;
    }

    if (assessment.recommendationOptions?.length) {
        rows.push({}, {});
        rows.push({
            'Instance Type': 'Recommendation Options',
            Rank: '',
            'Savings Opportunity Percentage': '',
            'Estimated Monthly Savings Value': '',
            Currency: ''
        });
        rows.push({
            'Instance Type': 'Instance Type',
            Rank: 'Rank',
            'Savings Opportunity Percentage': 'Savings Opportunity Percentage',
            'Estimated Monthly Savings Value': 'Estimated Monthly Savings Value',
            Currency: 'Currency'
        });
        assessment.recommendationOptions.forEach((option: any) => {
            rows.push({
                'Instance Type': option.instanceType || '',
                Rank: option.rank?.toString() || '',
                'Savings Opportunity Percentage':
                    option.savingsOpportunity?.savingsOpportunityPercentage?.toString() || '',
                'Estimated Monthly Savings Value':
                    option.savingsOpportunity?.estimatedMonthlySavings?.value?.toString() || '',
                Currency: option.savingsOpportunity?.estimatedMonthlySavings?.currency || ''
            });
        });
    }

    if (assessment.objectsInViolation?.length && !assessment.violationDetails?.length) {
        if (configId === 'compute-rightsizing') {
            rows.push({}, {});
            rows.push({ 'Violation Type': 'Objects in Violation' });
            rows.push({ 'Violation Type': 'Violation Type' });
            assessment.objectsInViolation.forEach(item => {
                const value =
                    typeof item === 'string' ? item : (item as any).ontapVolumeName || (item as any).objectName || '';
                rows.push({ 'Violation Type': value });
            });
        } else {
            addImpactedResourcesHeader(rows, ['Object name']);
            rows.push({ 'Object name': 'Object name' });
            assessment.objectsInViolation.forEach(item => {
                const value =
                    typeof item === 'string' ? item : (item as any).ontapVolumeName || (item as any).objectName || '';
                rows.push({ 'Object name': value });
            });
        }
    }

    return rows;
}

function buildSpecialConfigTables(assessment: FlatAssessmentItem): DetailSheetRow[] {
    const rows: DetailSheetRow[] = [];

    if (assessment.rssAdapters?.length || assessment.recommendedAdapterSettings) {
        rows.push({}, {});
        rows.push({ Setting: 'Recommended Adapter Settings', Value: '' });
        rows.push({ Setting: 'Setting', Value: 'Value' });
        const settings = assessment.recommendedAdapterSettings;
        if (settings?.recommendedRssProfile)
            rows.push({ Setting: 'RSS Profile', Value: settings.recommendedRssProfile });
        if (settings?.recommendedBaseProcessorNumber !== undefined) {
            rows.push({ Setting: 'Base Processor Number', Value: String(settings.recommendedBaseProcessorNumber) });
        }
        if (settings?.recommendedReceiveQueues) {
            rows.push({ Setting: 'Receive Queues', Value: String(settings.recommendedReceiveQueues) });
        }
        if (assessment.tcpOffloadState) rows.push({ Setting: 'TCP Offload State', Value: assessment.tcpOffloadState });

        if (assessment.rssAdapters?.length) {
            rows.push({}, {});
            rows.push({
                'Adapter Name': 'RSS Adapters',
                'RSS Enabled': '',
                'RSS Profile': '',
                'Base Processor Number': '',
                'Number of Receive Queues': ''
            });
            rows.push({
                'Adapter Name': 'Adapter Name',
                'RSS Enabled': 'RSS Enabled',
                'RSS Profile': 'RSS Profile',
                'Base Processor Number': 'Base Processor Number',
                'Number of Receive Queues': 'Number of Receive Queues'
            });
            assessment.rssAdapters.forEach(adapter => {
                rows.push({
                    'Adapter Name': adapter.adapterName || '',
                    'RSS Enabled': adapter.rssEnabled ? 'True' : 'False',
                    'RSS Profile': adapter.rssProfile || '',
                    'Base Processor Number': adapter.baseProcessorNumber?.toString() || '',
                    'Number of Receive Queues': adapter.numberOfReceiveQueues?.toString() || ''
                });
            });
        }
    }

    const cloneDetails = (assessment as any).oldCloneDetails || assessment.cloneDetails;
    if (cloneDetails?.length) {
        rows.push({}, {});
        rows.push({ 'Clone database name': 'Impacted Resources' });
        rows.push({
            'Clone database name': 'Clone database name',
            'Source database': 'Source database',
            'Source volume': 'Source volume',
            'Clone age': 'Clone age',
            'Cloned by': 'Cloned by'
        });
        cloneDetails.forEach((clone: any) => {
            let sourceDatabase = '';
            if (clone.sourceDatabaseName) {
                sourceDatabase = clone.sourceDatabaseName;
                if (clone.sourceDatabaseHostName) sourceDatabase = `${clone.sourceDatabaseHostName}/${sourceDatabase}`;
                if (clone.sourceDatabaseInstanceName && clone.sourceDatabaseInstanceName !== 'MSSQLSERVER') {
                    sourceDatabase = `${sourceDatabase} (${clone.sourceDatabaseInstanceName})`;
                }
            }
            let sourceVolumeNames = '';
            const volumeDetails = clone.clonedVolumeDetails || clone.cloneVolumeDetails;
            if (volumeDetails?.length) {
                sourceVolumeNames = Array.from(
                    new Set(volumeDetails.map((vol: any) => vol.sourceVolumeName).filter(Boolean))
                ).join(', ');
            }
            let clonedBy = clone.clonedBy || 'other';
            if (clonedBy === 'netapp_wf') clonedBy = 'NetApp Workload Factory (Sandboxes)';
            else if (clonedBy === 'other') clonedBy = 'Outside Workload Factory';
            rows.push({
                'Clone database name': clone.cloneDatabaseName || '',
                'Source database': sourceDatabase || 'n/a',
                'Source volume': sourceVolumeNames,
                'Clone age': clone.cloneAge ? `${clone.cloneAge} days` : '',
                'Cloned by': clonedBy
            });
        });
    }

    if ((assessment as any).sqlServerInstances?.length) {
        rows.push({}, {});
        rows.push({
            'SQL Server Instance': 'SQL Instances License details',
            'SQL Server State': '',
            'SQL Server Version': '',
            'SQL Server Edition': '',
            'Product Year': '',
            'SQL Server Name': ''
        });
        rows.push({
            'SQL Server Instance': 'SQL Server Instance',
            'SQL Server State': 'SQL Server State',
            'SQL Server Version': 'SQL Server Version',
            'SQL Server Edition': 'SQL Server Edition',
            'Product Year': 'Product Year',
            'SQL Server Name': 'SQL Server Name'
        });
        (assessment as any).sqlServerInstances.forEach((instance: any) => {
            rows.push({
                'SQL Server Instance': instance.sqlServerInstance || 'N/A',
                'SQL Server State': instance.sqlServerState || 'N/A',
                'SQL Server Version': instance.sqlServerVersion || 'N/A',
                'SQL Server Edition': instance.sqlServerEdition || 'N/A',
                'Product Year': instance.sqlServerProductYear?.toString() || 'N/A',
                'SQL Server Name': instance.sqlServerName || 'N/A'
            });
        });
    }

    return rows;
}

function buildDetailSheetRows(
    assessment: FlatAssessmentItem,
    configId: string,
    databaseType: string,
    isWad: boolean
): DetailSheetRow[] {
    const details: DetailSheetRow[] = [buildSummaryBlock(assessment, configId, databaseType, isWad)];
    const tableA = buildTableA(assessment.configDetails);
    if (tableA.length) details.push(...tableA);
    if (assessment.status === 'optimized' || assessment.status === 'n/a') return details;
    const specialRows = buildSpecialConfigTables(assessment);
    if (specialRows.length) {
        details.push(...specialRows);
        return details;
    }
    details.push(...buildTableB(assessment, configId, databaseType));
    return details;
}

function getCardsDataFromAssessment(data: FlatAssessmentResponse, databaseType: string) {
    if (databaseType === DBType.ORACLE) {
        return getOracleCardsData(data as any, {}).cardsData;
    }
    return formatFlatAssessments(data, {}, false, t).cardsData;
}

function buildOptimizationBreakdown(data: FlatAssessmentResponse, databaseType: string, cardsData?: any) {
    const resolvedCardsData = cardsData ?? getCardsDataFromAssessment(data, databaseType);
    if (databaseType === DBType.ORACLE) {
        return formatOracleOptimizationBreakDown(resolvedCardsData, data as any);
    }
    return formatOptimizationBreakDown(resolvedCardsData, data as any);
}

function buildWorkbookInput(data: FlatAssessmentResponse, databaseType: string): WorkbookInput {
    const assessmentsById = new Map<string, FlatAssessmentItem>();
    const displayToInternal = new Map<string, string>();
    const configurationStatus: ConfigurationStatusRow[] = [];
    const cardsData = getCardsDataFromAssessment(data, databaseType);

    data.assessments.forEach(assessment => {
        if (assessment.id && !assessmentsById.has(assessment.id)) {
            assessmentsById.set(assessment.id, assessment);
        }
    });

    const orderedIds = getOrderedAssessmentIdsByCategory(Array.from(assessmentsById.keys()), cardsData);

    orderedIds.forEach(configId => {
        const assessment = assessmentsById.get(configId);
        if (!assessment) return;
        const displayName = getConfigurationDisplayName(configId, assessment);
        displayToInternal.set(displayName, configId);
        configurationStatus.push({
            'Configuration name': displayName,
            Category: assessment.type ? assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1) : 'Unknown',
            Status: assessment.status || (assessment.errorMessage ? 'unavailable' : 'n/a'),
            Severity: assessment.severity
                ? assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)
                : 'Unknown',
            'Resource type': assessment.resourceType || 'Resource',
            'Impacted resources (X out of Y)': formatImpactedResourcesDisplay(assessment)
        });
    });

    const breakdown = buildOptimizationBreakdown(data, databaseType, cardsData);
    const criticalIssues = breakdown.total.critical;
    const warningIssues = breakdown.total.warning;
    const wellArchitectedConfigurations = breakdown.total.optimized;
    const { total } = breakdown.total;
    const totalIssues = criticalIssues + warningIssues;
    const score = total > 0 ? Math.round((wellArchitectedConfigurations / total) * 100) : 0;

    const { isDemoMode } = store.getState().auth;
    const { metadata } = data;
    const currentDate = new Date();
    const lastAnalysisDate = metadata.lastAssessmentTimestamp
        ? new Date(metadata.lastAssessmentTimestamp)
        : new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    const databaseHostName = metadata.databaseHostName || '';
    const instanceName = isDemoMode
        ? metadata.databaseInstanceName?.replace(databaseHostName, '') || ''
        : metadata.databaseInstanceName || '';

    return {
        fileName: `WorkloadfactoryDB-well-architected-report-${instanceName}.xlsx`,
        generalInfo: {
            'Host name': metadata.databaseHostName || '',
            [databaseType === DBType.ORACLE ? 'Database name' : 'Instance name']: instanceName,
            'EC2 Instance Id': metadata.ec2InstanceId || '',
            'Time stamp (export timestamp)': currentDate.toLocaleString(),
            'Last analysis': lastAnalysisDate.toLocaleString(),
            'Well-architected status': `${totalIssues} issues`,
            'Well-architected score': `${score}%`,
            'Not-Optimized configuration (Critical)': criticalIssues.toString(),
            'Not-Optimized configuration (Warning)': warningIssues.toString(),
            'Well-architected configurations': wellArchitectedConfigurations.toString(),
            Total: total.toString()
        },
        configurationStatus,
        displayToInternal,
        assessmentsById,
        orderedIds
    };
}

function getOrderedDisplayNames(workbookInput: WorkbookInput): string[] {
    const ordered: string[] = [];
    workbookInput.orderedIds.forEach(configId => {
        const assessment = workbookInput.assessmentsById.get(configId);
        if (!assessment) return;
        const displayName = getConfigurationDisplayName(configId, assessment);
        if (!ordered.includes(displayName)) ordered.push(displayName);
    });
    workbookInput.configurationStatus.forEach(row => {
        const name = row['Configuration name'];
        if (name && !ordered.includes(name)) ordered.push(name);
    });
    return ordered;
}

// ---------------------------------------------------------------------------
// Multi-table detail sheet helpers
// ---------------------------------------------------------------------------

function addComputeRightsizingToWorksheet(worksheet: ExcelJS.Worksheet, data: DetailSheetRow[]): void {
    const recommendationOptionsStart = data.findIndex(row => row?.['Instance Type'] === 'Recommendation Options');
    const objectsInViolationStart = data.findIndex(row => row?.['Violation Type'] === 'Objects in Violation');

    if (data[0]) {
        createBaseConfigTable(worksheet, [data[0]], DETAIL_SHEET_SUMMARY_ROW);
    }

    let nextRow = DETAIL_SHEET_FIRST_TABLE_ROW;

    if (recommendationOptionsStart >= 0) {
        nextRow = createStyledTable(
            worksheet,
            {
                title: 'Recommendation Options',
                columnHeaders: [
                    'Instance Type',
                    'Rank',
                    'Savings Opportunity Percentage',
                    'Estimated Monthly Savings Value',
                    'Currency'
                ],
                columnSpan: 5,
                dataFilter: row =>
                    Boolean(
                        row &&
                            Object.keys(row).length > 0 &&
                            row['Instance Type'] &&
                            row['Instance Type'] !== 'Recommendation Options' &&
                            row['Instance Type'] !== 'Instance Type'
                    ),
                dataExtractor: row => [
                    row['Instance Type'],
                    row.Rank || '',
                    row['Savings Opportunity Percentage'] || '',
                    row['Estimated Monthly Savings Value'] || '',
                    row.Currency || ''
                ]
            },
            data.slice(recommendationOptionsStart),
            nextRow
        );
    }

    if (objectsInViolationStart >= 0) {
        nextRow += DETAIL_SHEET_TABLE_GAP_ROWS;
        createStyledTable(
            worksheet,
            {
                title: 'Objects in Violation',
                columnHeaders: ['Violation Type'],
                columnSpan: 1,
                dataFilter: row =>
                    Boolean(
                        row &&
                            Object.keys(row).length > 0 &&
                            row['Violation Type'] &&
                            row['Violation Type'] !== 'Objects in Violation' &&
                            row['Violation Type'] !== 'Violation Type'
                    ),
                dataExtractor: row => [row['Violation Type']]
            },
            data.slice(objectsInViolationStart),
            nextRow
        );
    }
}

function addRSSConfigToWorksheet(worksheet: ExcelJS.Worksheet, data: DetailSheetRow[]): void {
    const recommendedSettingsIndex = data.findIndex(row => row?.Setting === 'Setting' && row.Value === 'Value');
    const rssAdaptersIndex = data.findIndex(
        row => row?.['Adapter Name'] === 'Adapter Name' && row['RSS Enabled'] === 'RSS Enabled'
    );

    if (data[0]) {
        createBaseConfigTable(worksheet, [data[0]], DETAIL_SHEET_SUMMARY_ROW);
    }

    let nextRow = DETAIL_SHEET_FIRST_TABLE_ROW;
    if (recommendedSettingsIndex >= 0) {
        nextRow = createStyledTable(
            worksheet,
            {
                title: 'Recommended Adapter Settings',
                columnHeaders: ['Setting', 'Value'],
                columnSpan: 2,
                dataFilter: row =>
                    Boolean(row && Object.keys(row).length > 0 && row.Setting && row.Setting !== 'Setting'),
                dataExtractor: row => [row.Setting, row.Value || '']
            },
            data.slice(recommendedSettingsIndex + 1),
            nextRow
        );
    }
    if (rssAdaptersIndex >= 0) {
        nextRow += DETAIL_SHEET_TABLE_GAP_ROWS;
        createStyledTable(
            worksheet,
            {
                title: 'RSS Adapters',
                columnHeaders: [
                    'Adapter Name',
                    'RSS Enabled',
                    'RSS Profile',
                    'Base Processor Number',
                    'Number of Receive Queues'
                ],
                columnSpan: 5,
                dataFilter: row =>
                    Boolean(
                        row &&
                            Object.keys(row).length > 0 &&
                            row['Adapter Name'] &&
                            row['Adapter Name'] !== 'Adapter Name'
                    ),
                dataExtractor: row => [
                    row['Adapter Name'],
                    row['RSS Enabled'] || '',
                    row['RSS Profile'] || '',
                    row['Base Processor Number'] || '',
                    row['Number of Receive Queues'] || ''
                ]
            },
            data.slice(rssAdaptersIndex + 1),
            nextRow
        );
    }
}

function addCloneManagementToWorksheet(worksheet: ExcelJS.Worksheet, data: DetailSheetRow[]): void {
    const impactedResourcesStart = data.findIndex(row => row?.['Clone database name'] === 'Impacted Resources');

    if (data[0]) {
        createBaseConfigTable(worksheet, [data[0]], DETAIL_SHEET_SUMMARY_ROW);
    }

    if (impactedResourcesStart >= 0) {
        createStyledTable(
            worksheet,
            {
                title: 'Impacted Resources',
                columnHeaders: ['Clone database name', 'Source database', 'Source volume', 'Clone age', 'Cloned by'],
                columnSpan: 5,
                dataFilter: row =>
                    Boolean(
                        row &&
                            Object.keys(row).length > 0 &&
                            row['Clone database name'] &&
                            row['Clone database name'] !== 'Clone database name'
                    ),
                dataExtractor: row => [
                    row['Clone database name'],
                    row['Source database'] || '',
                    row['Source volume'] || '',
                    row['Clone age'] || '',
                    row['Cloned by'] || ''
                ]
            },
            data.slice(impactedResourcesStart + 1),
            DETAIL_SHEET_FIRST_TABLE_ROW
        );
    }
}

function addSqlLicenseToWorksheet(worksheet: ExcelJS.Worksheet, data: DetailSheetRow[]): void {
    const licenseTableStart = data.findIndex(row => row?.['SQL Server Instance'] === 'SQL Instances License details');

    if (data[0]) {
        createBaseConfigTable(worksheet, [data[0]], DETAIL_SHEET_SUMMARY_ROW);
    }

    if (licenseTableStart >= 0) {
        createStyledTable(
            worksheet,
            {
                title: 'SQL Instances License details',
                columnHeaders: [
                    'SQL Server Instance',
                    'SQL Server State',
                    'SQL Server Version',
                    'SQL Server Edition',
                    'Product Year',
                    'SQL Server Name'
                ],
                columnSpan: 6,
                dataFilter: row =>
                    Boolean(
                        row &&
                            Object.keys(row).length > 0 &&
                            row['SQL Server Instance'] &&
                            row['SQL Server Instance'] !== 'SQL Server Instance' &&
                            row['SQL Server Instance'] !== 'SQL Instances License details'
                    ),
                dataExtractor: row => [
                    row['SQL Server Instance'],
                    row['SQL Server State'] || '',
                    row['SQL Server Version'] || '',
                    row['SQL Server Edition'] || '',
                    row['Product Year'] || '',
                    row['SQL Server Name'] || ''
                ]
            },
            data.slice(licenseTableStart + 1),
            DETAIL_SHEET_FIRST_TABLE_ROW
        );
    }
}

function addMultiTableDataToWorksheet(worksheet: ExcelJS.Worksheet, data: DetailSheetRow[], configId: string): void {
    if (configId === 'compute-rightsizing') addComputeRightsizingToWorksheet(worksheet, data);
    else if (configId === 'rss-config') addRSSConfigToWorksheet(worksheet, data);
    else if (configId === 'clone-management') addCloneManagementToWorksheet(worksheet, data);
    else if (configId === 'sql-license') addSqlLicenseToWorksheet(worksheet, data);
    else addSectionedDetailSheetToWorksheet(worksheet, data);
}

// ---------------------------------------------------------------------------
// Workbook generation
// ---------------------------------------------------------------------------

async function generateProperXlsxWorkbook(
    data: FlatAssessmentResponse,
    databaseType: string,
    isWad: boolean
): Promise<{ fileName: string; arrayBuffer: ArrayBuffer }> {
    const workbookInput = buildWorkbookInput(data, databaseType);
    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set<string>(['general information', 'configuration status']);
    const displayNameToSheetName = new Map<string, string>();

    const getSheetName = (displayName: string): string => {
        if (!displayNameToSheetName.has(displayName)) {
            displayNameToSheetName.set(displayName, uniqueWorksheetName(displayName, usedSheetNames));
        }
        return displayNameToSheetName.get(displayName)!;
    };

    const generalInfoSheet = workbook.addWorksheet('General Information');
    addDataToWorksheet(generalInfoSheet, [workbookInput.generalInfo]);
    autoFitColumns(generalInfoSheet, [workbookInput.generalInfo]);
    const generalInfoColumns = Object.keys(workbookInput.generalInfo).length;
    styleTableBorders(generalInfoSheet, 1, 2, 1, generalInfoColumns);
    styleDataRows(generalInfoSheet, 2, 2, 1, generalInfoColumns);
    addHeaderStyling(generalInfoSheet, [workbookInput.generalInfo]);

    const configStatusSheet = workbook.addWorksheet('Configuration Status');
    if (workbookInput.configurationStatus.length > 0) {
        addDataToWorksheet(configStatusSheet, workbookInput.configurationStatus as unknown as Record<string, string>[]);
        autoFitColumns(configStatusSheet, workbookInput.configurationStatus as unknown as Record<string, string>[]);
        addAutoFilter(configStatusSheet, workbookInput.configurationStatus as unknown as Record<string, string>[]);
        const configStatusColumns = Object.keys(workbookInput.configurationStatus[0]).length;
        const configStatusEndRow = workbookInput.configurationStatus.length + 1;
        styleTableBorders(configStatusSheet, 1, configStatusEndRow, 1, configStatusColumns);
        styleDataRows(configStatusSheet, 2, configStatusEndRow, 1, configStatusColumns);
        addHeaderStyling(configStatusSheet, workbookInput.configurationStatus as unknown as Record<string, string>[]);

        workbookInput.configurationStatus.forEach((config, index) => {
            const configName = config['Configuration name'];
            if (!configName) return;
            const sheetName = getSheetName(configName);
            const cell = configStatusSheet.getCell(index + 2, 1);
            cell.value = {
                text: configName,
                hyperlink: `#'${sheetName}'!A1`,
                tooltip: `Go to ${configName} details`
            };
            cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        });
    }

    getOrderedDisplayNames(workbookInput).forEach(displayName => {
        const configId = workbookInput.displayToInternal.get(displayName);
        if (!configId) return;
        const assessment = workbookInput.assessmentsById.get(configId);
        if (!assessment) return;
        const configDetails = buildDetailSheetRows(assessment, configId, databaseType, isWad);
        if (!configDetails.length) return;

        const configSheet = workbook.addWorksheet(getSheetName(displayName));
        addConfigurationStatusHyperlink(configSheet);
        if (usesMultiTableLayout(configId, assessment)) {
            addMultiTableDataToWorksheet(configSheet, configDetails, configId);
        } else {
            addSectionedDetailSheetToWorksheet(configSheet, configDetails);
        }
        autoFitColumns(configSheet, configDetails);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
    return { fileName: workbookInput.fileName, arrayBuffer };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function generateReport(jsonString: string, databaseType: string, isWad = false): Promise<void> {
    try {
        let jsonData: unknown;
        try {
            jsonData = JSON.parse(jsonString);
        } catch {
            throw new Error('Malformed input data: Invalid JSON format.');
        }

        const flatData = validateFlatAssessmentResponse(jsonData);
        const resolvedIsWad = isWad || flatData.metadata?.isWad || false;
        const { fileName, arrayBuffer } = await generateProperXlsxWorkbook(flatData, databaseType, resolvedIsWad);

        if (!arrayBuffer) throw new Error('Failed to generate XLSX buffer');

        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating well-architected Excel report:', error);
        throw error;
    }
}

export default generateReport;
