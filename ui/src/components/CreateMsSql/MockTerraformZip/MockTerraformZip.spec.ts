import { describe, it, expect, vi } from 'vitest';

import { downloadTerraformZip } from './MockTerraformZip';

// Mock JSZip and DOM elements
vi.mock('jszip', () => ({
    default: class JSZip {
        file = vi.fn();

        folder = vi.fn();

        generateAsync = vi.fn(() => Promise.resolve(new Blob()));
    }
}));

global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();
document.createElement = vi.fn((tag: string) => {
    const elem: any = {
        tagName: tag,
        click: vi.fn(),
        href: '',
        download: ''
    };
    return elem;
});
document.body.appendChild = vi.fn();
document.body.removeChild = vi.fn();

describe('MockTerraformZip', () => {
    describe('downloadTerraformZip', () => {
        it('creates zip with standalone deployment for mssql', () => {
            expect(() => downloadTerraformZip('standalone', 'mssql')).not.toThrow();
        });

        it('creates zip with fci deployment for mssql', () => {
            expect(() => downloadTerraformZip('fci', 'mssql')).not.toThrow();
        });

        it('creates zip with default parameters', () => {
            expect(() => downloadTerraformZip()).not.toThrow();
        });

        it('creates zip for postgresql standalone', () => {
            expect(() => downloadTerraformZip('standalone', 'pgsql')).not.toThrow();
        });

        it('creates zip for postgresql fci', () => {
            expect(() => downloadTerraformZip('fci', 'pgsql')).not.toThrow();
        });
    });
});
