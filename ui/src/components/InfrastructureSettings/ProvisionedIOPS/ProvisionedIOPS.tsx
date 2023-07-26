import { AccordionCard, AccordionCardContent, RadioButton, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './ProvisionedIOPS.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useState } from 'react';

import AccordionError from '../../../common/AccordionError/AccordionError';

const ProvisionedIOPS = () => {
    const [input, setInput] = useState('');
    const [provisionValue, setProvisionValue] = useState(GENERAL.AUTOMATIC);
    //Set the Header text here
    const setHeader = () => {
        if (checkError()) {
            return <AccordionError />;
        }
        if (provisionValue === GENERAL.AUTOMATIC) {
            return <Typography variant="Regular_14">{GENERAL.AUTOMATIC}</Typography>;
        }
        return <Typography variant="Regular_14">{input}</Typography>;
    };

    const checkError = () => {
        if (provisionValue === GENERAL.USER_PROVISIONED && (Number(input) < 3072 || Number(input) > 160000)) {
            return 'range should be between 3072 - 160000 IOPS';
        }
    };
    return (
        <div className={styles.provisioned}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="17"
                title={<div className={CommonStyles.title}>{GENERAL.PROVISIONED_IOPS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleRadios}>
                            <RadioButton
                                isChecked={provisionValue === GENERAL.AUTOMATIC}
                                onChange={() => {
                                    setProvisionValue(GENERAL.AUTOMATIC);
                                }}
                                children={GENERAL.AUTOMATIC}
                                className=""
                            />
                            <RadioButton
                                isChecked={provisionValue === GENERAL.USER_PROVISIONED}
                                onChange={() => {
                                    setProvisionValue(GENERAL.USER_PROVISIONED);
                                }}
                                children={GENERAL.USER_PROVISIONED}
                                className=""
                            />
                        </div>

                        {provisionValue === GENERAL.AUTOMATIC && (
                            <div className={styles.automatic}>{GENERAL.AUTOMATIC_IOPS}</div>
                        )}
                        {provisionValue === GENERAL.USER_PROVISIONED && (
                            <div className={styles.user}>
                                <TextField
                                    placeholder={GENERAL.PLACEHOLDER_PROVISIONED}
                                    label={GENERAL.IOPS_VALUE}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setInput(e.target.value);
                                    }}
                                    value={input}
                                    className={styles.textfield}
                                    //@ts-ignore
                                    type="number"
                                    error={checkError()}
                                />
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ProvisionedIOPS;
