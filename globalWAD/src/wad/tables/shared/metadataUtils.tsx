import { memo } from 'react';
import {
    ResourceTextCellRenderer,
    type ResourceScanRecord,
    type TableColumn
} from '@tlveng/workload-factory-components';

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
    if (value == null || value === '') return undefined;
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
            if (!parameter || value === undefined) return undefined;
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
    if (!metadata) return undefined;

    const directValue = toDisplayValue(metadata[field]);
    if (directValue !== undefined) return directValue;

    const components = metadata.components;
    if (!Array.isArray(components) || components.length === 0 || field === 'workload') return undefined;

    const typedComponents = components.filter(
        (component): component is MetadataComponent => !!component && typeof component === 'object'
    );
    if (typedComponents.length === 0) return undefined;

    if (typedComponents.length === 1) {
        return toDisplayValue(typedComponents[0][field]);
    }

    return formatComponentEntries(typedComponents, field);
};

const getMetadataFieldDisplayValue = (row: ResourceScanRecord, field: MetadataField): string | undefined => {
    const fromMetadata = getComponentMetadataValue(row.metadata as Record<string, unknown> | undefined, field);
    if (fromMetadata !== undefined) return fromMetadata;
    const rowKey = ROW_FIELD_FALLBACK[field];
    if (rowKey) return toDisplayValue(row[rowKey]);
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

const MetadataFieldCellRenderer = memo(
    ({ field, row }: { field: MetadataField; row: ResourceScanRecord }) => (
        <ResourceTextCellRenderer
            value={getMetadataFieldDisplayValue(row, field) ?? ''}
            row={row}
        />
    )
);
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
