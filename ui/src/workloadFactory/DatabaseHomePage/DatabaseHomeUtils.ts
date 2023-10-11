

export const mergeDatabaseHostsData = (hostsData: any, jobsData: any) => {
    if(!hostsData && !jobsData){
        return [];
    }
    let uniqueIds: Array<String> = [];
    const mergedList: any[] = [];
    jobsData?.map((val: any) => {
        if(!uniqueIds.includes(val?.id)){
            val = {
                ...val,
                topology: val?.metadata
            }
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    });
    hostsData?.map((val: any) => {
        if(!uniqueIds.includes(val?.id)){
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    })
    return mergedList;
};
