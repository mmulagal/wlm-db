import { DsCheckbox, DsTypography, Popover, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './ActionComponent.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setInstallType } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useEffect } from 'react';
import { ACTION_TYPE } from '../../../../../../utils/consts';

const ActionComponent = ({ manageChecks }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: any = useWizard();
    const { installMissingAWS, installMissingPowershell } = useAppSelector(
        state => state.inventoryV2.manageInstanceInstallAction
    );
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    useEffect(() => {
        dispatch(
            setInstallType({
                installMissingAWS: manageChecks?.installMissingAWS,
                installMissingPowershell: manageChecks?.installMissingPowershell
            })
        );
    }, [wizardOperationType, manageChecks]);

    return (
        <div className={styles.actionComponent}>
            <DsTypography variant="Semibold_16">{t('databases.general.action-required')}</DsTypography>

            {wizardOperationType === ACTION_TYPE.BULK ? (
                <div className={styles.selectContainer}>
                    <DsCheckbox
                        id="wlm-db-install-missing-aws"
                        title={t('databases.register-flow.missing-modules-title')}
                        onSelect={() => {
                            dispatch(setInstallType({ installMissingAWS: !installMissingAWS }));
                            setState({ installMissingAWS: !installMissingAWS });
                        }}
                        isSelected={installMissingAWS}
                        isDisabled={false}
                        className={styles.checkboxContainer}
                    />

                    <DsCheckbox
                        id="wlm-db-install-missing-powershell"
                        title={t('databases.register-flow.missing-powershell-title')}
                        onSelect={() => {
                            dispatch(setInstallType({ installMissingPowershell: !installMissingPowershell }));
                            setState({ installMissingPowershell: !installMissingPowershell });
                        }}
                        isSelected={installMissingPowershell}
                        isDisabled={false}
                        className={styles.checkboxContainer}
                    />
                </div>
            ) : (
                <div className={styles.selectContainer}>
                    {manageChecks?.installMissingAWS && (
                        <DsCheckbox
                            id="wlm-db-install-missing-aws"
                            title={t('databases.register-flow.missing-modules-title')}
                            onSelect={() => {
                                dispatch(setInstallType({ installMissingAWS: !installMissingAWS }));
                                setState({ installMissingAWS: !installMissingAWS });
                            }}
                            isSelected={installMissingAWS}
                            isDisabled={!manageChecks?.installMissingAWS}
                            className={styles.checkboxContainer}
                        />
                    )}

                    {manageChecks?.installMissingPowershell && (
                        <DsCheckbox
                            id="wlm-db-install-missing-powershell"
                            title={t('databases.register-flow.missing-powershell-title')}
                            onSelect={() => {
                                dispatch(setInstallType({ installMissingPowershell: !installMissingPowershell }));
                                setState({ installMissingPowershell: !installMissingPowershell });
                            }}
                            isSelected={installMissingPowershell}
                            isDisabled={!manageChecks?.installMissingPowershell}
                            className={styles.checkboxContainer}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionComponent;
