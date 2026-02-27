const MessageHandler = {
    process(msg) {
        switch(msg.event) {
            case 'newRequest':
                if (msg.data.method === 'POST' || msg.data.method === 'PUT' || msg.data.method === 'DELETE') {
                    StateManager.addRequest(msg.data);
                    TableRenderer.render();
                }
                break;
                
            case 'requestCompleted':
            case 'requestError':
                const index = StateManager.getRequests().findIndex(r => r.id === msg.data.id);
                if (index !== -1) {
                    StateManager.updateRequest(msg.data.id, msg.data);
                    TableRenderer.render();
                    
                    const selectedRequest = StateManager.getSelectedRequest();
                    if (selectedRequest && selectedRequest.id === msg.data.id) {
                        StateManager.setSelectedRequest(msg.data);
                        DetailsPanel.show(msg.data);
                        
                        if (editorModal.style.display === 'flex') {
                            RequestEditor.load(msg.data);
                        }
                    }
                }
                break;
                
            case 'allRequests':
                const newRequests = msg.data.filter(r => 
                    r.method === 'POST' || r.method === 'PUT' || r.method === 'DELETE'
                );
                
                newRequests.forEach(newReq => {
                    const exists = StateManager.getRequests().some(r => r.id === newReq.id);
                    if (!exists) {
                        StateManager.addRequest(newReq);
                    } else {
                        StateManager.updateRequest(newReq.id, newReq);
                    }
                });
                
                TableRenderer.render();
                break;
                
            case 'cleared':
                StateManager.clearRequests();
                DetailsPanel.hide();
                TableRenderer.render();
                break;
                
            case 'resendResult':
                MessageHandler.handleResendResult(msg.data);
                break;
                
            case 'resendError':
                console.error('❌ Error al reenviar:', msg.data);
                editorModal.style.display = 'none';
                UI.showTemporaryMessage('❌ ' + msg.data, true);
                
                const selectedRequest = StateManager.getSelectedRequest();
                const errorRequest = {
                    id: `error-${Date.now()}-${Math.random()}`,
                    url: selectedRequest?.url,
                    method: selectedRequest?.method,
                    timestamp: Date.now(),
                    requestBody: selectedRequest?.requestBody,
                    requestHeaders: selectedRequest?.requestHeaders,
                    status: 'error',
                    responseBody: `Error: ${msg.data}`,
                    isResend: true,
                    isError: true
                };
                
                StateManager.addRequest(errorRequest);
                TableRenderer.render();
                
                if (detailsPanel.style.display === 'flex') {
                    detailsContent.textContent = `Error: ${msg.data}`;
                }
                break;
        }
    },
    
    handleResendResult(data) {
        console.log('✅ Petición reenviada con éxito:', data);
        
        const originalRequestIndex = StateManager.getRequests().findIndex(r => r.id === data.originalId);
        
        if (originalRequestIndex !== -1) {
            const originalRequest = StateManager.getRequests()[originalRequestIndex];
            const updatedRequest = {
                ...originalRequest,
                status: data.status,
                responseHeaders: data.headers,
                responseBody: typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2),
                duration: 0,
                lastResend: Date.now()
            };
            
            StateManager.updateRequest(data.originalId, updatedRequest);
            StateManager.setSelectedRequest(updatedRequest);
            
            TableRenderer.render();
            DetailsPanel.show(updatedRequest);
            RequestEditor.load(updatedRequest);
            
            UI.showTemporaryMessage('✅ Petición actualizada');
        } else {
            const selectedRequest = StateManager.getSelectedRequest();
            const newRequest = {
                id: `resend-${Date.now()}-${Math.random()}`,
                url: data.url || selectedRequest?.url,
                method: data.method || selectedRequest?.method,
                timestamp: Date.now(),
                requestBody: selectedRequest?.requestBody,
                requestHeaders: selectedRequest?.requestHeaders,
                status: data.status,
                responseHeaders: data.headers,
                responseBody: data.body,
                duration: 0,
                isResend: true,
                originalId: selectedRequest?.id
            };
            
            StateManager.addRequest(newRequest);
            StateManager.setSelectedRequest(newRequest);
            TableRenderer.render();
            DetailsPanel.show(newRequest);
            RequestEditor.load(newRequest);
            UI.showTemporaryMessage('✅ Nueva petición creada');
        }
        
        editorModal.style.display = 'none';
    }
};

if(!window.MessageHandler) window.MessageHandler = MessageHandler;