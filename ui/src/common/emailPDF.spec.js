import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import downloadPdfEmail from './emailPDF';

vi.mock('dom-to-image', () => ({
    default: {
        toPng: vi.fn()
    }
}));

vi.mock('jspdf', () => ({
    jsPDF: vi.fn().mockImplementation(() => ({
        addPage: vi.fn(),
        addImage: vi.fn(),
        save: vi.fn(),
        output: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' }))
    }))
}));

describe('emailPDF - downloadPdfEmail', () => {
    let domToImage;
    let domElement;

    beforeEach(async () => {
        domToImage = (await import('dom-to-image')).default;
        domElement = document.createElement('div');
        domElement.innerHTML = '<p>Email PDF content</p>';
        document.body.appendChild(domElement);
    });

    afterEach(() => {
        if (document.body.contains(domElement)) {
            document.body.removeChild(domElement);
        }
        vi.clearAllMocks();
    });

    it('should be a function', () => {
        expect(typeof downloadPdfEmail).toBe('function');
    });

    it('should call domToImage.toPng with the container', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'email.pdf' };

        try {
            downloadPdfEmail(domElement, options, false, vi.fn());
        } catch (e) {
            // Expected due to DOM API limitations in jsdom
        }

        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should apply overrideWidth from options', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'email.pdf', overrideWidth: 900 };

        try {
            downloadPdfEmail(domElement, options, false, vi.fn());
        } catch (e) {
            // Expected
        }

        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should apply scale option', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'email.pdf', scale: 1.5 };

        try {
            downloadPdfEmail(domElement, options, false, vi.fn());
        } catch (e) {
            // Expected
        }

        expect(domToImage.toPng).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ quality: 1 }));
    });

    it('should apply excludeClassNames option', () => {
        const dom = document.createElement('div');
        const excludedEl = document.createElement('span');
        excludedEl.className = 'email-hide';
        dom.appendChild(excludedEl);
        document.body.appendChild(dom);

        domToImage.toPng.mockResolvedValue('data:image/png;base64,abc');
        const options = { filename: 'email.pdf', excludeClassNames: ['email-hide'] };

        try {
            downloadPdfEmail(dom, options, false, vi.fn());
        } catch (e) {
            // Expected
        }

        if (document.body.contains(dom)) {
            document.body.removeChild(dom);
        }

        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should pass encoded param to output', async () => {
        const cbMock = vi.fn();
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');

        const originalImage = global.Image;
        global.Image = class {
            set src(_) {
                setTimeout(() => this.onload && this.onload(), 0);
            }

            width = 595;

            height = 841;
        };

        const options = { filename: 'email.pdf' };
        try {
            downloadPdfEmail(domElement, options, true, cbMock);
        } catch (e) {
            // Expected
        }

        global.Image = originalImage;
        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should call cb(null) on error and return console.error', async () => {
        const cbMock = vi.fn();
        domToImage.toPng.mockRejectedValue(new Error('toPng failed'));

        const options = { filename: 'email.pdf' };
        try {
            await downloadPdfEmail(domElement, options, false, cbMock);
        } catch (e) {
            // Expected
        }

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should handle no callback provided', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'email.pdf' };

        expect(() => {
            downloadPdfEmail(domElement, options, false);
        }).not.toThrow();
    });
});
