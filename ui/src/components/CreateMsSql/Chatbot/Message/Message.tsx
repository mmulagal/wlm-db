import InputComponent from './InputComponent/InputComponent';
import SelectComponent from './SelectComponent/SelectComponent';
import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import { ReactComponent as UserIcon } from '../../../../assets/user-icon.svg';
import Confirmation from './ConfirmationComponent/Confirmation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Typography } from '@netapp/design-system';

import styles from './Message.module.scss';
import TagsComponent from './TagsComponent/TagsComponent';
import { GENERAL } from '../../../../utils/appConstants';
import { openCredentialTab } from '../../../../utils/utilityFunctions';
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
    errors?: any;
    confirmData?: any;
    default?: string;
    disable?: boolean;
    link?: any;
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
    const key = 'errors';
    const isUserInputRequired = msgObj[key];
    const fieldsArr = msgObj[key] || [];
    const [paramObj, setParamObj] = useState({});
    const [errorFields, setErrorFields] = useState<string[]>([]);
    const isLastMessage = idx === messages.length - 1;
    const dispatch = useDispatch();

    //@ts-ignore
    const isContinueDisabled = useMemo(() => {
        return Object.keys(paramObj).length !== fieldsArr.length || errorFields.length > 0;
    }, [paramObj, fieldsArr, errorFields]);

    const item = fieldsArr[0];

    useEffect(() => {
        if (fieldsArr?.length) {
            if (fieldsArr[0]?.type === 'text') {
                dispatch(setExpectingResponse({ type: 'text', fieldName: fieldsArr[0].key }));
            } else if (fieldsArr[0]?.type === 'password') {
                dispatch(setExpectingResponse({ type: 'password', fieldName: fieldsArr[0].key }));
            } else if (fieldsArr[0]?.type === 'number') {
                dispatch(setExpectingResponse({ type: 'number', fieldName: fieldsArr[0].key }));
            } else {
                dispatch(setExpectingResponse({ type: 'none', fieldname: '' }));
            }
        }
    }, [fieldsArr]);

    const ValidationCriteria = () => {
        const selectKey = fieldsArr[0]?.key;
        if (selectKey === 'fsxUsername') {
            return (
                <Typography variant="Regular_13" className={styles.infoMsg}>
                    <div className={styles.bulletContainer}>
                        <Bullet />
                        <Typography className={styles.infoMsg} variant="Regular_13">
                            {GENERAL.USERNAME_TOOLTIP3}
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
                            <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP3}</div>
                        </div>
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
                        {msgObj.sender === 'bot' ? <ChatBotIcon /> : <UserIcon id="chatbot-user-icon"/>}
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
                                            />
                                        </div>
                                    ) : (
                                        <Typography
                                            variant="Regular_14"
                                            className={`${styles['message-text']} ${
                                                msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                                            }`}
                                        >
                                            {`${fieldsArr[0].message}`}
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
                                {`${fieldsArr[0].message}`}
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
                            {`${msgObj.msg}`}
                            <ValidationCriteria />
                        </Typography>
                    )}
                </div>
            )}
        </>
    );
};

export default Message;
