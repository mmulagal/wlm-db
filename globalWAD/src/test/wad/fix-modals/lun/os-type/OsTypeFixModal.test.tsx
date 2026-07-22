import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { OsTypeFixModal } from '@wad/fix-modals/lun/os-type/OsTypeFixModal';
import { lunFixModalProps } from '@test/helpers/testUtils';

describe('OsTypeFixModal', () => {
    it('closes when close is clicked', () => {
        const props = lunFixModalProps();
        render(<OsTypeFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-os-type-fix-close-btn'));

        expect(props.close).toHaveBeenCalledOnce();
    });
});
