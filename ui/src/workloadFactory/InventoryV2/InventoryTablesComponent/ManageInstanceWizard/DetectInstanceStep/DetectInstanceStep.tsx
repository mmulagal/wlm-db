import { useWizard } from '@netapp/design-system/dist/components/Wizard';

import DetectHeader from './DetectHeader/DetectHeader';
import styles from './DetectInstanceStep.module.scss';
import DetectContent from './DetectContent/DetectContent';
import ManageWizardFooter from '../ManageWizardFooter';

export const Content = () => {
    return (
        <div className={styles['detect-step']}>
            <DetectHeader />
            <DetectContent />
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
