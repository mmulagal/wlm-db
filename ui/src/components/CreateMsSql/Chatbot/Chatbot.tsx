import { useState, useEffect, useMemo } from 'react';
import { getWlmdbPayload, wrapContext } from '../../../utils/utilityFunctions';

import styles from './Chatbot.module.scss';
import ChatBox from './ChatBox/Chatbox';
import { setPanelData, setPanelType, setShowPreviewPanel } from '../../../store/previewPanel/previewPanelSlice';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useSendMsgMutation } from '../../../utils/apiService';
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

const Chatbot = () => {
    const [messages, setMessages] = useState<messageType[] | null>([{ sender: 'bot', msg: 'Hi! How can I help you?' }]);
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [currentIntent, setCurrentIntent] = useState<any>('');
    const [isPayloadReady, setIsPayloadReady] = useState(false);
    const [payloadContent, setPayloadContent] = useState<any>('');
    const dispatch = useAppDispatch();

    const [sendMsgToBot] = useSendMsgMutation();

    const selectedCredId = useAppSelector(state => state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId);

    const sendMsg = async (msg?: string, add: boolean = true, msgs = messages) => {
        setIsBotReplying(true);
        let updatedMessages = msgs ? [...msgs] : [];
        if (add) {
            setMessages([...(msgs || []), { sender: 'user', msg: msg }]);
            updatedMessages = [...updatedMessages, { sender: 'user', msg: msg }];
        }

        sendMsgToBot({
            payload: {
                prompt:
                    (currentIntent?.type
                        ? wrapContext(
                              `${currentIntent.type} with params ${JSON.stringify({
                                  ...currentIntent.params
                              })}`
                          ) + 'Sure!'
                        : '') + wrapContext(msg),
                ...(currentIntent && {
                    intent: currentIntent?.type,
                    params: currentIntent.params
                })
            }
        })
            .then((res: any) => {
                if (res.data) {
                    const { message, key, allowedValues, intent, type, errors } = res.data;
                    if (intent) {
                        setCurrentIntent(intent);
                        if (!intent.complete) {
                            setPayloadContent(getWlmdbPayload(intent.params));
                        } else {
                            setPayloadContent(intent.validatedJson);
                        }
                        setIsPayloadReady(intent.complete);
                    }

                    updatedMessages = [
                        ...updatedMessages,
                        {
                            sender: 'bot',
                            msg: message,
                            key: key,
                            list: allowedValues,
                            intent: intent,
                            type: type,
                            active: true,
                            errors: errors
                        }
                    ];

                    if (currentIntent && !intent) {
                        updatedMessages[updatedMessages.length - 3].active = false;
                    }

                    setMessages(updatedMessages);
                    setIsBotReplying(false);
                }
            })
            .catch((error: any) => {
                setIsBotReplying(false);
                console.log('Error while fetching data - ', error);
            });
    };

    useEffect(() => {
        dispatch(setShowPreviewPanel(true));
        dispatch(setPanelType('chatbot'));
        return () => {
            dispatch(setShowPreviewPanel(false));
            dispatch(setPanelType(''));
        };
    }, []);

    useEffect(() => {
        dispatch(
            setPanelData({
                heading: currentIntent?.type === 'DeployMsSql' ? 'Deployment of MS SQL' : '',
                payloadContent: payloadContent,
                footerButton: currentIntent?.type === 'DeployMsSql' ? 'Deploy MsSql' : '',
                isPayloadReady: isPayloadReady
            })
        );
    }, [currentIntent, payloadContent, isPayloadReady]);

    const handleSendMsg = async (msg: string, add: boolean = true, msgs: messageType[]) => {
        if (msg) {
            await sendMsg(msg, add, msgs);
        }
    };

    const handleSelectButtonClicked = async (paramObj: any) => {
        const updatedMessages = messages ? [...messages] : [];
        if (updatedMessages.length) {
            updatedMessages[updatedMessages.length - 1].list = undefined;
            updatedMessages[updatedMessages.length - 1].type = undefined;
            updatedMessages[updatedMessages.length - 1].errors = undefined;
        }
        updatedMessages.push({
            sender: 'user',
            msg: Object.keys(paramObj)
                .map(
                    key =>
                        `Selected ${key}: ${key.toLowerCase().includes('password') ? '********' : paramObj[key].label}`
                )
                .join(', ')
        });
        setMessages(updatedMessages);
        const msgToBot = Object.keys(paramObj)
            .map(key => `Use ${key} as ${paramObj[key].value}`)
            .join(', ');
        await handleSendMsg(msgToBot, false, updatedMessages);
    };

    useEffect(() => {
        if (currentIntent && currentIntent.type === 'DeployMsSql' && !payloadContent) {
            setPayloadContent(getWlmdbPayload({}));
        }
        if (!currentIntent) {
            setPayloadContent('');
        }
    }, [currentIntent, payloadContent]);

    useEffect(() => {
        var objDiv = document.getElementById('chat_id');
        if (objDiv) {
            objDiv.scrollTop = objDiv.scrollHeight;
        }
    }, [messages]);

    const messagesToShow = useMemo(() => {
        const lastMsg = messages ? messages[messages.length - 1] : {};
        if (lastMsg.sender === 'bot' && !lastMsg.intent && currentIntent && currentIntent.type === 'DeployMsSql') {
            return [
                ...[messages ? messages : []],
                {
                    sender: 'bot',
                    type: 'confirm',
                    active: true,
                    msg: 'Deployment of MS SQL is in progress. Do you want to continue?',
                    confirmData: {
                        confirmMsg: 'Deployment of MS SQL is in progress. Do you want to continue?',
                        confirmBtnTxt: 'Continue',
                        cancelBtnTxt: 'Discard',
                        onConfirm: (messages: messageType[]) => {
                            const botMsgs = messages.filter(item => item.sender === 'bot');
                            const lastIntentMsg = botMsgs.filter(msg => msg.intent).reverse()?.[0] || {};
                            const updatedMsgs = [...messages];
                            setMessages([...updatedMsgs, { ...lastIntentMsg, active: true }]);
                        },
                        onCancel: () => {
                            setCurrentIntent('');
                        }
                    }
                }
            ];
        } else {
            return messages;
        }
    }, [messages, currentIntent]);

    return (
        <div className={styles['chatbot']}>
            {/* <Header /> */}
            <div className={styles['page-content']}>
                <ChatBox
                    isBotReplying={isBotReplying}
                    handleSelectButtonClicked={(paramObj: any) => handleSelectButtonClicked(paramObj)}
                    sendMsg={sendMsg}
                    messagesToShow={messagesToShow ? messagesToShow : []}
                    messages={messages ? messages : []}
                />
            </div>
        </div>
    );
};

export default Chatbot;
