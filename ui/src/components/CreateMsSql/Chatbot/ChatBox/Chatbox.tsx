import { useState } from 'react';
import { ReactComponent as SendButton } from '../../../../assets/send-button.svg';
import Message from '../Message/Message';

import styles from './Chatbox.module.scss';
import ChatBotResponseLoader from '../ChatBotResponseLoader/ChatBotResponseLoader';

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
};

const ChatBox = ({ messages, handleSelectButtonClicked, sendMsg, isBotReplying, messagesToShow }: ChatBoxPropTypes) => {
    const [userInput, setUserInput] = useState('');
    const el = document.querySelector('.current-msg-input');
    const isCurrentMsgActive = el === document.activeElement;

    const handleSendMsg = () => {
        if (userInput.trim()) {
            sendMsg(userInput);
            setUserInput('');
        }
    };
    return (
        <div className={styles['chat-container']}>
            <div className={styles['chat-window']} id="chat_id">
                {messagesToShow.map((msgObj: any, idx: number) => (
                    <Message
                        idx={idx}
                        msgObj={msgObj}
                        handleSelectButtonClicked={(paramObj: any) => handleSelectButtonClicked(paramObj)}
                        handleSendMsg={handleSendMsg}
                        messages={messages}
                    />
                ))}
                <ChatBotResponseLoader isBotReplying={isBotReplying} />
            </div>
            <div className={styles['current-msg-container']}>
                <div
                    className={`${styles['current-msg']} ${isBotReplying ? styles['chat-disabled'] : ''} ${
                        isCurrentMsgActive ? styles['current-msg-active'] : ''
                    }`}
                >
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
