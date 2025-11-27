import { DsRadioButton, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './RebaseRollbackContent.module.scss';
import { formatDateWithTime, generateOptionType } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    resetRefreshDialog,
    updateIsRollbackSelected,
    updateRollbackSnapshotList,
    updateRollbackSnapshotsLoading,
    updateSelectedRollbackSnapshot
} from '../../../../store/workloadFactory/sandboxSlice';
import { useLazyGetRollbackSnapshotsQuery } from '../../../../utils/apiService';
import { WLF_TABS } from '../../../../utils/consts';

interface RefreshRollbackProps {
    rowData: any;
    fromPage: string;
}

const RebaseRollbackContent = ({ rowData, fromPage }: RefreshRollbackProps) => {
    const { isRollbackSelected, rollbackSnapshotList, selectedRollbackSnapshot, rollbackSnapshotsLoading } =
        useAppSelector(state => state?.sandbox);
    const { headerSelectedCredSandbox, headerSelectedRegionSandbox } = useAppSelector(state => state.headers);
    const { selectedResourceCredId, selectedResourceRegionId } = useAppSelector(state => state.workloadFactoryResource);
    const [snapshotsFetched, setSnapshotsFetched] = useState(false);

    const dispatch = useDispatch();

    const [getRollbackSnapshotApi] = useLazyGetRollbackSnapshotsQuery();

    useEffect(
        () => () => {
            dispatch(resetRefreshDialog());
        },
        []
    );

    useEffect(() => {
        if (isRollbackSelected && !snapshotsFetched) {
            dispatch(updateRollbackSnapshotsLoading(true));
            getRollbackSnapshotApi({
                credentialId:
                    fromPage === WLF_TABS.SANDBOXES
                        ? headerSelectedCredSandbox?.data?.credentialsId
                        : selectedResourceCredId,
                region:
                    fromPage === WLF_TABS.SANDBOXES ? headerSelectedRegionSandbox?.label2 : selectedResourceRegionId,
                databaseHostId: rowData?.databaseHostId,
                instanceId: rowData?.instanceId,
                sandboxName: rowData?.name
            }).then((res: any) => {
                if (res?.data?.snapshots) {
                    dispatch(updateRollbackSnapshotList(res?.data?.snapshots));
                } else {
                    dispatch(updateRollbackSnapshotList([]));
                }
                dispatch(updateRollbackSnapshotsLoading(false));
                setSnapshotsFetched(true);
            });
        }
    }, [isRollbackSelected]);

    // Function to generate the options for Select Field
    const generateRollbackOptions = useMemo<optionType[]>((): optionType[] => {
        const frequency = rollbackSnapshotList;
        const options: optionType[] = [];
        frequency?.map((val: any, idx: number) => {
            const label = `${val?.name} | ${formatDateWithTime(val?.created)}`;
            const option = generateOptionType(val?.name, label, '', false, '', '');
            options.push(option);
        });
        return options;
    }, [rollbackSnapshotList]);

    useEffect(() => {
        if (isRollbackSelected && !selectedRollbackSnapshot) {
            dispatch(updateSelectedRollbackSnapshot(generateRollbackOptions?.[0]));
        }
    }, [isRollbackSelected, selectedRollbackSnapshot, generateRollbackOptions]);

    return (
        <div className={styles.rebaseRollBack}>
            <div className={styles.radioContainer}>
                <DsRadioButton
                    id="refresh-current-time"
                    isSelected={!isRollbackSelected}
                    title={GENERAL.REFRESH_CURRENT_RADIO}
                    variant="Default"
                    onClick={() => dispatch(updateIsRollbackSelected(false))}
                />
                <DsRadioButton
                    id="refresh-snapshot"
                    isSelected={isRollbackSelected}
                    title={GENERAL.REFRESH_SNAPSHOT_RADIO}
                    variant="Default"
                    onClick={() => dispatch(updateIsRollbackSelected(true))}
                />
            </div>
            <SelectField
                label="Original database snapshot"
                isClearable={false}
                onChange={(selectedOptions: any): void => {
                    dispatch(updateSelectedRollbackSnapshot(selectedOptions));
                }}
                value={selectedRollbackSnapshot}
                isSearchable
                options={generateRollbackOptions}
                className={styles.widthSet}
                isDisabled={!isRollbackSelected}
                isLoading={rollbackSnapshotsLoading}
            />
        </div>
    );
};

export default RebaseRollbackContent;
