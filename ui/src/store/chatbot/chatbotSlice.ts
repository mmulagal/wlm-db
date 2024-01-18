import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatbotEntities } from '../../utils/types/chatbotTypes';

const initialState: ChatbotEntities = {
    messages: [],
    currentIntent: '',
    isShow: false,
    isReceivingMsg: false,
    loadConfigClicked: false,
    showRetry: false,
    isWizardTouched: false,
    suggestionBubbles: {
        list: [],
        onBubbleClick: () => {}
    },
    expectingResponse: {
        type: 'none',
        fieldName: ''
    }
};

const chatbotSlice = createSlice({
    name: 'chatbot',
    initialState,
    reducers: {
        setMessages: (state, action: PayloadAction<any>) => {
            state.messages = action.payload;
        },
        setCurrentIntent: (state, action: PayloadAction<any>) => {
            state.currentIntent = action.payload;
        },
        setIsShow: (state, action: PayloadAction<any>) => {
            state.isShow = action.payload;
        },
        setIsReceivingMsg: (state, action: PayloadAction<any>) => {
            state.isReceivingMsg = action.payload;
        },
        setLoadConfigClicked: (state, action: PayloadAction<any>) => {
            state.loadConfigClicked = action.payload;
        },
        setShowRetry: (state, action: PayloadAction<any>) => {
            state.showRetry = action.payload;
        },
        setIsWizardTouched: (state, action: PayloadAction<any>) => {
            state.isWizardTouched = action.payload;
        },
        setSuggestionBubbles: (state, action: PayloadAction<any>) => {
            state.suggestionBubbles = action.payload;
        },
        setExpectingResponse: (state, action: PayloadAction<any>) => {
            state.expectingResponse = action.payload;
        }
    }
});

export const {
    setMessages,
    setCurrentIntent,
    setIsShow,
    setIsReceivingMsg,
    setLoadConfigClicked,
    setShowRetry,
    setIsWizardTouched,
    setSuggestionBubbles,
    setExpectingResponse
} = chatbotSlice.actions;
export default chatbotSlice;
