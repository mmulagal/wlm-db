interface Dispatch {
    (action: any): void;
}

export const getUniqueEntries = (arrays: any) => {
    const combinedArray = [].concat(...arrays);
    const seen = new Set();
    return combinedArray.filter(item => {
        const serializedItem = JSON.stringify(item);
        if (seen.has(serializedItem)) {
            return false;
        }
        seen.add(serializedItem);
        return true;
    });
};

export const groupByType = (array: any, returnType: string = 'id') =>
    array.reduce((acc: any, item: any) => {
        const { type, id, value } = item;
        if (!acc[type]) {
            acc[type] = [];
        }
        const retValue = returnType === 'id' ? id : value;
        if (!acc[type].includes(retValue)) {
            acc[type].push(retValue);
        }
        return acc;
    }, {});

export const removeEntry = (input: any, obj: any) => {
    const { id, type } = obj;

    // Create a new object to avoid mutating the original input object
    const updatedInput = { ...input };

    // Check if the type exists in the input object and filter out the id
    if (updatedInput[type]) {
        updatedInput[type] = updatedInput[type].filter((item: any) => item !== id);
    }

    return updatedInput;
};

export const removeObjectFromArray = (array: any, obj: any) =>
    array.filter(
        (item: any) =>
            !(item.id === obj.id && item.label === obj.label && item.value === obj.value && item.type === obj.type)
    );

export const handleSelectForFilter = (
    filters: Array<{ id: string; label: string; value: string }>,
    filterLabel: string,
    filterTags: Array<{ id: string; label: string; value: string; type: string }>,
    dispatch: Dispatch,
    setFilterTags: (tags: Array<{ id: string; label: string; value: string; type: string }>) => void,
    setDefaultFilterOptions: (options: { [key: string]: string[] }) => void
) => {
    let updatedFilters = [...filterTags];

    const selectedIds = new Set(filters.map((filter: any) => filter.id));

    updatedFilters = updatedFilters.filter(
        (filter: any) => !(filter.type === filterLabel && !selectedIds.has(filter.id))
    );

    filters.forEach((filter: any) => {
        const existingFilterIndex = updatedFilters.findIndex(
            (selectedFilter: any) => selectedFilter.value === filter.value && selectedFilter.type === filterLabel
        );

        if (existingFilterIndex === -1) {
            updatedFilters.push({ ...filter, type: filterLabel });
        }
    });

    const uniqueArray = getUniqueEntries([updatedFilters]);
    const reArrange = groupByType(uniqueArray);

    dispatch(setFilterTags(uniqueArray));
    dispatch(setDefaultFilterOptions(reArrange));
};

/** Function to map the dismissed values */
export const mapDismissedValues = (data: any, itemName: string | any) => {
    for (const key in data) {
        const section = data[key];
        if (Array.isArray(section)) {
            // For sizing and layout
            for (const item of section) {
                if (item?.configurationName === itemName) {
                    return item;
                }
            }
        } else if (typeof section === 'object') {
            // For configuration
            for (const subKey in section) {
                const subSection = section[subKey];
                if (Array.isArray(subSection)) {
                    for (const item of subSection) {
                        if (item?.configurationName === itemName) {
                            return item;
                        }
                    }
                }
            }
        }
    }
    return null;
};
