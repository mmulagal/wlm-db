import { DatabaseHostItem, DatabaseJobsItem } from "../../utils/types/databaseHomeTypes";

export const mergeDatabaseHostsData = (hostsData: DatabaseHostItem[] | null, jobsData: DatabaseJobsItem[] | null) => {
    if(!hostsData && !jobsData){
        return [];
    }
    let uniqueIds: Array<String> = [];
    const mergedList: any[] = [];
    jobsData?.map((val) => {
        if(!uniqueIds.includes(val?.id)){
            val = {
                ...val,
                topology: val?.metadata
            }
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    });
    hostsData?.map((val) => {
        if(!uniqueIds.includes(val?.id)){
            mergedList.push(val);
            uniqueIds.push(val?.id);
        }
    })
    return mergedList;
};
