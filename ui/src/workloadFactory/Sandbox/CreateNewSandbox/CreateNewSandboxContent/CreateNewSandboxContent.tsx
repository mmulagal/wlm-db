import { DsTypography } from '@netapp/design-system';
import styles from './CreateNewSandboxContent.module.scss';

const CreateNewSandboxContent = () => {
    return (
        <div className={styles.createNewSandboxContent}>
            <DsTypography variant="Semibold_16" className={styles.heading}>
                Create Sandbox
            </DsTypography>
        </div>
    );
};

export default CreateNewSandboxContent;
