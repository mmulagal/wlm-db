export const postMessageToCM = (messageData: any) => {
    if (messageData) {
        window.parent.postMessage(messageData, '*');
    }
};
