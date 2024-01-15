import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactComponent as SendButton } from '../../../../assets/send-button.svg';
import Message from '../Message/Message';

import styles from './Chatbox.module.scss';
import ChatBotResponseLoader from '../ChatBotResponseLoader/ChatBotResponseLoader';
import WelcomePage from '../WelcomePage/WelcomePage';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setMessages, setSuggestionBubbles } from '../../../../store/chatbot/chatbotSlice';
import Bubbles from '../Bubbles/Bubbles';
import { CHATBOT_SUGGESTION_BUBBLES } from '../../../../utils/consts';

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
    setContext: () => void;
};

const ChatBox = ({
    messages,
    handleSelectButtonClicked,
    sendMsg,
    isBotReplying,
    messagesToShow,
    activeField,
    setContext
}: ChatBoxPropTypes) => {
    const { isWizardTouched, currentIntent, suggestionBubbles } = useAppSelector(state => state.chatbot);
    const [userInput, setUserInput] = useState('');
    const inputRef = useRef(null);

    const dispatch = useDispatch();

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

    useEffect(() => {
        if ((currentIntent?.type || isWizardTouched) && !messagesToShow.length) {
            dispatch(
                setSuggestionBubbles({
                    list: CHATBOT_SUGGESTION_BUBBLES,
                    onBubbleClick: (label: string, value: string) => {
                        if (value === 'resume') {
                            setContext();
                        }
                        if (value === 'start') {
                            sendMsg('Deploy Mssql', false);
                        }
                        dispatch(setMessages([{ sender: 'user', msg: label }]));
                        dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                    }
                })
            );
        }
    }, []);

    return (
        <div className={styles['chat-container']}>
            <div className={styles['chat-window-container']}>
                <div className={styles['chat-window']} id="chat_id">
                    {!messagesToShow.length && !isWizardTouched && <WelcomePage handleSendMsg={sendMsg} />}
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
                    {suggestionBubbles.list.length ? (
                        <div className={styles['bubble-container']}>
                            <Bubbles
                                bubbleList={suggestionBubbles.list}
                                onBubbleClick={suggestionBubbles.onBubbleClick}
                            />
                        </div>
                    ) : (
                        ''
                    )}
                </div>
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
