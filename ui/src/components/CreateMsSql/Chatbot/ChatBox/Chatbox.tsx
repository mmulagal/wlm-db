import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactComponent as SendButton } from '../../../../assets/send-button.svg';
import Message from '../Message/Message';

import styles from './Chatbox.module.scss';
import ChatBotResponseLoader from '../ChatBotResponseLoader/ChatBotResponseLoader';
import WelcomePage from '../WelcomePage/WelcomePage';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setIsWizardTouched, setMessages, setSuggestionBubbles } from '../../../../store/chatbot/chatbotSlice';
import Bubbles from '../Bubbles/Bubbles';
import {
    ADV_CREATE_SUGGESTION_BUBBLES,
    CHATBOT_SUGGESTION_BUBBLES,
    CHATBOT_WELCOME_CARDS
} from '../../../../utils/consts';
import { getChatbotParamsFromPayload, validateChatbotField } from '../../../../utils/utilityFunctions';
import { CHATBOT } from '../../../../utils/appConstants';

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
};

type ChatBoxPropTypes = {
    messages: messageType[];
    handleSelectButtonClicked: (paramObj: any, sender?: string) => void;
    sendMsg: (msg?: string, add?: boolean, msgs?: messageType[]) => void;
    isBotReplying: boolean;
    messagesToShow: any;
    activeField: any;
    setContext: () => void;
    mapParamsToPayload: (params: any) => void;
};

const ChatBox = ({
    messages,
    handleSelectButtonClicked,
    sendMsg,
    isBotReplying,
    messagesToShow,
    activeField,
    setContext,
    mapParamsToPayload
}: ChatBoxPropTypes) => {
    const {
        isWizardTouched,
        currentIntent,
        suggestionBubbles,
        expectingResponse,
        messages: stateMsgs
    } = useAppSelector(state => state.chatbot);
    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const [userInput, setUserInput] = useState('');
    const inputRef = useRef(null);
    const messagesEnd: any = useRef(null);

    const dispatch = useDispatch();

    const handleSendMsg = () => {
        const trimmedInput = userInput.trim();
        dispatch(
            setSuggestionBubbles({
                list: [],
                onBubbleClick: () => {}
            })
        );
        if (trimmedInput) {
            if (expectingResponse.type !== 'none') {
                const isDoubleQuotesCheckReq =
                    expectingResponse.fieldName === 'domainUsername' ||
                    expectingResponse.fieldName === 'fsxUsername' ||
                    expectingResponse.fieldName === 'serviceAccountName';
                const isResponse =
                    (trimmedInput.length > 2 &&
                        isDoubleQuotesCheckReq &&
                        trimmedInput[0] === '"' &&
                        trimmedInput[trimmedInput.length - 1] === '"') ||
                    !isDoubleQuotesCheckReq;
                const valueToShow = expectingResponse.type === 'password' ? 'Password Entered' : trimmedInput;
                const validationError = validateChatbotField(expectingResponse.fieldName, trimmedInput);
                if (isResponse && validationError) {
                    dispatch(
                        setMessages([
                            ...stateMsgs,
                            { sender: 'user', msg: valueToShow },
                            { sender: 'bot', msg: validationError }
                        ])
                    );
                } else {
                    if (isResponse) {
                        handleSelectButtonClicked({
                            [expectingResponse.fieldName]: {
                                label: valueToShow,
                                value: userInput.trim().replace(/^"(.+(?="$))"$/, '$1')
                            }
                        });
                    } else {
                        sendMsg(userInput);
                    }
                }
            } else {
                sendMsg(userInput);
            }
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
        messagesEnd?.current?.scrollIntoView({ behaviour: 'smooth' });
    });

    useEffect(() => {
        if (expectingResponse?.default) {
            setUserInput(`"${expectingResponse.default}"`);
        } else {
            setUserInput('');
        }
    }, [expectingResponse]);

    useEffect(() => {
        if (currentIntent?.type || isWizardTouched) {
            const comingFromAdvCreate = mssqlFormData.selectConfig === 'Standard create';
            dispatch(
                setMessages([
                    {
                        sender: 'bot',
                        msg: comingFromAdvCreate
                            ? CHATBOT.WELCOME_PAGE.ADVANCED_CREATE_MSG
                            : CHATBOT.WELCOME_PAGE.RESUME_DEPLOYMENT_MSG
                    }
                ])
            );
            dispatch(
                setSuggestionBubbles({
                    list: comingFromAdvCreate ? ADV_CREATE_SUGGESTION_BUBBLES : CHATBOT_SUGGESTION_BUBBLES,
                    onBubbleClick: (label: string, value: string) => {
                        if (value === 'resume') {
                            setContext();
                            dispatch(setMessages([{ sender: 'user', msg: label }]));
                            dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                        }
                        if (value === 'start') {
                            let defaultParams = getChatbotParamsFromPayload(mssqlFormData);
                            let defaultObj: any = {};
                            Object.keys(defaultParams).map((key: string) => {
                                defaultObj[key] = null;
                            });
                            mapParamsToPayload(defaultObj);
                            sendMsg('Deploy Mssql', false);
                            dispatch(setMessages([{ sender: 'user', msg: label }]));
                            dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                        }
                        if (value === 'explore') {
                            dispatch(
                                setMessages([
                                    {
                                        sender: 'bot',
                                        msg: comingFromAdvCreate
                                            ? CHATBOT.WELCOME_PAGE.ADVANCED_CREATE_MSG
                                            : CHATBOT.WELCOME_PAGE.RESUME_DEPLOYMENT_MSG
                                    },
                                    { sender: 'user', msg: label },
                                    { sender: 'bot', msg: CHATBOT.WELCOME_PAGE.WELCOME_MSG }
                                ])
                            );
                            dispatch(
                                setSuggestionBubbles({
                                    list: CHATBOT_WELCOME_CARDS.map(item => {
                                        return { label: item.label, value: item.value || item.label };
                                    }),
                                    onBubbleClick: (label?: string, value?: string) => {
                                        sendMsg(label);
                                        dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                                    }
                                })
                            );
                        }
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
                            handleSelectButtonClicked={(paramObj: any, sender?: string) =>
                                handleSelectButtonClicked(paramObj, sender)
                            }
                            handleSendMsg={handleSendMsg}
                            messages={messages}
                            isBotReplying={isBotReplying}
                            activeField={activeField}
                        />
                    ))}
                    {!(!messagesToShow.length && !isWizardTouched) && (
                        <ChatBotResponseLoader isBotReplying={isBotReplying} />
                    )}
                    {!isBotReplying && suggestionBubbles.list.length ? (
                        <div className={styles['bubble-container']}>
                            <Bubbles
                                bubbleList={suggestionBubbles.list}
                                onBubbleClick={suggestionBubbles.onBubbleClick}
                            />
                        </div>
                    ) : (
                        ''
                    )}
                    <div style={{ float: 'left', clear: 'both' }} ref={messagesEnd}></div>
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
                        type={expectingResponse.type === 'none' ? 'text' : expectingResponse.type}
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
