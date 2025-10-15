import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import styles from './ErrorInvestigationOverview.module.scss';
import DatabaseOverviewChart from '../DatabaseOverviewChart/DatabaseOverviewChart';
import Square from '../../../../common/Square/Square';
import ActivateErrorInvestigation from './ActivateErrorInvestigation/CategoryDialogComponent/ActivateErrorInvestigation';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setSelectedErrorInvestigationRow,
    setSelectedViewErrorInvestigationRow
} from '../../../../store/workloadFactory/agenticAISlice';
import { ReactComponent as ErrorInvestigateSmall } from '../../../../assets/ErrorInvestigationSmallImage.svg';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import ViewErrorInvestigation from './ActivateErrorInvestigation/CategoryDialogComponent/ViewErrorInvestigation';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

const ErrorInvestigationOverview = () => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const { showNA } = useAppSelector(state => state.headers);
    const loading = false;

    const emptyState = false;

    const handleClick = (type: string) => {
        const tableData = [
            {
                resourceName: 'Resource-1',
                status: 'Up',
                hostName: 'host-1',
                errorInvestigation: 'Activate',
                id: '1'
            },
            {
                resourceName: 'Resource-2',
                status: 'Stopped',
                hostName: 'host-2',
                errorInvestigation: 'Activate',
                id: '2'
            },
            {
                resourceName: 'Resource-3',
                status: 'Running',
                hostName: 'host-3',
                errorInvestigation: 'Activate',
                id: '3'
            }
        ];
        const isOnlineInstance = tableData.some((item: any) => item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        setDialog(
            <DialogComponent
                header={type === 'activate' ? 'Activate error investigation' : 'View error investigation'}
                content={
                    type === 'activate' ? (
                        <ActivateErrorInvestigation tableData={tableData} />
                    ) : (
                        <ViewErrorInvestigation tableData={tableData} />
                    )
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    // redirectToGetWellPage();
                }}
                closeCallback={() => {
                    closeDialog();
                    if (type === 'activate') {
                        dispatch(setSelectedErrorInvestigationRow(null));
                    } else {
                        dispatch(setSelectedViewErrorInvestigationRow(null));
                    }
                }}
                customClass={styles.dialog}
                // primaryButtonDisabled={!tableData || tableData.length === 0 || !isOnlineInstance}
                testId="wlm-db-activate-error-investigation-dialog"
            />
        );
    };
    return (
        <div className={styles.errorInvestigationOverview}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.error-analysis')}
                </DsTypography>

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <div className={styles.buttonContainer}>
                        <DsButton
                            children="Analyze"
                            variant="secondary"
                            isThin
                            isDisabled={loading || showNA}
                            dropDown={{
                                trigger: 'click',
                                autoPosition: true,
                                items: [
                                    {
                                        id: 'wlm-db-activate-error-investigation',
                                        label: t('databases.dashboard.activate-error-investigation'),
                                        onClick: () => {
                                            handleClick('activate');
                                        }
                                    },
                                    {
                                        id: 'wlm-db-view-error-investigation',
                                        label: t('databases.dashboard.view-error-investigation'),
                                        onClick: () => {
                                            handleClick('view');
                                        }
                                    }
                                ]
                            }}
                        />
                    </div>
                </div>
            </div>

            {emptyState && (
                <div className={styles.emptyState}>
                    <div>
                        <ErrorInvestigateSmall />
                    </div>

                    <div className={styles.rightSection}>
                        <DsTypography variant="Semibold_16">Log analyzer</DsTypography>
                        <DsTypography variant="Regular_14">{t('databases.dashboard.error-analysis-text')}</DsTypography>
                    </div>
                </div>
            )}

            {!emptyState && (
                <div className={styles.mainSection}>
                    <div className={styles.sectionOne}>
                        <div className={styles.chartContainer}>
                            <DatabaseOverviewChart
                                color1="#FE5502"
                                color2="#F7941D"
                                color3="#FDC300"
                                data1={800}
                                data2={400}
                                data3={200}
                                centerText="Events"
                                centerValue="28"
                                loading={false}
                                isDisabled={loading || showNA}
                            />
                        </div>

                        <div className={styles.fullBlock}>
                            <div className={styles.block}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA ? t('databases.general.not-available') : 14}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>

                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-8)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        Severity x-y
                                    </DsTypography>
                                </div>
                            </div>

                            <div className={styles.block} style={{ paddingLeft: '24px' }}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA ? t('databases.general.not-available') : 4}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-7)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        Severity x-y
                                    </DsTypography>
                                </div>
                            </div>

                            <div className={styles.block} style={{ borderRight: 'none', paddingLeft: '24px' }}>
                                <div className={styles.rightSection}>
                                    <DsTypography
                                        style={{ lineHeight: 'unset' }}
                                        variant="Regular_24"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {showNA ? t('databases.general.not-available') : 10}
                                    </DsTypography>
                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                                <div className={styles.bottomRow}>
                                    <Square width="8px" height="8px" background="var(--chart-6)" />
                                    <DsTypography
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                        variant="Regular_14"
                                    >
                                        Severity x-y
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.sectionTwo}>
                        <DsTypography variant="Semibold_14">Activation:</DsTypography>
                        <DsTypography className={showNA ? CommonStyles.notAvailable : ''} variant="Regular_14">
                            {showNA
                                ? t('databases.general.not-available')
                                : 'x of y of your resources activated Agentic AI'}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ErrorInvestigationOverview;
