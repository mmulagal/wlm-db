const storageSizingDescriptions: { [key: string]: string } = {
    'log-drive-size': 'log drive',
    headroom: 'file system headroom',
    'tempdb-drive-size': 'tempDB drive'
};

const getStorageSizingSchemaDesc = (type: string[]): string => {
    const key = type && type.length > 0 ? type[0] : '';
    const paramName = storageSizingDescriptions[key] || 'storage sizing';
    return `Optimize ${paramName} parameters as per the best practice for the selected database instance.`;
};

export { getStorageSizingSchemaDesc };
