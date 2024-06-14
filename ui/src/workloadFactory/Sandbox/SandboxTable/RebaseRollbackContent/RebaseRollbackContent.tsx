import { DsRadioButton, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './RebaseRollbackContent.module.scss';
import { useEffect, useMemo } from 'react';
import { formatDateWithTime, generateOptionType } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    updateIsRollbackSelected,
    updateRollbackSnapshotList,
    updateRollbackSnapshotsLoading,
    updateSelectedRollbackSnapshot
} from '../../../../store/workloadFactory/sandboxSlice';
import { useLazyGetRollbackSnapshotsQuery } from '../../../../utils/apiService';

const RebaseRollbackContent = ({ rowData }: any) => {
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const { isRollbackSelected, rollbackSnapshotList, selectedRollbackSnapshot, rollbackSnapshotsLoading } =
        useAppSelector(state => state?.sandbox);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

    const dispatch = useDispatch();

    const [getRollbackSnapshotApi] = useLazyGetRollbackSnapshotsQuery();

    useEffect(() => {
        dispatch(updateRollbackSnapshotsLoading(true));
        getRollbackSnapshotApi({
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            databaseHostId: rowData?.databaseHostId,
            sandboxName: rowData?.name
        }).then((res: any) => {
            if (res?.data?.snapshots) {
                dispatch(updateRollbackSnapshotList(res?.data?.snapshots));
            } else {
                dispatch(updateRollbackSnapshotList([]));
            }
            dispatch(updateRollbackSnapshotsLoading(false));
        });
    }, []);

    //Function to generate the options for Select Field
    const generateRollbackOptions = useMemo<optionType[]>((): optionType[] => {
        const frequency = isDemoMode
            ? [
                  'DB 1 | May 1, 2024, 12:15:11',
                  'DB 1 | May 2, 2024, 12:15:11',
                  'DB 1 | May 3, 2024, 12:15:11',
                  'DB 1 | May 4, 2024, 12:15:11'
              ]
            : rollbackSnapshotList;
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
                label={'Original database snapshot'}
                isClearable={false}
                onChange={(selectedOptions: any): void => {
                    dispatch(updateSelectedRollbackSnapshot(selectedOptions));
                }}
                value={selectedRollbackSnapshot}
                isSearchable={true}
                options={generateRollbackOptions}
                className={styles.widthSet}
                isDisabled={!isRollbackSelected}
                isLoading={rollbackSnapshotsLoading}
            />
        </div>
    );
};

export default RebaseRollbackContent;
