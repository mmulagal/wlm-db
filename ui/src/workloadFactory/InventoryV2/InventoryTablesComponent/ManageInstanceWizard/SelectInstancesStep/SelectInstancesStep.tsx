import { useWizard } from '@netapp/design-system/dist/components/Wizard';

import styles from './SelectInstancesStep.module.scss';

import ManageWizardFooter from '../ManageWizardFooter';

import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MultipleInstances } from '../../../../../assets/Multiple instances credentials 3.svg';
import SelectInstances from '../DetectInstanceStep/DetectContent/SelectInstances';

export const Content = () => {
    return (
        <div className={styles['select-instances']}>
            <div className={styles.container}>
                <div className={styles.image}>
                    <MultipleInstances />
                </div>
                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_16">
                        Selecting multiple instances requires shared credentials.
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.description}>
                        Select multiple Microsoft SQL Server instances that share the same authentication credentials
                        and FSx for ONTAP credentials, or a group of instances that are already authenticated.
                    </DsTypography>
                </div>

                <div className={styles.selectInstances}>
                    <SelectInstances />
                </div>
            </div>
        </div>
    );
};

export const Footer = () => {
    const { state }: any = useWizard();
    return (
        <ManageWizardFooter
            nextButtonProps={{
                onClick: async () => {
                    if (state.submit) {
                        state.submit();
                    }
                }
            }}
        />
    );
};
