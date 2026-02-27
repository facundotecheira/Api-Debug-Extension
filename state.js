const State = {
    requests: [],
    selectedRequest: null,
    groupMode: true,
    filterText: '',
    port: null,
    reconnectAttempts: 0,
    MAX_RECONNECT_ATTEMPTS: 5
};

const StateManager = {
    getRequests() {
        return State.requests;
    },
    
    setRequests(newRequests) {
        State.requests = newRequests;
    },
    
    addRequest(request) {
        State.requests.push(request);
    },
    
    updateRequest(id, updatedRequest) {
        const index = State.requests.findIndex(r => r.id === id);
        if (index !== -1) {
            State.requests[index] = updatedRequest;
            return true;
        }
        return false;
    },
    
    removeRequest(id) {
        State.requests = State.requests.filter(r => r.id !== id);
    },
    
    clearRequests() {
        State.requests = [];
        State.selectedRequest = null;
    },
    
    getSelectedRequest() {
        return State.selectedRequest;
    },
    
    setSelectedRequest(request) {
        State.selectedRequest = request;
    },
    
    getGroupMode() {
        return State.groupMode;
    },
    
    setGroupMode(mode) {
        State.groupMode = mode;
    },
    
    getFilterText() {
        return State.filterText;
    },
    
    setFilterText(text) {
        State.filterText = text;
    },
    
    getPort() {
        return State.port;
    },
    
    setPort(newPort) {
        State.port = newPort;
    },
    
    incrementReconnectAttempts() {
        State.reconnectAttempts++;
    },
    
    resetReconnectAttempts() {
        State.reconnectAttempts = 0;
    },
    
    getReconnectAttempts() {
        return State.reconnectAttempts;
    },
    
    getMaxReconnectAttempts() {
        return State.MAX_RECONNECT_ATTEMPTS;
    }
};

if (!window.StateManager) window.StateManager = StateManager;
