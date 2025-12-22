import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileUpload from '../FileUpload';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

// Mock the Upload SVG
vi.mock('../../../assets/ic_upload.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="upload-icon" {...props} />
}));

describe('FileUpload', () => {
    const mockHandleFileChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Component Rendering', () => {
        it('should render without crashing', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            expect(container.firstChild).toBeTruthy();
        });

        it('should render upload text', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            expect(container.textContent).toContain('Upload script results');
        });

        it('should have file input with correct attributes', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) {
                expect(fileInput.style.display).toBe('none');
                expect(fileInput.accept).toBe('.json');
                expect(fileInput.id).toBe('file-input');
            } else {
                // Component renders but may not have standard input element
                expect(container.querySelector('input')).toBeTruthy();
            }
        });
    });

    describe('File Input Attributes', () => {
        it('should have accept attribute for json files', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
            expect(fileInput.accept).toBe('.json');
        });

        it('should have type file', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('input[type="file"]');
            expect(fileInput?.getAttribute('type')).toBe('file');
        });
    });

    describe('File Selection', () => {
        it('should call handleFileChange when file is selected', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['test content'], 'test.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(mockHandleFileChange).toHaveBeenCalled();
            expect(mockHandleFileChange).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple file selection attempts', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file1 = new File(['content 1'], 'test1.json', { type: 'application/json' });
            const file2 = new File(['content 2'], 'test2.json', { type: 'application/json' });

            fireEvent.change(fileInput, { target: { files: [file1] } });
            fireEvent.change(fileInput, { target: { files: [file2] } });

            expect(mockHandleFileChange).toHaveBeenCalledTimes(2);
        });

        it('should pass event object to handleFileChange', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['test'], 'test.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(mockHandleFileChange).toHaveBeenCalledWith(expect.any(Object));
        });

        it('should handle empty file selection', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            fireEvent.change(fileInput, { target: { files: [] } });

            expect(mockHandleFileChange).toHaveBeenCalled();
        });
    });

    describe('Component Structure', () => {
        it('should render label element', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const label = container.querySelector('label');
            expect(label).toBeTruthy();
            expect(label?.getAttribute('for')).toBe('file-input');
        });

        it('should render input element', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const input = container.querySelector('input');
            expect(input).toBeTruthy();
            expect(input?.getAttribute('type')).toBe('file');
        });

        it('should have correct file input id', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input');
            expect(fileInput?.getAttribute('id')).toBe('file-input');
        });

        it('should have label pointing to correct input', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const label = container.querySelector('label');
            expect(label?.getAttribute('for')).toBe('file-input');
        });
    });

    describe('Icon Rendering', () => {
        it('should render icon with margin', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const iconContainer = container.querySelector('div[style*="margin-right"]') as HTMLDivElement;
            expect(iconContainer).toBeTruthy();
            expect(iconContainer?.style.marginRight).toBe('8px');
        });

        it('should render upload icon', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const svg = container.querySelector('svg');
            expect(svg).toBeTruthy();
        });
    });

    describe('Edge Cases', () => {
        it('should work with different file types despite accept attribute', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(mockHandleFileChange).toHaveBeenCalled();
        });

        it('should handle large file selection', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const largeContent = 'x'.repeat(1000000);
            const file = new File([largeContent], 'large.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(mockHandleFileChange).toHaveBeenCalled();
        });
    });

    describe('Label Functionality', () => {
        it('should have clickable label', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const label = container.querySelector('label[for="file-input"]') as HTMLLabelElement;

            expect(label).toBeTruthy();
            fireEvent.click(label);
            // Label click should trigger file input (browser behavior, can't easily test)
        });
    });

    describe('Text Content', () => {
        it('should display correct upload text', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            expect(container.textContent).toContain('Upload script results');
        });

        it('should not display any error messages initially', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            expect(container.textContent).not.toContain('error');
            expect(container.textContent).not.toContain('Error');
        });
    });

    describe('Props Handling', () => {
        it('should accept handleFileChange prop', () => {
            const customHandler = vi.fn();
            const { container } = render(<FileUpload handleFileChange={customHandler} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['test'], 'test.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(customHandler).toHaveBeenCalled();
        });

        it('should call the exact handler passed as prop', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const { rerender, container } = render(<FileUpload handleFileChange={handler1} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['test'], 'test.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(handler1).toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();

            // Rerender with different handler
            rerender(<FileUpload handleFileChange={handler2} />);
            const fileInput2 = container.querySelector('#file-input') as HTMLInputElement;
            fireEvent.change(fileInput2, { target: { files: [file] } });

            expect(handler2).toHaveBeenCalled();
            expect(handler1).toHaveBeenCalledTimes(1); // Should still be 1
        });
    });

    describe('File Type Validation', () => {
        it('should accept json files', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            const file = new File(['{}'], 'data.json', { type: 'application/json' });
            fireEvent.change(fileInput, { target: { files: [file] } });

            expect(mockHandleFileChange).toHaveBeenCalled();
        });

        it('should have accept attribute limiting to json', () => {
            const { container } = render(<FileUpload handleFileChange={mockHandleFileChange} />);
            const fileInput = container.querySelector('#file-input') as HTMLInputElement;

            expect(fileInput.accept).toBe('.json');
        });
    });
});
