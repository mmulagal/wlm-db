import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import styles from './SelectTarget.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';

const SelectTarget = () => {
    const setHeader = () => {
        return (
            <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                <div>{'Target host: host name'}</div>
                <div className={CommonStyles.separator} />
                <div>Target instance: instance name</div>
                <div className={CommonStyles.separator} />
                <div>Target database: database name</div>
            </DsTypography>
        );
    };
    return (
        <div className={styles.selectTarget}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="2"
                title={<div className={CommonStyles.title}>{'Select Target'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>Content here</DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SelectTarget;
