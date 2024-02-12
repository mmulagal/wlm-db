import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';

import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';

import styles from './FileSettings.module.scss';

const FileSettings = () => {
    //Set the Header text here
    const setHeader = () => {
        return <ActionRequired error={false} />;
    };
    return (
        <div className={styles.fileSettings}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{'File  settings'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content here</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FileSettings;
