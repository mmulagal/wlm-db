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
    handleSelectButtonClicked: (paramObj: any) => void;
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
                        {msgObj.sender === 'bot' ? <ChatBotIcon /> : <UserIcon />}
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
                        </Typography>
                    )}
                </div>
            )}
        </>
    );
};

export default Message;
