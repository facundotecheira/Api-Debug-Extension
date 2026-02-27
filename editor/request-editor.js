const requestSelector = document.getElementById('requestSelector');
const editUrl = document.getElementById('editUrl');
const editMethod = document.getElementById('editMethod');
const editHeaders = document.getElementById('editHeaders');
const editBody = document.getElementById('editBody');

const RequestEditor = {
    load(request) {
        if (!request) return;
        
        editUrl.value = request.url || '';
        editMethod.value = request.method || 'POST';

        let headers = {};
        if (request.requestHeaders && request.requestHeaders.length > 0) {
            request.requestHeaders.forEach(h => {
                if (h.name && h.value) {
                    if (!h.name.startsWith('sec-') && 
                        h.name !== 'Accept' && 
                        h.name !== 'Accept-Encoding' &&
                        h.name !== 'Accept-Language' &&
                        h.name !== 'Connection') {
                        headers[h.name] = h.value;
                    }
                }
            });
        }
        
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        
        editHeaders.value = JSON.stringify(headers, null, 2);
        
        let bodyContent = '{}';
        
        if (request.requestBody) {
            try {
                if (typeof request.requestBody === 'string') {
                    const parsed = JSON.parse(request.requestBody);
                    bodyContent = JSON.stringify(parsed, null, 2);
                } else if (typeof request.requestBody === 'object') {
                    bodyContent = JSON.stringify(request.requestBody, null, 2);
                } else {
                    bodyContent = String(request.requestBody);
                }
            } catch (e) {
                console.log('Error parseando body:', e);
                bodyContent = typeof request.requestBody === 'string' 
                    ? request.requestBody 
                    : JSON.stringify(request.requestBody);
            }
        } else {
            if (request.body) {
                try {
                    const parsed = JSON.parse(request.body);
                    bodyContent = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    bodyContent = request.body;
                }
            }
        }
        
        try {
            JSON.parse(bodyContent);
        } catch (e) {
            bodyContent = JSON.stringify({ raw: bodyContent }, null, 2);
        }
        
        editBody.value = bodyContent;
    },
    
    loadSelector() {
        const requests = StateManager.getRequests();
        let options = '<option value="">Seleccionar petición...</option>';
        
        requests.forEach((req) => {
            const displayUrl = req.url ? (req.url.length > 50 ? req.url.substring(0, 47) + '...' : req.url) : 'N/A';
            options += `<option value="${req.id}">${req.method} ${displayUrl}</option>`;
        });
        
        requestSelector.innerHTML = options;
    },
    
    getCurrentRequestData() {
        return {
            url: editUrl.value.trim(),
            method: editMethod.value,
            headers: JSON.parse(editHeaders.value || '{}'),
            body: editBody.value
        };
    }
};

if(!window.RequestEditor) window.RequestEditor = RequestEditor;