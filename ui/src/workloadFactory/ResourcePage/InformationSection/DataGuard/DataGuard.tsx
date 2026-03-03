import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { Button, useDialog, TooltipInfo } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { formatDataGuardLag, toSentenceCase } from '../../../../utils/resourceUtils';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import ReplicatesDialogContent from './ReplicatesDialogContent/ReplicatesDialogContent';
import { OVERVIEW_CARDS_HEADINGS } from '../../../../utils/consts';

type accordionType = {
    handleToggle: any;
    openKey: string;
    resourceDetails: any;
    resourceLoading: boolean;
};

const DataGuard = ({ handleToggle, openKey, resourceDetails, resourceLoading }: accordionType) => {
    const { t } = useTranslation();
    const { setDialog } = useDialog();
    const isPrimary = resourceDetails?.dataguardDetails?.isPrimaryNode === true;

    const handleReplicaDialog = () => {
        if (!resourceDetails?.dataguardDetails?.associatedHosts?.length) return;
        setDialog(
            <DialogComponent
                header={t('databases.data-guard.related-databases')}
                content={<ReplicatesDialogContent resourceDetails={resourceDetails} />}
                primaryButton={t('databases.general.close')}
                callback={() => {}}
            />
        );
    };

    const contentArea = () => {
        const protectionLevel = resourceDetails?.dataguardDetails?.protectionLevel ?? '';
        return (
            <>
                <div className={commonStyles.row}>
                    <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                        {t('databases.data-guard.protection-mode')}
                    </DsTypography>
                    <DsTypography variant="Regular_14">{toSentenceCase(protectionLevel)}</DsTypography>
                </div>
                <div className={commonStyles.row}>
                    <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                        {toSentenceCase(t('databases.data-guard.open-mode'))}
                    </DsTypography>
                    <DsTypography variant="Regular_14">
                        {toSentenceCase(resourceDetails?.dataguardDetails?.openMode ?? '')}
                    </DsTypography>
                </div>
                <div className={commonStyles.row}>
                    <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                        {t('databases.data-guard.active-data-guard')}
                    </DsTypography>
                    <DsTypography variant="Regular_14">
                        {resourceDetails?.dataguardDetails?.isActiveDataguard === true
                            ? t('databases.data-guard.enabled')
                            : t('databases.data-guard.disabled')}
                    </DsTypography>
                </div>
                {!isPrimary && (
                    <>
                        <div className={commonStyles.row}>
                            <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                                {t('databases.data-guard.transport-lag')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {formatDataGuardLag(
                                    resourceDetails?.dataguardDetails?.status?.transportLag,
                                    t('databases.data-guard.ahead-by')
                                )}
                            </DsTypography>
                        </div>
                        <div className={commonStyles.row}>
                            <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                                {t('databases.data-guard.apply-lag')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {formatDataGuardLag(
                                    resourceDetails?.dataguardDetails?.status?.applyLag,
                                    t('databases.data-guard.ahead-by')
                                )}
                            </DsTypography>
                        </div>
                    </>
                )}
                <div
                    className={`${commonStyles.row} ${commonStyles.rowSingleColumn} ${commonStyles.rowFlexCenter}`}
                >
                    <Button
                        variant="text"
                        onClick={handleReplicaDialog}
                        disabled={!resourceDetails?.dataguardDetails?.associatedHosts?.length}
                    >
                        {t('databases.data-guard.view-related-databases')}
                    </Button>
                    {!resourceDetails?.dataguardDetails?.associatedHosts?.length && (
                        <TooltipInfo trigger="hover" isAppendedToBody>
                            <DsTypography variant="Regular_13">
                                {t('databases.data-guard.related-databases-config-issue-tooltip')}
                            </DsTypography>
                        </TooltipInfo>
                    )}
                </div>
            </>
        );
    };
    return (
        <div className="">
            <DbAccordion
                resourceLoading={resourceLoading}
                heading={OVERVIEW_CARDS_HEADINGS.DATA_GUARD_CONFIGURATIONS}
                toggle={handleToggle}
                open={openKey === OVERVIEW_CARDS_HEADINGS.DATA_GUARD_CONFIGURATIONS}
                content={contentArea()}
            />
        </div>
    );
};

export default DataGuard;
