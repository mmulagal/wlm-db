import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useDialog } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as SandboxIcon } from '../../../../assets/SandboxIcon.svg';
import { ReactComponent as SourceDatabase } from '../../../../assets/SourceDatabase.svg';
import { ReactComponent as SourceDatabaseDisabled } from '../../../../assets/SourceDataDIsabled.svg';
import { ReactComponent as SandboxIconDisabled } from '../../../../assets/SandboxDisabled.svg';
import { ReactComponent as SandboxSmallImage } from '../../../../assets/SandboxSmallImage.svg';
import styles from './Sandboxes.module.scss';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';

import { useAppSelector } from '../../../../store/storeHooks';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import SandboxDialog from './SandboxDialog/SandboxDialog';
import { GENERAL } from '../../../../utils/appConstants';
import { setSelectedSandboxRow } from '../../../../store/workloadFactory/sandboxSlice';
import { DBType, INVENTORY_STATUS } from '../../../../utils/consts';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import store from '../../../../store/store';
import { createUniqueSandboxTableData, getUniqueSourceDatabasesCount } from '../../../Sandbox/SandboxUtility';

const Sandboxes = () => {
    const { t } = useTranslation();
    const { isNA } = useAppSelector(state => state.sandbox);
    const dispatch = useDispatch();
    const { loading: dataLoading, data: aggregatedSandboxList } = useAppSelector(
        state => state.inventoryV2.dashSandboxList
    );
    const navigate = useNavigate();
    const { setDialog, closeDialog } = useDialog();
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } =
        useAppSelector(state => state.headers);

    const [data, setData] = useState<any>([]);

    const loading = useMemo(() => dataLoading || multiDataLoading, [dataLoading, multiDataLoading]);

    useEffect(() => {
        const filteredList: Array<any> = [];
        const uniqueResourceList: Array<string> = [];
        if (aggregatedSandboxList?.length > 0) {
            aggregatedSandboxList.forEach((item: any) => {
                const uniqueRow = `${item?.databaseHostId}_${item?.databaseInstanceId}_${item?.sandboxName}`;
                if (
                    !headerSelectedMultiCredIdsList?.includes(item?.credentialId) ||
                    !headerSelectedMultiRegionIdsList?.includes(item?.regionId) ||
                    uniqueResourceList.includes(uniqueRow) ||
                    item?.error // Skip items with an error field that has a value
                ) {
                    return;
                }
                uniqueResourceList.push(uniqueRow);
                filteredList.push({
                    ...item,
                    type: DBType.MSSQL
                });
            });
            setData(filteredList);
        }
    }, [aggregatedSandboxList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    const sandboxRowClick = () => {
        const state = store.getState();
        const { selectedSandboxRow } = state.sandbox;
        dispatch(
            setSelectedSandboxHeaderValue({
                credId: selectedSandboxRow?.credentialId,
                regionId: selectedSandboxRow?.regionId
            })
        );

        dispatch(
            setSelectedCsData({
                host: selectedSandboxRow?.databaseHostName,
                instance: selectedSandboxRow?.databaseInstanceName,
                database: null
            })
        );

        navigate('../create-new-sandbox');
    };

    const handleClick = () => {
        const tableData: any = createUniqueSandboxTableData(data);
        const isOnlineInstance = tableData.some((item: any) => item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        setDialog(
            <DialogComponent
                header={t('databases.dashboard.create-sandbox')}
                content={<SandboxDialog tableData={tableData} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    sandboxRowClick();
                }}
                closeCallback={() => {
                    closeDialog();
                    dispatch(setSelectedSandboxRow(null));
                }}
                customClass={styles.dialog}
                primaryButtonDisabled={!tableData || tableData.length === 0 || !isOnlineInstance}
                testId="wlm-db-create-sandbox-dialog"
            />
        );
    };

    return (
        <div className={styles.sandboxes}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.sandboxes')}
                </DsTypography>

                <div className={styles.buttonContainer}>
                    <DsButton
                        variant="secondary"
                        isThin
                        onClick={() => handleClick()}
                        isDisabled={loading || (data && data.length === 0) || isNA}
                    >
                        {t('databases.dashboard.create-sandbox')}
                    </DsButton>
                </div>
            </div>

            <div className={styles.mainSection}>
                {!loading && data && data.length === 0 ? (
                    <>
                        <div>
                            <SandboxSmallImage />
                        </div>

                        <DsTypography variant="Regular_14">{t('databases.dashboard.sandbox-text')}</DsTypography>
                    </>
                ) : (
                    <>
                        <div className={styles.blockSection}>
                            {!isNA && <SourceDatabase />}
                            {isNA && <SourceDatabaseDisabled />}

                            <div className={styles.rightSection}>
                                {!isNA && (
                                    <div className={styles.textSection}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            {data && getUniqueSourceDatabasesCount(data)}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                )}

                                {isNA && (
                                    <DsTypography variant="Regular_14" className={styles.disabled}>
                                        {t('databases.general.not-available-table-columns')}
                                    </DsTypography>
                                )}

                                <DsTypography variant="Regular_14" className={isNA ? styles.disabled : ''}>
                                    {t('databases.dashboard.source-databases')}
                                </DsTypography>
                            </div>
                        </div>

                        <SeparatorComponent variant="vertical" height="56px" />

                        <div className={styles.blockSection}>
                            {!isNA && <SandboxIcon />}
                            {isNA && <SandboxIconDisabled />}

                            <div className={styles.rightSection}>
                                {!isNA && (
                                    <div className={styles.textSection}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            {data && data.length}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                )}

                                {isNA && (
                                    <DsTypography variant="Regular_14" className={styles.disabled}>
                                        {t('databases.general.not-available-table-columns')}
                                    </DsTypography>
                                )}
                                <DsTypography variant="Regular_14" className={isNA ? styles.disabled : ''}>
                                    {t('databases.dashboard.sandboxes')}
                                </DsTypography>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Sandboxes;
