const hexToRgb = hex =>
    hex
        .replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1)
        .match(/.{2}/g)
        .map(x => parseInt(x, 16));

const palette = {
    White: '#fff',

    Grey10: '#f5f5f5',
    Grey15: '#e0e0e0',
    Grey20: '#CBD4DA',
    Grey25: '#C8C8C8',
    Grey30: '#A7A7A7',
    Grey40: '#858C95',
    Grey45: '#6F6F6F',
    Grey50: '#404040',
    Grey55: '#4D5765',
    Grey60: '#3A4454',
    Grey65: '#2B323D',
    Grey70: '#111925',
    Grey75: '#060B12',

    Blue10: '#F4FBFF',
    Blue20: '#DDF1FF',
    Blue30: '#B9D4FF',
    Blue40: '#84B0FF',
    Blue50: '#0860ED',
    Blue60: '#405EBD',
    Blue70: '#0067C5',
    Blue80: '#1E4A93',

    Red10: '#FFF5F5',
    Red20: '#EB797B',
    Red30: '#DA1E21',
    Red40: '#A30D0F',

    Orange10: '#FFF6EF',
    Orange15: '#FEAF58',
    Orange20: '#EB9E41',
    Orange30: '#E7BE36',
    Orange40: '#FDC300',
    Orange50: '#F7941D',
    Orange60: '#EF6C01',
    Orange70: '#FE5502',
    Orange80: '#DF5A19',

    Green10: '#F2FCF9',
    Green20: '#ACDA6F',
    Green30: '#B2D234',
    Green40: '#A3B94C',
    Green50: '#68C6B3',
    Green60: '#48A08B',

    Cyan10: '#EDF6FF',
    Cyan20: '#5E8DCD',
    Cyan30: '#518BEC',
    Cyan40: '#6EB8DF',
    Cyan50: '#0BAFFC',
    Cyan60: '#4066DA',
    Cyan70: '#012CAD',

    Purple03: '#E8EEFD',
    Purple10: '#A855B8',
    Purple15: '#DE9EFF',
    Purple20: '#A815F3',
    Purple30: '#550057'
};

const enhance = palette => {
    const out = { ...palette };
    for (const key in palette) {
        out[key + '_RGB'] = hexToRgb(palette[key]).join(' ');
    }

    return out;
};

export default enhance(palette);
