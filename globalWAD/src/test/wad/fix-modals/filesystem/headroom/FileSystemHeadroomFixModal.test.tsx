import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FileSystemHeadroomFixModal } from '@wad/fix-modals/filesystem/headroom/FileSystemHeadroomFixModal';
import { fileSystemFixModalProps } from '@test/helpers/testUtils';

describe('FileSystemHeadroomFixModal', () => {
    it('calls fix with all resource ids when continue is clicked', () => {
        const props = fileSystemFixModalProps();
        render(<FileSystemHeadroomFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-headroom-fix-continue-btn'));

        expect(props.fix).toHaveBeenCalledWith(['fs-1'], {});
    });
});
