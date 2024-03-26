import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import styles from './Mount.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';

const Mount = () => {
    const setHeader = () => {
        return <DsTypography variant="Regular_14">Auto-assign mount point</DsTypography>;
    };
    return (
        <div className={styles.Mount}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="3"
                title={<div className={CommonStyles.title}>{'Mount'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content here</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Mount;
