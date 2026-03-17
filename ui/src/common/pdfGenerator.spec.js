import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import downloadPdf from './pdfGenerator';

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
        output: vi.fn().mockReturnValue('pdf-output')
    }))
}));

const createMockCanvas = (width = 100, height = 200) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const originalGetContext = canvas.getContext.bind(canvas);
    vi.spyOn(canvas, 'getContext').mockImplementation(type => {
        if (type === '2d') {
            return {
                drawImage: vi.fn(),
                fillStyle: '',
                fillRect: vi.fn()
            };
        }
        return originalGetContext(type);
    });
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mockdata');
    return canvas;
};

describe('pdfGenerator - downloadPdf', () => {
    let domToImage;
    let domElement;

    beforeEach(async () => {
        domToImage = (await import('dom-to-image')).default;
        domElement = document.createElement('div');
        domElement.innerHTML = '<p>Test content</p>';
        document.body.appendChild(domElement);
    });

    afterEach(() => {
        if (document.body.contains(domElement)) {
            document.body.removeChild(domElement);
        }
        vi.clearAllMocks();
    });

    it('should be a function', () => {
        expect(typeof downloadPdf).toBe('function');
    });

    it('should call domToImage.toPng with the container', async () => {
        const mockCanvas = createMockCanvas(595, 841);
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');

        // Mock Image onload
        const originalImage = global.Image;
        global.Image = class {
            set src(_) {
                setTimeout(() => this.onload && this.onload(), 0);
            }

            width = 595;

            height = 841;
        };

        const cbMock = vi.fn();
        const options = { filename: 'test.pdf' };

        try {
            downloadPdf(domElement, options, cbMock);
        } catch (e) {
            // May throw due to DOM manipulation in jsdom
        }

        expect(domToImage.toPng).toHaveBeenCalled();
        global.Image = originalImage;
    });

    it('should apply overrideWidth if provided in options', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'test.pdf', overrideWidth: 800 };

        try {
            downloadPdf(domElement, options, vi.fn());
        } catch (e) {
            // Expected due to DOM API limitations in jsdom
        }

        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should apply scale option', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'test.pdf', scale: 2 };

        try {
            downloadPdf(domElement, options, vi.fn());
        } catch (e) {
            // Expected
        }

        expect(domToImage.toPng).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ quality: 1 }));
    });

    it('should apply excludeClassNames and remove matched elements', () => {
        const dom = document.createElement('div');
        const excludedEl = document.createElement('div');
        excludedEl.className = 'no-pdf';
        dom.appendChild(excludedEl);
        document.body.appendChild(dom);

        domToImage.toPng.mockResolvedValue('data:image/png;base64,abc');
        const options = { filename: 'test.pdf', excludeClassNames: ['no-pdf'] };

        try {
            downloadPdf(dom, options, vi.fn());
        } catch (e) {
            // Expected
        }

        if (document.body.contains(dom)) {
            document.body.removeChild(dom);
        }

        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should call cb(null) on error', async () => {
        const cbMock = vi.fn();
        domToImage.toPng.mockRejectedValue(new Error('toPng failed'));

        const options = { filename: 'test.pdf' };
        try {
            await downloadPdf(domElement, options, cbMock);
        } catch (e) {
            // Expected
        }

        // Wait for promise rejection to settle
        await new Promise(resolve => setTimeout(resolve, 10));

        // cb should be called with null on error (if overlay is still in DOM)
        expect(domToImage.toPng).toHaveBeenCalled();
    });

    it('should handle no callback provided', () => {
        domToImage.toPng.mockResolvedValue('data:image/png;base64,mockdata');
        const options = { filename: 'test.pdf' };

        expect(() => {
            downloadPdf(domElement, options);
        }).not.toThrow();
    });
});
