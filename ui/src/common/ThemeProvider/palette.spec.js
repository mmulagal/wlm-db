import palette from './palette';

describe('palette', () => {
    describe('exports an enhanced palette object', () => {
        it('is defined and is an object', () => {
            expect(palette).toBeDefined();
            expect(typeof palette).toBe('object');
        });

        it('contains White color', () => {
            expect(palette.White).toBe('#fff');
        });

        it('contains Grey color variants', () => {
            expect(palette.Grey10).toBe('#f5f5f5');
            expect(palette.Grey15).toBe('#e0e0e0');
            expect(palette.Grey20).toBe('#CBD4DA');
            expect(palette.Grey40).toBe('#858C95');
            expect(palette.Grey50).toBe('#404040');
            expect(palette.Grey70).toBe('#111925');
        });

        it('contains Blue color variants', () => {
            expect(palette.Blue10).toBe('#F4FBFF');
            expect(palette.Blue40).toBe('#84B0FF');
            expect(palette.Blue50).toBe('#0860ED');
            expect(palette.Blue70).toBe('#0067C5');
        });

        it('contains Red color variants', () => {
            expect(palette.Red10).toBe('#FFF5F5');
            expect(palette.Red20).toBe('#EB797B');
            expect(palette.Red30).toBe('#DA1E21');
            expect(palette.Red40).toBe('#A30D0F');
        });

        it('contains Orange color variants', () => {
            expect(palette.Orange15).toBe('#FEAF58');
            expect(palette.Orange50).toBe('#F7941D');
        });

        it('contains Green color variants', () => {
            expect(palette.Green20).toBe('#ACDA6F');
            expect(palette.Green60).toBe('#48A08B');
        });

        it('contains Cyan color variants', () => {
            expect(palette.Cyan20).toBe('#5E8DCD');
            expect(palette.Cyan40).toBe('#6EB8DF');
        });

        it('contains Purple color variants', () => {
            expect(palette.Purple03).toBe('#E8EEFD');
            expect(palette.Purple10).toBe('#A855B8');
            expect(palette.Purple30).toBe('#550057');
        });
    });

    describe('enhance — adds _RGB variants for every color', () => {
        it('generates White_RGB from shorthand hex #fff → [255, 255, 255]', () => {
            expect(palette.White_RGB).toBe('255 255 255');
        });

        it('generates Grey10_RGB from #f5f5f5 → [245, 245, 245]', () => {
            expect(palette.Grey10_RGB).toBe('245 245 245');
        });

        it('generates Grey70_RGB from #111925', () => {
            expect(palette.Grey70_RGB).toBe('17 25 37');
        });

        it('generates Blue50_RGB from #0860ED', () => {
            expect(palette.Blue50_RGB).toBe('8 96 237');
        });

        it('generates Red30_RGB from #DA1E21', () => {
            expect(palette.Red30_RGB).toBe('218 30 33');
        });

        it('generates Cyan40_RGB from #6EB8DF', () => {
            expect(palette.Cyan40_RGB).toBe('110 184 223');
        });

        it('generates Purple10_RGB from #A855B8', () => {
            expect(palette.Purple10_RGB).toBe('168 85 184');
        });

        it('every palette key has a corresponding _RGB key', () => {
            const originalKeys = [
                'White',
                'Grey10',
                'Grey15',
                'Grey20',
                'Grey25',
                'Grey30',
                'Grey40',
                'Grey45',
                'Grey50',
                'Grey55',
                'Grey60',
                'Grey65',
                'Grey70',
                'Grey75',
                'Blue10',
                'Blue20',
                'Blue30',
                'Blue40',
                'Blue50',
                'Blue60',
                'Blue70',
                'Blue80',
                'Red10',
                'Red20',
                'Red30',
                'Red40',
                'Orange10',
                'Orange15',
                'Orange20',
                'Orange30',
                'Orange40',
                'Orange50',
                'Orange60',
                'Orange70',
                'Orange80',
                'Green10',
                'Green20',
                'Green30',
                'Green40',
                'Green50',
                'Green60',
                'Cyan10',
                'Cyan20',
                'Cyan30',
                'Cyan40',
                'Cyan50',
                'Cyan60',
                'Cyan70',
                'Purple03',
                'Purple10',
                'Purple15',
                'Purple20',
                'Purple30'
            ];
            originalKeys.forEach(key => {
                expect(palette[`${key}_RGB`]).toBeDefined();
                expect(typeof palette[`${key}_RGB`]).toBe('string');
            });
        });

        it('_RGB value is in "r g b" format (space-separated numbers)', () => {
            const rgbValues = palette.Blue70_RGB.split(' ');
            expect(rgbValues).toHaveLength(3);
            rgbValues.forEach(v => {
                expect(Number(v)).toBeGreaterThanOrEqual(0);
                expect(Number(v)).toBeLessThanOrEqual(255);
            });
        });
    });
});
