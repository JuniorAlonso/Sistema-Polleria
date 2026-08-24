const conversations = new Map();

function getConversation(userId) {

    if (!conversations.has(userId)) {

        conversations.set(userId, {
            state: 'MENU'
        });

    }

    return conversations.get(userId);
}

function setState(userId, state) {

    const conversation = getConversation(userId);

    conversation.state = state;
}

function clearConversation(userId) {

    conversations.delete(userId);
}

module.exports = {
    getConversation,
    setState,
    clearConversation
};