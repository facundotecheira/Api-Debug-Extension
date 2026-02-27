const BackgroundConnector = {
    connect() {
        try {
            if (StateManager.getPort()) {
                try {
                    StateManager.getPort().disconnect();
                } catch (e) {}
            }
            
            const port = chrome.runtime.connect({ name: 'debug-panel' });
            StateManager.resetReconnectAttempts();
            
            port.onMessage.addListener(BackgroundConnector.handleMessage);
            
            port.onDisconnect.addListener(() => {
                console.log('Puerto desconectado, intentando reconectar...');
                BackgroundConnector.handleDisconnect();
            });
            
            StateManager.setPort(port);
            
            port.postMessage({ action: 'getRequests' });
            
            UI.showTemporaryMessage('🔄 Reconectado');
            
            return true;
        } catch (e) {
            console.error('Error conectando al background:', e);
            return false;
        }
    },
    
    handleMessage(msg) {
        MessageHandler.process(msg);
    },
    
    handleDisconnect() {
        if (StateManager.getReconnectAttempts() < StateManager.getMaxReconnectAttempts()) {
            StateManager.incrementReconnectAttempts();
            setTimeout(() => {
                if (BackgroundConnector.connect()) {
                    console.log('Reconectado al background');
                }
            }, 1000 * StateManager.getReconnectAttempts());
        }
    },
    
    sendToBackground(action, data = {}) {
        const port = StateManager.getPort();
        
        if (!port) {
            if (!BackgroundConnector.connect()) {
                UI.showTemporaryMessage('❌ No hay conexión', true);
                return false;
            }
        }
        
        try {
            port.postMessage({ action, data });
            return true;
        } catch (e) {
            console.error('Error enviando mensaje:', e);
            if (e.message.includes('disconnected')) {
                if (BackgroundConnector.connect()) {
                    try {
                        port.postMessage({ action, data });
                        return true;
                    } catch (retryError) {
                        UI.showTemporaryMessage('❌ Error al enviar', true);
                    }
                }
            }
            return false;
        }
    }
};

if(!window.BackgroundConnector) window.BackgroundConnector = BackgroundConnector;
