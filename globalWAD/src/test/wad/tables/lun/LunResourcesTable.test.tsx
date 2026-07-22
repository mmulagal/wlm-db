import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components';

import { LunResourcesTable } from '@wad/tables/lun/LunResourcesTable';
import { createMockWadApi } from '@test/helpers/testUtils';

describe('LunResourcesTable', () => {
    it('renders the resources table for a lun configuration', () => {
        render(
            <LunResourcesTable
                wadApi={createMockWadApi({ context: { configurationId: 'wlmdb-os-type' } })}
                tableScope={TableScope.GLOBAL_WAD}
            />
        );

        expect(screen.getByTestId('lun-resources-table-wlmdb-os-type')).toBeInTheDocument();
    });
});
