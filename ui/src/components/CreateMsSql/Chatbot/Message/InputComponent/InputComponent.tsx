import { TextField, PasswordField, Typography } from '@netapp/design-system';
import styles from './InputComponent.module.scss';
import { useState } from 'react';
import { validateChatbotField } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';

type inputComponentPropType = {
    fieldType: string;
    onChange: (key: string, val: string | number) => void;
    heading: string;
    selectKey: string;
};

const InputComponent = ({ heading, selectKey, fieldType, onChange }: inputComponentPropType) => {
    const [value, setValue] = useState('');

    const tooltipText = () => {
        if (selectKey === 'fsxPassword') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_1}</Typography>
                    </div>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_2}</Typography>
                    </div>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_3}</Typography>
                    </div>
                </Typography>
            );
        }
        if (selectKey === 'serviceAccountName') {
            return (
                <div className={styles.userNameTooltip}>
                    <div className={styles.list}>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP1}</div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP2}</div>
                        </div>
                    </div>
                </div>
            );
        }
        if (selectKey === 'serviceAccountPassword') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <Typography variant="Regular_13">{GENERAL.PASSWORD_CRED_1}</Typography>
                    <div className={styles.list}>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_1}</div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_2}</div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_3}</div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_4}</div>
                        </div>
                    </div>
                    <Typography variant="Regular_13" className={styles.lastItem}>
                        {GENERAL.PASSWORD_CRED_4}
                    </Typography>
                </Typography>
            );
        }
        return null;
    };

    return (
        <div className={styles['select-component']}>
            {fieldType === 'password' ? (
                <PasswordField
                    label={heading}
                    error={validateChatbotField(selectKey, value)}
                    //@ts-ignore
                    isErrorPrefixHidden
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange(selectKey, e.target.value);
                        setValue(e.target.value);
                    }}
                    info={tooltipText()}
                    value={value}
                    className={styles.fieldComponent}
                />
            ) : (
                <TextField
                    label={heading}
                    error={validateChatbotField(selectKey, value)}
                    //@ts-ignore
                    isErrorPrefixHidden
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange(selectKey, e.target.value);
                        setValue(e.target.value);
                    }}
                    info={tooltipText()}
                    value={value}
                    className={styles.fieldComponent}
                />
            )}
            {/* <div className="select-component-heading">{heading}</div>
            <div className="select-list-container">
                <input
                    className="input-component-box"
                    onChange={e => {
                        onChange(selectKey, e.target.value);
                        setValue(e.target.value);
                    }}
                    value={value}
                    // onKeyUp={(e) => {
                    //   if (e.key === "Enter") {
                    //     onSelect(selectKey, value, value);
                    //   }
                    // }}
                    type={fieldType}
                />
            </div> */}
        </div>
    );
};

export default InputComponent;
