import { useState } from 'react';
import { AccordionCard, AccordionCardContent, ToggleSelector, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './CloudWatch.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const CloudWatch = () => {
    const [toggle, setToggle] = useState(false);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{toggle ? 'Enabled' : 'Disabled'}</Typography>;
    };

    const handleChange = () => {
        setToggle(prev => !prev);
    };

    return (
        <div className={styles.cloud}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="22"
                title={<div className={CommonStyles.title}>{GENERAL.CLOUD_WATCH_MONITORING}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <ToggleSelector value={toggle} className="" onChange={handleChange} isDisabled={false}>
                            {GENERAL.CLOUD_WATCH_MONITORING}
                        </ToggleSelector>
                        <Typography variant="Regular_14" className={styles.subText}>
                            {GENERAL.CLOUD_WATCH_TEXT}
                        </Typography>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default CloudWatch;
