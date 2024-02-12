import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';

import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';

const DatabaseName = () => {
    //Set the Header text here
    const setHeader = () => {
        return <ActionRequired error={false} />;
    };
    return (
        <div className={styles.dataBaseName}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div className={CommonStyles.title}>{'Database name'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content here</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
