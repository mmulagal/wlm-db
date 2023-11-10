import InputComponent from './InputComponent/InputComponent';
import SelectComponent from './SelectComponent/SelectComponent';
import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import { ReactComponent as UserIcon } from '../../../../assets/user-icon.svg';
import Confirmation from './ConfirmationComponent/Confirmation';
import { useMemo, useState } from 'react';
import { Button } from '@netapp/design-system';

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
    isBotReplying: boolean;
};

const Message = ({
    idx,
    msgObj,
    handleSelectButtonClicked,
    handleSendMsg,
    messages,
    isBotReplying
}: MessagePropType) => {
    const key = 'errors';
    const isUserInputRequired = msgObj[key];
    const fieldsArr = msgObj[key] || [];
    const [paramObj, setParamObj] = useState({});
    const [errorFields, setErrorFields] = useState<string[]>([]);
    const isLastMessage = idx === messages.length - 1;

    //@ts-ignore
    const isContinueDisabled = useMemo(() => {
        return Object.keys(paramObj).length !== fieldsArr.length || errorFields.length > 0;
    }, [paramObj, fieldsArr, errorFields]);

    return (
        <>
            {(!isLastMessage || !isUserInputRequired || !isBotReplying) && (
                <div className={styles['message-item']} key={`msg-${idx}`}>
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
                                {fieldsArr.map((item: any, idx: number) => {
                                    return (
                                        <>
                                            {msgObj.active && item.allowedValues ? (
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
                                                        onChange={(
                                                            key: string,
                                                            val: string | number,
                                                            label: string
                                                        ) => {
                                                            setParamObj({
                                                                ...paramObj,
                                                                [key]: { label: label, value: val }
                                                            });
                                                        }}
                                                        heading={item.message}
                                                        selectKey={item.key}
                                                        paramObj={paramObj}
                                                        allowCreate={item.allowCreate}
                                                    />
                                                </div>
                                            ) : (
                                                msgObj.active &&
                                                (item.type === 'text' ||
                                                    item.type === 'password' ||
                                                    item.type === 'number') && (
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
                                                            errorFields={errorFields}
                                                            setErrorFields={setErrorFields}
                                                        />
                                                    </div>
                                                )
                                            )}
                                        </>
                                    );
                                })}
                                <div className={styles['buttons-container']}>
                                    {/* <button className="discard-button">Discard</button> */}
                                    <Button
                                        className={styles['select-chosen-button']}
                                        onClick={() => {
                                            if (!isContinueDisabled) {
                                                handleSelectButtonClicked(paramObj);
                                            }
                                        }}
                                        disabled={isContinueDisabled}
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`${styles['message-text']} ${
                                    msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                                }`}
                            >
                                {`${fieldsArr[0].message}`}
                            </div>
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
                        <div
                            className={`${styles['message-text']} ${
                                msgObj.sender === 'bot' ? styles['bot-text'] : styles['user-text']
                            }`}
                        >
                            {`${msgObj.msg}`}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default Message;
