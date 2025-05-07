import { DsCheckbox, DsTypography, useWizard } from '@netapp/design-system';
import styles from './ActionComponent.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { setInstallType } from '../../../../../../store/workloadFactory/inventoryV2Slice';

const ActionComponent = () => {
    const dispatch = useDispatch();
    const { state, setState }: any = useWizard();
    const { installMissingAWS, installMissingPowershell } = useAppSelector(
        state => state.inventoryV2.manageInstanceInstallAction
    );
    return (
        <div className={styles.actionComponent}>
            <DsTypography variant="Semibold_16">Action Required</DsTypography>
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
        </div>
    );
};

export default ActionComponent;
