import { useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../utils/appConstants';
import styles from './ActiveDirectory.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const ActiveDirectory = () => {
    const [domainName, setDomainName] = useState('');
    const [dnsAddress, setDNSAddress] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    //Set the Header text here
    const setHeader = () => {
        if (!domainName || !dnsAddress || !userName || !password) {
            return <ActionRequired />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <div>{domainName}</div>
                    <div className={CommonStyles.separator} />
                    <div>{dnsAddress}</div>
                    <div className={CommonStyles.separator} />
                    <div>{userName}</div>
                </Typography>
            );
        }
    };
    return (
        <div className={styles.active}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="13"
                title={<div className={CommonStyles.title}>{GENERAL.ACTIVE_DIRECTORY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14">{GENERAL.AD_TEXT}</Typography>
                        <div className={styles.firstContainer}>
                            <TextField
                                label={GENERAL.DOMAIN_NAME}
                                placeholder="example.com"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDomainName(e.target.value);
                                }}
                                value={domainName}
                                className={styles.textField}
                            />
                            <TextField
                                label={GENERAL.DNS_ADDRESS}
                                placeholder="example.com"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDNSAddress(e.target.value);
                                }}
                                value={dnsAddress}
                                className={styles.textField}
                            />
                        </div>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUserName(e.target.value);
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <TextField
                                label={GENERAL.PASSWORD}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                }}
                                value={password}
                                className={styles.textField}
                                //@ts-ignore
                                type="password"
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ActiveDirectory;
