import { useState, useEffect, useMemo } from 'react';
import { generateOptionType, getWlmdbPayload, wrapContext } from '../../../utils/utilityFunctions';

import styles from './Chatbot.module.scss';
import ChatBox from './ChatBox/Chatbox';
import { setPanelData, setPanelType, setShowPreviewPanel } from '../../../store/previewPanel/previewPanelSlice';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useSendMsgMutation } from '../../../utils/apiService';
import { setCurrentIntent, setMessages } from '../../../store/chatbot/chatbotSlice';
import {
    setSelectedCredentials,
    setSelectedDBDeploymentModel,
    setSelectedRegionData
} from '../../../store/mssql/mssqlFormSlice';
import { GENERAL } from '../../../utils/appConstants';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
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
    const messages = useAppSelector(state => state.chatbot.messages);
    const currentIntent = useAppSelector(state => state.chatbot.currentIntent);
    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const credentialData = useAppSelector(state => state.mssql.getCredentials);
    const { regionsData } = useAppSelector(state => state.mssql.getRegions);
    //const [messages, setMessages] = useState<messageType[] | null>([{ sender: 'bot', msg: 'Hi! How can I help you?' }]);
    const [isBotReplying, setIsBotReplying] = useState(false);
    //const [currentIntent, setCurrentIntent] = useState<any>('');
    const [isPayloadReady, setIsPayloadReady] = useState(false);
    const [payloadContent, setPayloadContent] = useState<any>('');
    const dispatch = useAppDispatch();

    const [sendMsgToBot] = useSendMsgMutation();

    const mapParamsToPayload = (params: any) => {
        Object.keys(params).map(key => {
            switch (key) {
                case 'credentialsId':
                    const newCredential = credentialData.credentialData?.filter(
                        item => item.credentialsId === params[key]
                    )[0];
                    const credValue = newCredential?.name + ' | Account: ' + newCredential?.providerAccountId;
                    const option = generateOptionType(credValue, credValue, '', false, '', newCredential);
                    dispatch(setSelectedCredentials(option));
                    break;
                case 'fsxDeploymentMode':
                    if (params[key] === 'SINGLE_AZ_1') {
                        dispatch(
                            setSelectedDBDeploymentModel({
                                label: GENERAL.SINGLE_INSTANCE,
                                value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                            })
                        );
                    } else {
                        dispatch(
                            setSelectedDBDeploymentModel({
                                label: GENERAL.FAILOVER_CLUSTER,
                                value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                            })
                        );
                    }
                    break;
                case 'region':
                    const newRegion = regionsData?.regions?.filter(item => item.regionCode === params[key])[0];
                    const regionValue = newRegion?.regionCode + ' | ' + newRegion?.regionName;
                    const regionOption = generateOptionType(regionValue, regionValue, '', false, '', newRegion);
                    dispatch(setSelectedRegionData(regionOption));
                    break;
            }
        });
    };

    const sendMsg = async (msg?: string, add: boolean = true, msgs = messages) => {
        setIsBotReplying(true);
        let updatedMessages = msgs ? [...msgs] : [];
        if (add) {
            let preResponseMsg = msgs || [];
            if (preResponseMsg.length && preResponseMsg[preResponseMsg.length - 1].errors) {
                const lastMsg = preResponseMsg[preResponseMsg.length - 1];
                preResponseMsg = [
                    ...preResponseMsg.slice(0, preResponseMsg.length - 1),
                    {
                        ...lastMsg,
                        active: false
                    }
                ];
            }
            dispatch(setMessages([...preResponseMsg, { sender: 'user', msg: msg }]));
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
                        dispatch(setCurrentIntent(intent));
                        if (!intent.complete) {
                            setPayloadContent(getWlmdbPayload(intent.params));
                            mapParamsToPayload(intent.params);
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
                        updatedMessages[updatedMessages.length - 3] = {
                            ...updatedMessages[updatedMessages.length - 3],
                            active: false
                        };
                    }

                    dispatch(setMessages(updatedMessages));
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
            updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                errors: null,
                msg: `Provide value${Object.keys(paramObj).length > 1 ? 's' : ''} for ${Object.keys(paramObj).join(
                    ', '
                )}`
            };
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
        dispatch(setMessages(updatedMessages));
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
    //@ts-ignore
    const messagesToShow = useMemo(() => {
        const lastMsg = messages ? messages[messages.length - 1] : {};
        if (
            lastMsg &&
            lastMsg.sender === 'bot' &&
            !lastMsg.intent &&
            currentIntent &&
            currentIntent.type === 'DeployMsSql'
        ) {
            const existingMessages = messages ? messages : [];
            return [
                ...existingMessages,
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
                            dispatch(setMessages([...updatedMsgs, { ...lastIntentMsg, active: true }]));
                        },
                        onCancel: () => {
                            dispatch(setCurrentIntent(''));
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
