import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components';

import { VolumeResourcesTable } from '@wad/tables/volume/VolumeResourcesTable';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('VolumeResourcesTable', () => {
    it('renders the resources table for a volume configuration', () => {
        render(
            <VolumeResourcesTable
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-thin-provision' } })}
                tableScope={TableScope.GLOBAL_WAD}
            />
        );

        expect(screen.getByTestId('volume-resources-table-wlmdb-thin-provision')).toBeInTheDocument();
    });
});
