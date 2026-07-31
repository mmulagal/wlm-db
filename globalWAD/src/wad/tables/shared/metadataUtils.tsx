import { memo, useState, type MouseEvent } from 'react';
import { Text } from '@netapp/bxp-design-system-react';
import { type ResourceScanRecord, type TableColumn } from '@tlveng/workload-factory-components/wad';

type MetadataField = 'current' | 'recommended' | 'workload';

/** Row keys used as accessor and display fallback when metadata has no value. */
const ROW_FIELD_FALLBACK: Partial<Record<MetadataField, keyof ResourceScanRecord>> = {
    workload: 'workload'
};

const getFieldAccessor = (field: MetadataField): TableColumn<ResourceScanRecord>['accessor'] =>
    ROW_FIELD_FALLBACK[field] ?? `metadata.${field}`;

interface MetadataComponent {
    parameter?: string;
    current?: string;
    recommended?: string;
    status?: string;
}

const toDisplayValue = (value: unknown): string | undefined => {
    if (value == null || value === '') {
        return undefined;
    }
    return String(value);
};

const formatComponentEntries = (
    components: MetadataComponent[],
    field: 'current' | 'recommended'
): string | undefined => {
    const entries = components
        .map(component => {
            const parameter = toDisplayValue(component.parameter);
            const value = toDisplayValue(component[field]);
            if (!parameter || value === undefined) {
                return undefined;
            }
            return `${parameter}=${value}`;
        })
        .filter((entry): entry is string => entry !== undefined);

    return entries.length > 0 ? entries.join(', ') : undefined;
};

/**
 * Reads a metadata display field from either the flat shape
 * (`metadata.current` / `metadata.recommended`), a single component,
 * or multiple components formatted as `parameter=value` pairs.
 */
export const getComponentMetadataValue = (
    metadata: Record<string, unknown> | undefined,
    field: MetadataField
): string | undefined => {
    if (!metadata) {
        return undefined;
    }

    const directValue = toDisplayValue(metadata[field]);
    if (directValue !== undefined) {
        return directValue;
    }

    const { components } = metadata;
    if (!Array.isArray(components) || components.length === 0 || field === 'workload') {
        return undefined;
    }

    const typedComponents = components.filter(
        (component): component is MetadataComponent => !!component && typeof component === 'object'
    );
    if (typedComponents.length === 0) {
        return undefined;
    }

    if (typedComponents.length === 1) {
        return toDisplayValue(typedComponents[0][field]);
    }

    return formatComponentEntries(typedComponents, field);
};

const getMetadataFieldDisplayValue = (row: ResourceScanRecord, field: MetadataField): string | undefined => {
    const fromMetadata = getComponentMetadataValue(row.metadata as Record<string, unknown> | undefined, field);
    if (fromMetadata !== undefined) {
        return fromMetadata;
    }
    const rowKey = ROW_FIELD_FALLBACK[field];
    if (rowKey) {
        return toDisplayValue(row[rowKey]);
    }
    return undefined;
};

interface CreateMetadataFieldColumnOptions {
    id: string;
    header: string;
    field: MetadataField;
    width: number;
    sort: { enabled: boolean };
    filter: { enabled: boolean };
}

const truncatedCellStyle = {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    width: '100%'
} as const;

const metadataTooltipStyle = {
    position: 'fixed',
    zIndex: 10000,
    padding: '8px 16px',
    maxWidth: 480,
    fontSize: 12,
    lineHeight: 1.67,
    color: 'var(--text-primary)',
    borderRadius: 2,
    boxShadow: '2px 2px 6px 0 var(--border-drop-shadow)',
    backgroundColor: 'var(--tooltip-info-bg)',
    pointerEvents: 'none'
} as const;

const MetadataFieldCellRenderer = memo(({ field, row }: { field: MetadataField; row: ResourceScanRecord }) => {
    const value = getMetadataFieldDisplayValue(row, field) ?? '';
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

    if (!value) {
        return null;
    }

    return (
        <>
            <Text
                style={{
                    ...truncatedCellStyle,
                    ...(row.isDismissed ? { color: 'var(--text-disabled)' } : {})
                }}
                onMouseMove={(event: MouseEvent<HTMLParagraphElement>) =>
                    setTooltipPosition({ x: event.clientX, y: event.clientY })
                }
                onMouseLeave={() => setTooltipPosition(null)}
            >
                {value}
            </Text>
            {tooltipPosition && (
                <div
                    style={{
                        ...metadataTooltipStyle,
                        left: tooltipPosition.x + 12,
                        top: tooltipPosition.y + 12
                    }}
                >
                    {value}
                </div>
            )}
        </>
    );
});
MetadataFieldCellRenderer.displayName = 'MetadataFieldCellRenderer';

export const createMetadataFieldColumn = ({
    id,
    header,
    field,
    width,
    sort,
    filter
}: CreateMetadataFieldColumnOptions): TableColumn<ResourceScanRecord> => ({
    header,
    accessor: getFieldAccessor(field),
    id,
    width,
    sort,
    filter,
    Renderer: ({ row }) => <MetadataFieldCellRenderer field={field} row={row} />
});

export const WorkloadType = {
    MSSQL: 'mssql',
    ORACLE: 'oracle'
} as const;

export type WorkloadTypeValue = (typeof WorkloadType)[keyof typeof WorkloadType];

export const MIXED_WORKLOAD_ROW_TOOLTIP = 'Select resources with the same workload type to fix them together.';

export const MIXED_WORKLOAD_BULK_FIX_ERROR =
    'Bulk fix is unavailable when selected resources have different workload types.';

export const readResourceWorkload = (resource: ResourceScanRecord): string | undefined =>
    getMetadataFieldDisplayValue(resource, 'workload');

export const normalizeWorkloadType = (workload: string | undefined): WorkloadTypeValue | undefined => {
    const normalized = workload?.trim().toLowerCase();
    if (normalized === WorkloadType.MSSQL) {
        return WorkloadType.MSSQL;
    }
    if (normalized === WorkloadType.ORACLE) {
        return WorkloadType.ORACLE;
    }
    return undefined;
};

export const readResourceWorkloadType = (resource: ResourceScanRecord): WorkloadTypeValue | undefined =>
    normalizeWorkloadType(readResourceWorkload(resource));

export const hasMixedWorkloads = (resources: ResourceScanRecord[]): boolean => {
    const workloadTypes = new Set(
        resources
            .map(readResourceWorkloadType)
            .filter((workloadType): workloadType is WorkloadTypeValue => workloadType !== undefined)
    );
    return workloadTypes.size > 1;
};
