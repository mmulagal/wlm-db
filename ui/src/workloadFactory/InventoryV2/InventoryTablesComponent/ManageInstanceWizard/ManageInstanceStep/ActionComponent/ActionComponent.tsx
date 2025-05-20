import { DsCheckbox, DsTypography, useWizard } from '@netapp/design-system';
import styles from './ActionComponent.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setInstallType } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useEffect } from 'react';

const ActionComponent = ({ manageChecks }: any) => {
    const dispatch = useDispatch();
    const { state, setState }: any = useWizard();
    const { installMissingAWS, installMissingPowershell } = useAppSelector(
        state => state.inventoryV2.manageInstanceInstallAction
    );
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    useEffect(() => {
        if (wizardOperationType === 'bulk') {
            dispatch(
                setInstallType({
                    installMissingAWS: true,
                    installMissingPowershell: true
                })
            );
        } else {
            dispatch(
                setInstallType({
                    installMissingAWS: manageChecks?.installMissingAWS,
                    installMissingPowershell: manageChecks?.installMissingPowershell
                })
            );
        }
    }, [wizardOperationType, manageChecks]);

    return (
        <div className={styles.actionComponent}>
            <DsTypography variant="Semibold_16">Action Required</DsTypography>

            {wizardOperationType === 'bulk' ? (
                <div className={styles.selectContainer}>
                    <DsCheckbox
                        id="wlm-db-install-missing-aws"
                        title="Install missing AWS and NetApp PowerShell modules"
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
                        title="Install missing PowerShell 7"
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
                    <DsCheckbox
                        id="wlm-db-install-missing-aws"
                        title="Install missing AWS and NetApp PowerShell modules"
                        onSelect={() => {
                            dispatch(setInstallType({ installMissingAWS: !installMissingAWS }));
                            setState({ installMissingAWS: !installMissingAWS });
                        }}
                        isSelected={installMissingAWS}
                        isDisabled={!manageChecks?.installMissingAWS}
                        className={styles.checkboxContainer}
                    />

                    <DsCheckbox
                        id="wlm-db-install-missing-powershell"
                        title="Install missing PowerShell 7"
                        onSelect={() => {
                            dispatch(setInstallType({ installMissingPowershell: !installMissingPowershell }));
                            setState({ installMissingPowershell: !installMissingPowershell });
                        }}
                        isSelected={installMissingPowershell}
                        isDisabled={!manageChecks?.installMissingPowershell}
                        className={styles.checkboxContainer}
                    />
                </div>
            )}
        </div>
    );
};

export default ActionComponent;
