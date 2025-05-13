import { useWizard } from '@netapp/design-system';
import ManageWizardFooter from '../ManageWizardFooter';

export const Content = () => {
    const { state, setState } = useWizard();
    return <div>ManageInstance</div>;
};

export const Footer = () => {
    return <ManageWizardFooter />;
};
