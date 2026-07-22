import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components';

import { FileSystemResourcesTable } from '@wad/tables/filesystem/FileSystemResourcesTable';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('FileSystemResourcesTable', () => {
    it('renders the resources table for a file system configuration', () => {
        render(
            <FileSystemResourcesTable
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-headroom' } })}
                tableScope={TableScope.GLOBAL_WAD}
            />
        );

        expect(screen.getByTestId('file-system-resources-table-wlmdb-headroom')).toBeInTheDocument();
    });
});
