import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BlockDeviceSpaceManagementFixModal } from '@wad/fix-modals/lun/block-device-space-management/BlockDeviceSpaceManagementFixModal';
import { lunFixModalProps } from '@test/helpers/testUtils';

describe('BlockDeviceSpaceManagementFixModal', () => {
    it('calls fix with all resource ids when continue is clicked', () => {
        const props = lunFixModalProps();
        render(<BlockDeviceSpaceManagementFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-block-device-space-management-fix-continue-btn'));

        expect(props.fix).toHaveBeenCalledWith(['lun-1'], {});
    });

    it('closes when fix dependencies are missing', () => {
        const props = lunFixModalProps({ fix: undefined, resources: undefined });
        render(<BlockDeviceSpaceManagementFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-block-device-space-management-fix-continue-btn'));

        expect(props.close).toHaveBeenCalledOnce();
    });
});
