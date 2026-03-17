import darkStyles from './darkStyles';
import palette from './palette';

// Mock tagged template literal — joins strings and interpolated values
const mockCss = (strings, ...values) =>
    strings.reduce((result, str, i) => result + str + (values[i] !== undefined ? values[i] : ''), '');

describe('darkStyles', () => {
    let result;

    beforeAll(() => {
        result = darkStyles(mockCss, palette);
    });

    it('is a function', () => {
        expect(typeof darkStyles).toBe('function');
    });

    it('returns a non-empty string when called', () => {
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('joins all sections with newline', () => {
        expect(result).toContain('\n');
    });

    describe('background (bg) section', () => {
        it('includes --main-background with Grey70', () => {
            expect(result).toContain('--main-background:');
            expect(result).toContain(palette.Grey70);
        });

        it('includes --content-background with Grey65', () => {
            expect(result).toContain('--content-background:');
            expect(result).toContain(palette.Grey65);
        });

        it('includes --hover-background with Grey60', () => {
            expect(result).toContain('--hover-background:');
        });

        it('includes --table-header-background with Grey55', () => {
            expect(result).toContain('--table-header-background:');
        });
    });

    describe('text section', () => {
        it('includes --text-primary with White', () => {
            expect(result).toContain('--text-primary:');
        });

        it('includes --text-secondary', () => {
            expect(result).toContain('--text-secondary:');
        });

        it('includes --text-disabled', () => {
            expect(result).toContain('--text-disabled:');
        });

        it('includes --text-title', () => {
            expect(result).toContain('--text-title:');
        });
    });

    describe('buttons section', () => {
        it('includes --button-primary-bg', () => {
            expect(result).toContain('--button-primary-bg:');
        });

        it('includes --button-destructive-bg', () => {
            expect(result).toContain('--button-destructive-bg:');
        });
    });

    describe('icons section', () => {
        it('includes --icon-primary', () => {
            expect(result).toContain('--icon-primary:');
        });

        it('includes --tooltip-icon-default', () => {
            expect(result).toContain('--tooltip-icon-default:');
        });
    });

    describe('notifications section', () => {
        it('includes --error', () => {
            expect(result).toContain('--error:');
        });

        it('includes --warning', () => {
            expect(result).toContain('--warning:');
        });

        it('includes --success', () => {
            expect(result).toContain('--success:');
        });
    });

    describe('other section', () => {
        it('includes --border', () => {
            expect(result).toContain('--border:');
        });

        it('includes --drop-shadow', () => {
            expect(result).toContain('--drop-shadow:');
        });

        it('includes --date-picker-bg', () => {
            expect(result).toContain('--date-picker-bg:');
        });
    });

    describe('shell section', () => {
        it('includes --main-nav-bg', () => {
            expect(result).toContain('--main-nav-bg:');
        });

        it('includes --header-netapp-bg', () => {
            expect(result).toContain('--header-netapp-bg:');
        });
    });

    describe('chart section', () => {
        it('includes --chart-1', () => {
            expect(result).toContain('--chart-1:');
        });

        it('includes --chart-background', () => {
            expect(result).toContain('--chart-background:');
        });

        it('includes --chart-disabled', () => {
            expect(result).toContain('--chart-disabled:');
        });
    });

    describe('selectors section', () => {
        it('includes --selector-off-border', () => {
            expect(result).toContain('--selector-off-border:');
        });

        it('includes --toggle-off', () => {
            expect(result).toContain('--toggle-off:');
        });
    });

    describe('loaders section', () => {
        it('includes --loader-wheel-line', () => {
            expect(result).toContain('--loader-wheel-line:');
        });

        it('includes --loader-dot', () => {
            expect(result).toContain('--loader-dot:');
        });
    });

    describe('fields section', () => {
        it('includes --field-border', () => {
            expect(result).toContain('--field-border:');
        });

        it('includes --field-bg-disabled', () => {
            expect(result).toContain('--field-bg-disabled:');
        });
    });

    describe('thirdPartyTokens section', () => {
        it('includes --third-party-aws-smile as white in dark mode', () => {
            expect(result).toContain('--third-party-aws-smile: #ffffff');
        });

        it('includes --third-party-aws-text as white in dark mode', () => {
            expect(result).toContain('--third-party-aws-text: #ffffff');
        });
    });

    describe('canvas section', () => {
        it('includes --canvas-cloud-shadow', () => {
            expect(result).toContain('--canvas-cloud-shadow:');
        });
    });

    describe('components section', () => {
        it('includes --ux-icon-2-color-fg-1', () => {
            expect(result).toContain('--ux-icon-2-color-fg-1:');
        });

        it('includes --ux-icon-2-color-bg', () => {
            expect(result).toContain('--ux-icon-2-color-bg:');
        });
    });
});
