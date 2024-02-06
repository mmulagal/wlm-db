import SelectComponent from './SelectComponent/SelectComponent';
import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import { ReactComponent as UserIcon } from '../../../../assets/user-icon.svg';
import Confirmation from './ConfirmationComponent/Confirmation';
import { useEffect, useState } from 'react';
import { Button, Typography } from '@netapp/design-system';

import styles from './Message.module.scss';
import TagsComponent from './TagsComponent/TagsComponent';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { setExpectingResponse } from '../../../../store/chatbot/chatbotSlice';
import CardComponent from './CardComponent/CardComponent';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

type optionsType = {
    value?: string | number;
    label?: string;
};

type messageType = {
    sender?: string;
    msg?: string;
    key?: string;
    list?: optionsType[];
    intent?: any;
    type?: string;
    active?: boolean;
    error?: any;
    confirmData?: any;
    default?: string;
    disable?: boolean;
    link?: any;
    customComponent?: any;
};

type MessagePropType = {
    idx: number;
    msgObj: messageType;
    handleSelectButtonClicked: (paramObj: any, sender?: string) => void;
    handleSendMsg: () => void;
    messages: messageType[];
    isBotReplying: boolean;
    activeField: any;
};

const Message = ({ idx, msgObj, handleSelectButtonClicked, messages, isBotReplying, activeField }: MessagePropType) => {
    const key = 'error';
    const isUserInputRequired = msgObj[key];
    const fieldObj = msgObj[key] || {};
    const [paramObj, setParamObj] = useState({});
    const [errorFields, setErrorFields] = useState<string[]>([]);
    const isLastMessage = idx === messages.length - 1;
    const dispatch = useDispatch();

    //@ts-ignore
    const item = fieldObj;

    useEffect(() => {
        if (Object.keys(fieldObj)?.length) {
            if (fieldObj?.type === 'text') {
                dispatch(setExpectingResponse({ type: 'text', fieldName: fieldObj.key }));
            } else if (fieldObj?.type === 'password') {
                dispatch(setExpectingResponse({ type: 'password', fieldName: fieldObj.key }));
            } else if (fieldObj?.type === 'number') {
                dispatch(setExpectingResponse({ type: 'number', fieldName: fieldObj.key }));
            } else {
                dispatch(setExpectingResponse({ type: 'none', fieldname: '' }));
            }
        }
    }, [fieldObj]);

    const ValidationCriteria = () => {
        const selectKey = fieldObj?.key;
        if (selectKey === 'fsxUsername') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.USERNAME_TOOLTIP3}
                            <span className={styles.highlightText}>{GENERAL.USERNAME_EXAMPLE}</span>
                        </Typography>
                    </div>
                </Typography>
            );
        }
        if (selectKey === 'fsxPassword') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.PASSWORD_FSX_1}
                        </Typography>
                    </div>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.PASSWORD_FSX_2}
                        </Typography>
                    </div>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.PASSWORD_FSX_3}
                        </Typography>
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
                            <div className={styles.textWidth}>
                                {GENERAL.USERNAME_TOOLTIP3}
                                <span className={styles.highlightText}>{GENERAL.USERNAME_EXAMPLE}</span>
                            </div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP1}</div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP4}</div>
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
                    <div className={styles.list}>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>
                                <Typography className={styles.infoMsg} variant="Regular_14">
                                    {GENERAL.PASSWORD_CRED_1}
                                </Typography>
                            </div>
                        </div>
                        <div className={styles.subList}>
                            <div className={styles.bulletContainer}>
                                <Bullet />
                                <div className={styles.textWidth}>
                                    <Typography className={styles.infoMsg} variant="Regular_14">
                                        {GENERAL.PASSWORD_CRED_LI_1}
                                    </Typography>
                                </div>
                            </div>
                            <div className={styles.bulletContainer}>
                                <Bullet />
                                <div className={styles.textWidth}>
                                    <Typography className={styles.infoMsg} variant="Regular_14">
                                        {GENERAL.PASSWORD_CRED_LI_2}
                                    </Typography>
                                </div>
                            </div>
                            <div className={styles.bulletContainer}>
                                <Bullet />
                                <div className={styles.textWidth}>
                                    <Typography className={styles.infoMsg} variant="Regular_14">
                                        {GENERAL.PASSWORD_CRED_LI_3}
                                    </Typography>
                                </div>
                            </div>
                            <div className={styles.bulletContainer}>
                                <Bullet />
                                <div className={styles.textWidth}>
                                    <Typography className={styles.infoMsg} variant="Regular_14">
                                        {GENERAL.PASSWORD_CRED_LI_4}
                                    </Typography>
                                </div>
                            </div>
                        </div>
                        <div className={styles.bulletContainer}>
                            <Bullet />
                            <div className={styles.textWidth}>
                                <Typography className={styles.infoMsg} variant="Regular_14">
                                    {GENERAL.PASSWORD_CRED_4}
                                </Typography>
                            </div>
                        </div>
                    </div>
                </Typography>
            );
        }
        if (selectKey === 'domainUsername') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.USERNAME_TOOLTIP3}
                            <span className={styles.highlightText}>{GENERAL.USERNAME_EXAMPLE}</span>
                        </Typography>
                    </div>
                </Typography>
            );
        }
        if (selectKey === 'domainPassword') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.PASSWORD_MIN_LENGTH_8}
                        </Typography>
                    </div>
                </Typography>
            );
        }
        return null;
    };

    return (
        <>
            {(!isLastMessage || !isUserInputRequired || !isBotReplying) && (
                <div
                    className={`${styles['message-item']} ${msgObj.sender === 'user' ? styles['user-msg'] : ''}`}
                    key={`msg-${idx}`}
                >
                    <div
                        className={`${styles['message-icon']} ${
                            msgObj.sender === 'bot' ? styles['bot-icon'] : styles['user-icon']
                        }`}
                    >
                        {msgObj.sender === 'bot' ? <ChatBotIcon /> : <UserIcon id="chatbot-user-icon" />}
                    </div>
                    {isUserInputRequired ? (
                        msgObj.active ? (
                            <div className={styles['msg-group-container']}>
                                <>
                                    {msgObj.active && item.allowedValues && item.type !== 'card' ? (
                                        <div className={styles['select-container']}>
                                            <SelectComponent
                                                options={
                                                    item.key === 'region'
                                                        ? item.allowedValues.map((item: any) => {
                                                              return {
                                                                  ...item,
                                                                  label: `${item.value} | ${item.label}`
                                                              };
                                                          })
                                                        : item.allowedValues
                                                }
                                                onChange={(key: string, val: string | number, label: string) => {
                                                    setParamObj({
                                                        ...paramObj,
                                                        [key]: { label: label, value: val }
                                                    });
                                                }}
                                                heading={item.message}
                                                selectKey={item.key}
                                                paramObj={paramObj}
                                                allowCreate={item.allowCreate}
                                                activeField={activeField}
                                                handleSelectButtonClicked={handleSelectButtonClicked}
                                                link={item.link}
                                                label={item.label}
                                            />
                                        </div>
                                    ) : (
                                        <Typography
                                            variant="Regular_14"
                                            className={`${styles['message-text']} ${
                                                msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                                            }`}
                                        >
                                            {`${fieldObj.message}`}
                                            <ValidationCriteria />
                                        </Typography>
                                    )}
                                    {msgObj.active && item.type === 'tags' && (
                                        <TagsComponent
                                            onChange={(key: string, val: string) => {
                                                setParamObj({
                                                    ...paramObj,
                                                    [key]: { label: val, value: val }
                                                });
                                            }}
                                        />
                                    )}
                                    {msgObj.active && item.type === 'card' && (
                                        <CardComponent
                                            cardList={item.allowedValues}
                                            handleSelectButtonClicked={handleSelectButtonClicked}
                                            selectKey={item.key}
                                        />
                                    )}
                                </>
                            </div>
                        ) : (
                            <Typography
                                variant="Regular_14"
                                className={`${styles['message-text']} ${
                                    msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                                }`}
                            >
                                {`${fieldObj.message}`}
                                <ValidationCriteria />
                            </Typography>
                        )
                    ) : msgObj.active && msgObj.type === 'confirm' ? (
                        <div className={styles['select-container']}>
                            <Confirmation
                                confirmText={msgObj.confirmData.confirmMsg}
                                confirmButtonText={msgObj.confirmData.confirmBtnTxt}
                                cancelButtonText={msgObj.confirmData.cancelBtnTxt}
                                onConfirm={() => msgObj.confirmData.onConfirm(messages)}
                                onCancel={msgObj.confirmData.onCancel}
                            />
                        </div>
                    ) : (
                        <Typography
                            variant="Regular_14"
                            className={`${styles['message-text']} ${
                                msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                            }`}
                        >
                            <div className={styles.textDiv}>
                                {`${msgObj.msg}`}
                                {msgObj?.link && (
                                    <Button
                                        Component="button"
                                        variant="text"
                                        onClick={() => msgObj?.link?.onLinkClick()}
                                    >
                                        {msgObj?.link?.linkText}
                                    </Button>
                                )}
                                {msgObj?.customComponent}
                            </div>
                            <ValidationCriteria />
                        </Typography>
                    )}
                </div>
            )}
        </>
    );
};

export default Message;
