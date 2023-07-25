import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './OperatingSystem.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useState } from 'react';

const OperatingSystem = () => {
    const [operatingSystem, setOperatingSystem] = useState(GENERAL.WIN_SERVER_2016);
    //Set the Header text here
    const setHeader = () => {
        return operatingSystem;
    };
    return (
        <div className={styles['operating-system']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="5"
                title={<div className={CommonStyles.title}>{GENERAL.OPERATING_SYSTEM}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.text}>{GENERAL.OP_SYS_TEXT}</div>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={operatingSystem === GENERAL.WIN_SERVER_2016}
                                onChange={() => {
                                    setOperatingSystem(GENERAL.WIN_SERVER_2016);
                                }}
                                children={GENERAL.WIN_SERVER_2016}
                                className=""
                            />
                            <RadioButton
                                isChecked={operatingSystem === GENERAL.WIN_SERVER_2019}
                                onChange={() => {
                                    setOperatingSystem(GENERAL.WIN_SERVER_2019);
                                }}
                                children={GENERAL.WIN_SERVER_2019}
                                className=""
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default OperatingSystem;
