import { useEffect, useRef, useState } from 'react';
import { ReactComponent as SendButton } from '../../../../assets/send-button.svg';
import { ReactComponent as BedrockPoweredIcon } from '../../../../assets/bedrock-powered-icon.svg';
import Message from '../Message/Message';

import styles from './Chatbox.module.scss';
import ChatBotResponseLoader from '../ChatBotResponseLoader/ChatBotResponseLoader';
import { Typography } from '@netapp/design-system';

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
};

type ChatBoxPropTypes = {
    messages: messageType[];
    handleSelectButtonClicked: (paramObj: any) => void;
    sendMsg: (msg?: string, add?: boolean, msgs?: messageType[]) => void;
    isBotReplying: boolean;
    messagesToShow: any;
    activeField: any;
};

const ChatBox = ({
    messages,
    handleSelectButtonClicked,
    sendMsg,
    isBotReplying,
    messagesToShow,
    activeField
}: ChatBoxPropTypes) => {
    const [userInput, setUserInput] = useState('');
    const inputRef = useRef(null);

    const handleSendMsg = () => {
        if (userInput.trim()) {
            sendMsg(userInput);
            setUserInput('');
        }
    };

    useEffect(() => {
        if (!isBotReplying && inputRef && inputRef.current) {
            const refToFocus: any = inputRef.current;
            refToFocus.focus();
        }
    }, [isBotReplying]);

    return (
        <div className={styles['chat-container']}>
            <div className={styles['chat-window']} id="chat_id">
                {!messagesToShow.length && (
                    <div className={styles['bedrock-powered-container']}>
                        <BedrockPoweredIcon />
                        <Typography variant="Semibold_16">BedRock powered chat</Typography>
                    </div>
                )}
                {messagesToShow.map((msgObj: any, idx: number) => (
                    <Message
                        idx={idx}
                        msgObj={msgObj}
                        handleSelectButtonClicked={(paramObj: any) => handleSelectButtonClicked(paramObj)}
                        handleSendMsg={handleSendMsg}
                        messages={messages}
                        isBotReplying={isBotReplying}
                        activeField={activeField}
                    />
                ))}
                <ChatBotResponseLoader isBotReplying={isBotReplying} />
            </div>
            <div className={styles['current-msg-container']}>
                <div className={`${styles['current-msg']} ${isBotReplying ? styles['chat-disabled'] : ''}`}>
                    <input
                        value={userInput}
                        onChange={e => {
                            setUserInput(e.target.value);
                        }}
                        onKeyUp={e => {
                            if (e.key === 'Enter') {
                                handleSendMsg();
                            }
                        }}
                        disabled={isBotReplying}
                        className="current-msg-input"
                        ref={inputRef}
                        autoFocus
                    ></input>
                    <div onClick={() => handleSendMsg()}>
                        <SendButton />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatBox;
