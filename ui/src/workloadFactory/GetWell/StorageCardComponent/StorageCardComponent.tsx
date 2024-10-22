import { Button, DsButton, DsFlashingDotsLoader, DsTypography, Spinner } from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import styles from './StorageCardComponent.module.scss';
import GetWellChart from './GetWellChart/GetWellChart';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import DialogContent from './DialogContent/DialogContent';
import { GETWELL_STATUS, WLF_TABS } from '../../../utils/consts';
import { useEffect, useState } from 'react';
import SmallLoader from '../../../common/SmallLoader/SmallLoader';
import { useDispatch } from 'react-redux';
import { setOptimizingData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useLazyGetSubTaskListQuery, useOptimizeStorageConfigMutation } from '../../../utils/apiService';

const StorageCardComponent = ({ cardData, optimizePrintState, type }: any) => {
    const dispatch = useDispatch();
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const { isAssessmentAvailable, selectedResourceId, selectedDatabaseInstance } = useAppSelector(
        state => state.getWellOptimize
    );

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const [disableText, setDisableText] = useState(false);

    useEffect(() => {
        if (!loading && !isAssessmentAvailable) {
            setDisableText(true);
        } else {
            setDisableText(false);
        }
    }, [isAssessmentAvailable, loading]);

    const { setDialog, closeDialog } = useDialog();
    const setImage = (value: string) => {
        if (value === GETWELL_STATUS.OPTIMIZED) {
            return <Optimized />;
        } else if (value === GETWELL_STATUS.UNDER_PROVISIONED) {
            return <UnderProvisioned />;
        } else if (value === GETWELL_STATUS.OVER_PROVISIONED) {
            return (
                <div style={{ transform: 'rotate(180deg)' }}>
                    <UnderProvisioned />
                </div>
            );
        } else if (value === GETWELL_STATUS.NOT_OPTIMIZED) {
            return <NotActive />;
        } else if (value === GETWELL_STATUS.OPTIMIZING) {
            return <SmallLoader />;
        } else {
            return;
        }
    };

    const sectionThreeContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.block_three?.smallFont || !cardData?.block_three?.value) {
            return (
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        } else {
            return (
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
                    {cardData?.block_three?.value || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            );
        }
    };
    const windowSize = useResize();

    const callOptimizeApi = (type: any) => {
        let payload = {
            type: type
        };
        // call optimize api
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [cardData?.id]: 'optimizing'
            })
        );
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: `Optimization process initiated for ${type}. This process can take upto X minutes.`
            })
        );

        optimizeStorageConfig({
            credentialId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload: payload
        }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            handleOptimizeStorageJob(res, { id: cardData?.id, name: type }, failedMsgData, getJobDetailApi, dispatch);
        });
    };

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={<DialogContent type={type} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(type);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.colorSet}
                hidePrimaryButton={
                    type === 'Storage tier' ||
                    type === 'User data files (.mdf) placement' ||
                    type === 'Log files (.ldf) placement' ||
                    type === 'TempDB placement'
                }
            />
        );
    };
    return (
        <div className={styles.storageCardComponent}>
            {/* Section one */}
            <div className={`${styles.commonSection} ${styles.firstSection}`}>
                <DsTypography variant="Semibold_14">{cardData?.block_one?.value}</DsTypography>
                <DsTypography variant="Regular_14">{cardData?.block_one?.type}</DsTypography>
            </div>

            {/* Section Two */}
            <div className={styles.commonSection}>
                {loading && (
                    <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                {!loading && (
                    <div className={styles.statusTopSection}>
                        <div className={styles.svgSection}>
                            {setImage(cardData?.block_two?.value || GENERAL.NOT_AVAILABLE)}
                        </div>
                        <DsTypography variant="Semibold_14" isDisabled={disableText}>
                            {cardData?.block_two?.value || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    </div>
                )}
                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_two?.type}
                </DsTypography>
            </div>

            {/* Section three */}
            <div className={styles.thirdSection} style={{ height: cardData?.block_three?.smallFont ? '56px' : '64px' }}>
                {sectionThreeContent(cardData)}

                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_three?.type}
                </DsTypography>
            </div>

            {/* Section 4 */}
            <div className={styles.commonSection}>
                {loading && (
                    <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                {!loading && (
                    <DsTypography variant="Semibold_14" isDisabled={disableText}>
                        {cardData?.block_four?.value || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                )}
                <DsTypography variant="Regular_14" isDisabled={disableText}>
                    {cardData?.block_four?.type}
                </DsTypography>
            </div>

            {/* 5 Section */}
            {windowSize.width >= 1770 && (
                <div className={styles.fourthSection}>
                    {/* <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" /> */}
                </div>
            )}

            {/* <div className={styles.separator} /> */}

            {/* 6 section */}
            {!optimizePrintState &&
                cardData?.block_one?.value !== 'ONTAP configuration' &&
                cardData?.block_one?.value !== 'Operating system' &&
                (cardData?.block_one?.value === 'User data files (.mdf) placement' ||
                cardData?.block_one?.value === 'Log files (.ldf) placement' ||
                cardData?.block_one?.value === 'TempDB placement' ? (
                    <div className={styles.buttonSection} style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}>
                        <DsButton
                            variant="secondary"
                            onClick={() => {}}
                            isDisabled={true}
                            disabledReason={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                        >
                            Optimize
                        </DsButton>
                    </div>
                ) : (
                    <div className={styles.buttonSection} style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}>
                        <DsButton
                            variant="secondary"
                            onClick={() => handleDialog()}
                            isDisabled={loading || cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED}
                        >
                            Optimize
                        </DsButton>
                    </div>
                ))}
        </div>
    );
};

export default StorageCardComponent;
