import { AccordionController, DsTypography } from '@netapp/design-system';
import styles from './CreateNewSandboxContent.module.scss';
import SelectSource from './SelectSource/SelectSource';
import SelectTarget from './SelectTarget/SelectTarget';
import Mount from './Mount/Mount';
import DefineTag from './DefineTag/DefineTag';
import { GENERAL } from '../../../../utils/appConstants';

const CreateNewSandboxContent = () => {
    return (
        <div className={styles.createNewSandboxContent}>
            <DsTypography variant="Semibold_16" className={styles.heading}>
                {GENERAL.CREATE_SANDBOX}
            </DsTypography>

            <div className={styles.accordionContainer}>
                <AccordionController isGrouped>
                    <SelectSource />
                    <SelectTarget />
                    <Mount />
                    <DefineTag />
                </AccordionController>
            </div>
        </div>
    );
};

export default CreateNewSandboxContent;
