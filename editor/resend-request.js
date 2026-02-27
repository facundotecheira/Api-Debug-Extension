const ResendRequest = {
    async send() {
        try {
            const url = editUrl.value.trim();
            const method = editMethod.value;
            let headers = {};
            let body = '';
            
            if (!url) {
                UI.showTemporaryMessage('❌ La URL no puede estar vacía', true);
                return;
            }
            
            try {
                headers = JSON.parse(editHeaders.value || '{}');
                if (typeof headers !== 'object') {
                    throw new Error('Headers deben ser un objeto');
                }
            } catch (e) {
                UI.showTemporaryMessage('❌ Headers inválidos: ' + e.message, true);
                return;
            }
            
            try {
                if (editBody.value.trim()) {
                    const bodyObj = JSON.parse(editBody.value);
                    body = JSON.stringify(bodyObj);
                } else {
                    body = '{}';
                }
            } catch (e) {
                UI.showTemporaryMessage('⚠️ Body no es JSON, se envía como texto');
                body = editBody.value;
            }
            
            if (!headers['Content-Type'] && method !== 'DELETE') {
                headers['Content-Type'] = 'application/json';
            }
            
            UI.showTemporaryMessage('📤 Enviando petición...');
            
            const selectedRequest = StateManager.getSelectedRequest();
            const success = BackgroundConnector.sendToBackground('resendRequest', { 
                url, 
                method, 
                headers, 
                body,
                originalId: selectedRequest?.id
            });
            
            if (!success) {
                UI.showTemporaryMessage('❌ No se pudo enviar', true);
            }
            
        } catch (e) {
            console.error('Error en editor:', e);
            UI.showTemporaryMessage('❌ Error: ' + e.message, true);
        }
    },
    
    async sendTestRequest(url, method, headers, body) {
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            return {
                ok: response.ok,
                status: response.status,
                data: data
            };
        } catch (e) {
            return {
                ok: false,
                status: 0,
                error: e.message,
                data: null
            };
        }
    }
};

if(!window.ResendRequest) window.ResendRequest = ResendRequest;