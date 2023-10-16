import InputComponent from './InputComponent/InputComponent';
import SelectComponent from './SelectComponent/SelectComponent';
import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import { ReactComponent as UserIcon } from '../../../../assets/user-icon.svg';
import Confirmation from './ConfirmationComponent/Confirmation';
import { useState } from 'react';

import styles from './Message.module.scss';

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
};

type MessagePropType = {
    idx: number;
    msgObj: messageType;
    handleSelectButtonClicked: (paramObj: any) => void;
    handleSendMsg: () => void;
    messages: messageType[];
};

const Message = ({ idx, msgObj, handleSelectButtonClicked, handleSendMsg, messages }: MessagePropType) => {
    const key = 'errors';
    const isUserInputRequired = msgObj[key];
    const fieldsArr = msgObj[key] || [];
    const [paramObj, setParamObj] = useState({});

    return (
        <div className={styles['message-item']} key={`msg-${idx}`}>
            <div
                className={`${styles['message-icon']} ${
                    msgObj.sender === 'bot' ? styles['bot-icon'] : styles['user-icon']
                }`}
            >
                {msgObj.sender === 'bot' ? <ChatBotIcon /> : <UserIcon />}
            </div>
            {isUserInputRequired ? (
                <div className={styles['msg-group-container']}>
                    {fieldsArr.map((item: any, idx: number) => {
                        return (
                            <>
                                {msgObj.active && item.allowedValues && item.allowedValues.length ? (
                                    <div className={styles['select-container']}>
                                        <SelectComponent
                                            options={item.allowedValues}
                                            onChange={(key: string, val: string | number, label: string) => {
                                                setParamObj({
                                                    ...paramObj,
                                                    [key]: { label: label, value: val }
                                                });
                                            }}
                                            heading={item.message}
                                            selectKey={item.key}
                                        />
                                    </div>
                                ) : (
                                    msgObj.active &&
                                    (item.type === 'text' || item.type === 'password') && (
                                        <div className={styles['select-container']}>
                                            <InputComponent
                                                heading={item.message}
                                                onChange={(key: string, val: string | number) => {
                                                    setParamObj({
                                                        ...paramObj,
                                                        [key]: { label: val, value: val }
                                                    });
                                                }}
                                                selectKey={item.key}
                                                fieldType={item.type}
                                            />
                                        </div>
                                    )
                                )}
                                {idx < fieldsArr.length - 1 && <div className="seperator"></div>}
                            </>
                        );
                    })}
                    <div className={styles['buttons-container']}>
                        {/* <button className="discard-button">Discard</button> */}
                        <button
                            className={styles['select-chosen-button']}
                            onClick={() => handleSelectButtonClicked(paramObj)}
                            disabled={Object.keys(paramObj).length !== fieldsArr.length}
                        >
                            Continue
                        </button>
                    </div>
                </div>
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
                <div
                    className={`${styles['message-text']} ${
                        msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                    }`}
                >
                    {`${msgObj.msg}`}
                </div>
            )}
        </div>
    );
};

export default Message;
