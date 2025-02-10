import { useEffect, useState } from 'react';
import { useLazyGetManagedHostDataQuery } from '../../utils/apiService';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { setIsManagedHostListLoading } from '../../store/workloadFactory/inventoryV2Slice';
import { setMultiSelectData } from '../../store/workloadFactory/headersSlice';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    // Combination that is running currently
    const {
        headerSelectedCred,
        headerSelectedRegion,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    } = useAppSelector(state => state.headers);

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    // First MSSQL API call to get managed host list
    const [getManagedHostListAPI] = useLazyGetManagedHostDataQuery();
    const [managedHostList, setManagedHostList] = useState<any>([]);
    const [managedHostListLoading, setManagedHostListLoading] = useState(true);

    const resetValues = () => {
        setManagedHostList([]);
        setManagedHostListLoading(true);
    };

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
    const getManagedHostList = async (
        managedList: string[],
        managedHostCursor: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getManagedHostListAPI({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: managedHostCursor
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.instances) {
                                managedList = [...managedList, ...perRow?.instances];
                            }
                        });
                        if (result?.data?.nextToken) {
                            getManagedHostList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            setManagedHostListLoading(false);
                            dispatch(setIsManagedHostListLoading(false));
                            setManagedHostList(managedList);
                            //Sample dispatch
                            dispatch(
                                setMultiSelectData({
                                    cred: runningCredId,
                                    region: runningRegionId,
                                    apiName: 'managedHostList',
                                    response: managedList,
                                    status: true
                                })
                            );
                        }
                    } else {
                        setManagedHostListLoading(false);
                        dispatch(setIsManagedHostListLoading(false));
                        setManagedHostList(managedList);
                    }
                }
            } catch (error) {
                setManagedHostListLoading(false);
                dispatch(setIsManagedHostListLoading(false));
                setManagedHostList(managedList);
            }
        }
    };

    useEffect(() => {
        let managedList: string[] = [];
        if (credId && regionId) {
            getManagedHostList(managedList, null, credId, regionId);
        }
    }, [credId, regionId]);

    // To set cred id and region id for selected combination
    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    return <></>;
};

export default InventoryApis;
