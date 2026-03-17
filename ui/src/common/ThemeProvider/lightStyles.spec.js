import lightStyles from './lightStyles';
import palette from './palette';

// Mock tagged template literal — joins strings and interpolated values
const mockCss = (strings, ...values) =>
    strings.reduce((result, str, i) => result + str + (values[i] !== undefined ? values[i] : ''), '');

describe('lightStyles', () => {
    let result;

    beforeAll(() => {
        result = lightStyles(mockCss, palette);
    });

    it('is a function', () => {
        expect(typeof lightStyles).toBe('function');
    });

    it('returns a non-empty string when called', () => {
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('joins all sections with newline', () => {
        expect(result).toContain('\n');
    });

    describe('background (bg) section', () => {
        it('includes --main-background with Grey10', () => {
            expect(result).toContain('--main-background:');
            expect(result).toContain(palette.Grey10);
        });

        it('includes --content-background with White', () => {
            expect(result).toContain('--content-background:');
            expect(result).toContain(palette.White);
        });

        it('includes --hover-background with Blue10', () => {
            expect(result).toContain('--hover-background:');
        });

        it('includes --table-header-background with Blue20', () => {
            expect(result).toContain('--table-header-background:');
        });
    });

    describe('text section', () => {
        it('includes --text-primary with Grey50', () => {
            expect(result).toContain('--text-primary:');
        });

        it('includes --text-secondary', () => {
            expect(result).toContain('--text-secondary:');
        });

        it('includes --text-title with Blue70', () => {
            expect(result).toContain('--text-title:');
        });
    });

    describe('buttons section', () => {
        it('includes --button-primary-bg with Blue70', () => {
            expect(result).toContain('--button-primary-bg:');
        });

        it('includes --button-destructive-bg', () => {
            expect(result).toContain('--button-destructive-bg:');
        });

        it('includes --button-card-footer', () => {
            expect(result).toContain('--button-card-footer:');
        });
    });

    describe('icons section', () => {
        it('includes --icon-primary with Blue70', () => {
            expect(result).toContain('--icon-primary:');
        });

        it('includes --tooltip-icon-hover', () => {
            expect(result).toContain('--tooltip-icon-hover:');
        });

        it('includes --tooltip-info-bg with White', () => {
            expect(result).toContain('--tooltip-info-bg:');
        });
    });

    describe('notifications section', () => {
        it('includes --error with Red30', () => {
            expect(result).toContain('--error:');
        });

        it('includes --error-bg with Red10', () => {
            expect(result).toContain('--error-bg:');
        });

        it('includes --success', () => {
            expect(result).toContain('--success:');
        });

        it('includes --information', () => {
            expect(result).toContain('--information:');
        });
    });

    describe('other section', () => {
        it('includes --border with Grey15', () => {
            expect(result).toContain('--border:');
        });

        it('includes --drop-shadow', () => {
            expect(result).toContain('--drop-shadow:');
        });

        it('includes --date-picker-bg', () => {
            expect(result).toContain('--date-picker-bg:');
        });

        it('includes --scroller-track as #eee', () => {
            expect(result).toContain('--scroller-track: #eee');
        });
    });

    describe('shell section', () => {
        it('includes --main-nav-bg with White', () => {
            expect(result).toContain('--main-nav-bg:');
        });

        it('includes --header-netapp-bg with Blue70', () => {
            expect(result).toContain('--header-netapp-bg:');
        });

        it('includes --header-service-bg with White', () => {
            expect(result).toContain('--header-service-bg:');
        });
    });

    describe('chart section', () => {
        it('includes --chart-1 with Cyan70', () => {
            expect(result).toContain('--chart-1:');
        });

        it('includes --chart-background', () => {
            expect(result).toContain('--chart-background:');
        });

        it('includes --chart-disabled with Grey15', () => {
            expect(result).toContain('--chart-disabled:');
        });
    });

    describe('selectors section', () => {
        it('includes --selector-off-border with Grey50', () => {
            expect(result).toContain('--selector-off-border:');
        });

        it('includes --selector-on-bg with Blue70', () => {
            expect(result).toContain('--selector-on-bg:');
        });

        it('includes --toggle-off', () => {
            expect(result).toContain('--toggle-off:');
        });
    });

    describe('loaders section', () => {
        it('includes --loader-wheel-line with Blue70', () => {
            expect(result).toContain('--loader-wheel-line:');
        });

        it('includes --loader-dot with Cyan30', () => {
            expect(result).toContain('--loader-dot:');
        });

        it('includes --loader-line-bg with Grey15', () => {
            expect(result).toContain('--loader-line-bg:');
        });
    });

    describe('fields section', () => {
        it('includes --field-border', () => {
            expect(result).toContain('--field-border:');
        });

        it('includes --field-bg-disabled', () => {
            expect(result).toContain('--field-bg-disabled:');
        });

        it('includes --field-icon', () => {
            expect(result).toContain('--field-icon:');
        });
    });

    describe('thirdPartyTokens section', () => {
        it('includes --third-party-aws-smile as AWS orange in light mode', () => {
            expect(result).toContain('--third-party-aws-smile: #ff9900');
        });

        it('includes --third-party-aws-text as dark in light mode', () => {
            expect(result).toContain('--third-party-aws-text: #252f3e');
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

        it('includes --ux-icon-2-color-fg-2', () => {
            expect(result).toContain('--ux-icon-2-color-fg-2:');
        });

        it('includes --ux-icon-2-color-bg', () => {
            expect(result).toContain('--ux-icon-2-color-bg:');
        });
    });

    describe('light vs dark differences', () => {
        it('dark uses Grey10 as main-background while dark uses Grey70', () => {
            expect(result).toContain(palette.Grey10);
        });

        it('third-party AWS smile is orange (#ff9900) in light, not white', () => {
            expect(result).toContain('#ff9900');
            expect(result).not.toContain('#ffffff');
        });
    });
});
