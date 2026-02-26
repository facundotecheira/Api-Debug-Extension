// Estado de la aplicación
let requests = [];
let selectedRequest = null;
let groupMode = true;
let filterText = '';
let port = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Elementos del DOM
const tableBody = document.getElementById('tableBody');
const detailsPanel = document.getElementById('detailsPanel');
const detailsContent = document.getElementById('detailsContent');
const searchInput = document.getElementById('searchInput');
const groupBtn = document.getElementById('groupBtn');
const clearBtn = document.getElementById('clearBtn');
const compareBtn = document.getElementById('compareBtn');
const editorBtn = document.getElementById('editorBtn');
const copyResponseBtn = document.getElementById('copyResponseBtn');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');
const groupHeader = document.getElementById('groupHeader');

// Modales
const compareModal = document.getElementById('compareModal');
const editorModal = document.getElementById('editorModal');
const nullTestModal = document.getElementById('nullTestModal');
const schemaModal = document.getElementById('schemaModal');

// Elementos del editor
const requestSelector = document.getElementById('requestSelector');
const editUrl = document.getElementById('editUrl');
const editMethod = document.getElementById('editMethod');
const editHeaders = document.getElementById('editHeaders');
const editBody = document.getElementById('editBody');
const sendEditedBtn = document.getElementById('sendEditedBtn');

// Elementos del schema
const schemaInput = document.getElementById('schemaInput');
const schemaResult = document.getElementById('schemaResult');

// Función para mostrar mensajes temporales
function showTemporaryMessage(text, isError = false) {
    let existingMsg = document.querySelector('.temp-message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    const msg = document.createElement('div');
    msg.className = 'temp-message';
    msg.textContent = text;
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isError ? '#dc3545' : '#333'};
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 9999;
        animation: fadeIn 0.3s, fadeOut 0.5s 2.5s forwards;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        if (msg.parentNode) {
            msg.remove();
        }
    }, 3000);
}

// Agregar estilos para las animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes fadeOut {
        to { opacity: 0; transform: translateX(100%); }
    }
`;
if (!document.getElementById('temp-message-styles')) {
    style.id = 'temp-message-styles';
    document.head.appendChild(style);
}

// Función para conectar con el background
function connectToBackground() {
    try {
        if (port) {
            try {
                port.disconnect();
            } catch (e) {
                // Ignorar error al desconectar
            }
        }
        
        port = chrome.runtime.connect({ name: 'debug-panel' });
        reconnectAttempts = 0;
        
        port.onMessage.addListener(handleBackgroundMessages);
        
        port.onDisconnect.addListener(() => {
            console.log('Puerto desconectado, intentando reconectar...');
            handlePortDisconnect();
        });
        
        // SOLICitar requests existentes (pero NO limpiar)
        port.postMessage({ action: 'getRequests' });
        
        // Mostrar mensaje sutil de reconexión
        showTemporaryMessage('🔄 Reconectado');
        
        return true;
    } catch (e) {
        console.error('Error conectando al background:', e);
        return false;
    }
}

// Manejar mensajes del background
function handleBackgroundMessages(msg) {
    switch(msg.event) {
        case 'newRequest':
            if (msg.data.method === 'POST' || msg.data.method === 'PUT' || msg.data.method === 'DELETE') {
                requests.push(msg.data);
                renderTable();
            }
            break;
            
        case 'requestCompleted':
        case 'requestError':
            // Actualizar la request existente
            const index = requests.findIndex(r => r.id === msg.data.id);
            if (index !== -1) {
                requests[index] = msg.data;
                renderTable();
                
                // Si es la request seleccionada, actualizar la vista
                if (selectedRequest && selectedRequest.id === msg.data.id) {
                    selectedRequest = msg.data;
                    showRequestDetails(msg.data);
                    
                    // También actualizar el editor si está abierto
                    if (editorModal.style.display === 'flex') {
                        loadRequestIntoEditor(msg.data);
                    }
                }
            }
            break;
            
        case 'allRequests':
            // ACUMULAR requests, no reemplazar
            const newRequests = msg.data.filter(r => 
                r.method === 'POST' || r.method === 'PUT' || r.method === 'DELETE'
            );
            
            // Mergear sin duplicados
            newRequests.forEach(newReq => {
                const exists = requests.some(r => r.id === newReq.id);
                if (!exists) {
                    requests.push(newReq);
                } else {
                    // Actualizar existente
                    const idx = requests.findIndex(r => r.id === newReq.id);
                    if (idx !== -1) {
                        requests[idx] = newReq;
                    }
                }
            });
            
            renderTable();
            break;
            
        case 'cleared':
            requests = [];
            selectedRequest = null;
            detailsPanel.style.display = 'none';
            renderTable();
            break;
            
        case 'resendResult':
            console.log('✅ Petición reenviada con éxito:', msg.data);
            
            // Buscar la request original por su ID
            const originalRequestIndex = requests.findIndex(r => r.id === msg.data.originalId);
            
            if (originalRequestIndex !== -1) {
                // ACTUALIZAR la request original con la nueva respuesta
                requests[originalRequestIndex] = {
                    ...requests[originalRequestIndex],
                    status: msg.data.status,
                    responseHeaders: msg.data.headers,
                    responseBody: typeof msg.data.body === 'string' ? msg.data.body : JSON.stringify(msg.data.body, null, 2),
                    duration: 0,
                    lastResend: Date.now()
                };
                
                // Seleccionar y mostrar la request actualizada
                selectedRequest = requests[originalRequestIndex];
                
                // Actualizar UI
                renderTable();
                showRequestDetails(selectedRequest);
                loadRequestIntoEditor(selectedRequest);
                
                showTemporaryMessage('✅ Petición actualizada');
            } else {
                // Si no encuentra la original, crear una nueva (como fallback)
                const newRequest = {
                    id: `resend-${Date.now()}-${Math.random()}`,
                    url: msg.data.url || selectedRequest?.url,
                    method: msg.data.method || selectedRequest?.method,
                    timestamp: Date.now(),
                    requestBody: selectedRequest?.requestBody,
                    requestHeaders: selectedRequest?.requestHeaders,
                    status: msg.data.status,
                    responseHeaders: msg.data.headers,
                    responseBody: msg.data.body,
                    duration: 0,
                    isResend: true,
                    originalId: selectedRequest?.id
                };
                
                requests.push(newRequest);
                selectedRequest = newRequest;
                renderTable();
                showRequestDetails(newRequest);
                loadRequestIntoEditor(newRequest);
                showTemporaryMessage('✅ Nueva petición creada');
            }
            
            editorModal.style.display = 'none';
            break;
            
        case 'resendError':
            console.error('❌ Error al reenviar:', msg.data);
            editorModal.style.display = 'none';
            showTemporaryMessage('❌ ' + msg.data, true);
            
            // Crear registro de error
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
            
            requests.push(errorRequest);
            renderTable();
            
            if (detailsPanel.style.display === 'flex') {
                detailsContent.textContent = `Error: ${msg.data}`;
            }
            break;
    }
}

// Manejar desconexión
function handlePortDisconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
            if (connectToBackground()) {
                console.log('Reconectado al background');
            }
        }, 1000 * reconnectAttempts);
    }
}

// Enviar mensaje al background
function sendToBackground(action, data = {}) {
    if (!port) {
        if (!connectToBackground()) {
            showTemporaryMessage('❌ No hay conexión', true);
            return false;
        }
    }
    
    try {
        port.postMessage({ action, data });
        return true;
    } catch (e) {
        console.error('Error enviando mensaje:', e);
        if (e.message.includes('disconnected')) {
            if (connectToBackground()) {
                try {
                    port.postMessage({ action, data });
                    return true;
                } catch (retryError) {
                    showTemporaryMessage('❌ Error al enviar', true);
                }
            }
        }
        return false;
    }
}

// Renderizar tabla
function renderTable() {
    let filteredRequests = filterRequests(requests, filterText);
    let dataToRender = groupMode ? groupRequests(filteredRequests) : filteredRequests;
    
    let html = '';
    dataToRender.forEach(req => {
        const isSelected = selectedRequest && selectedRequest.id === req.id;
        const statusClass = getStatusClass(req.status);
        const duration = req.duration ? formatDuration(req.duration) : 'Pendiente';
        const methodClass = getMethodClass(req.method);
        
        html += `<tr class="${isSelected ? 'selected' : ''}" data-id="${req.id}">
            <td><span class="method-badge method-${methodClass}">${req.method || 'GET'}</span></td>
            <td>${truncateUrl(req.url)}</td>
            <td><span class="status-badge status-${statusClass}">${req.status || 'Pendiente'}</span></td>
            <td>${duration}</td>
            ${groupMode ? `<td>${req.count || 1}</td>` : ''}
        </tr>`;
    });
    
    tableBody.innerHTML = html;
    
    groupHeader.style.display = groupMode ? 'table-cell' : 'none';
    groupBtn.textContent = groupMode ? 'Desagrupar' : 'Agrupar';
    
    document.querySelectorAll('#tableBody tr').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.id;
            const request = findRequestById(id);
            if (request) {
                selectedRequest = request;
                showRequestDetails(request);
                loadRequestIntoEditor(request);
                renderTable();
            }
        });
    });
}

// Cargar request en el editor
function loadRequestIntoEditor(request) {
    if (!request) return;
    
    editUrl.value = request.url || '';
    editMethod.value = request.method || 'POST';
    
    // Procesar headers
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
    
    // Siempre asegurar Content-Type
    if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    
    editHeaders.value = JSON.stringify(headers, null, 2);
    
    // Procesar el body
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
    
    // Última verificación
    try {
        JSON.parse(bodyContent);
    } catch (e) {
        bodyContent = JSON.stringify({ raw: bodyContent }, null, 2);
    }
    
    editBody.value = bodyContent;
}

// Agrupar requests repetidas
function groupRequests(requests) {
    const groups = {};
    
    requests.forEach(req => {
        const urlWithoutParams = req.url.split('?')[0];
        const key = `${req.method}|${urlWithoutParams}`;
        
        if (!groups[key]) {
            groups[key] = {
                ...req,
                count: 1,
                originalId: req.id,
                responses: [{ ...req }],
                firstSeen: req.timestamp,
                lastSeen: req.timestamp
            };
        } else {
            groups[key].count++;
            groups[key].lastSeen = Math.max(groups[key].lastSeen, req.timestamp);
            
            if (req.responseBody && 
                !groups[key].responses.some(r => r.responseBody === req.responseBody)) {
                groups[key].responses.push({ ...req });
            }
            
            if (req.timestamp > groups[key].lastSeen) {
                groups[key].responseBody = req.responseBody;
                groups[key].status = req.status;
                groups[key].duration = req.duration;
                groups[key].id = req.id;
                groups[key].requestBody = req.requestBody;
                groups[key].requestHeaders = req.requestHeaders;
            }
        }
    });
    
    return Object.values(groups).sort((a, b) => b.lastSeen - a.lastSeen);
}

// Buscar request por ID
function findRequestById(id) {
    if (!id) return null;
    
    let request = requests.find(r => r.id === id);
    if (request) return request;
    
    if (groupMode) {
        const groups = groupRequests(requests);
        const group = groups.find(g => g.id === id || g.originalId === id);
        if (group) return group;
    }
    
    return null;
}

// Filtrar requests por texto
function filterRequests(requests, text) {
    if (!text) return requests;
    
    return requests.filter(req => 
        req.url.toLowerCase().includes(text.toLowerCase())
    );
}

// Truncar URL
function truncateUrl(url) {
    if (!url) return 'N/A';
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
}

// Clase para método HTTP
function getMethodClass(method) {
    if (!method) return 'get';
    return method.toLowerCase();
}

// Clase para status
function getStatusClass(status) {
    if (!status || status === 'pending') return 'pending';
    if (status >= 200 && status < 300) return 'success';
    if (status >= 400) return 'error';
    return 'warning';
}

// Formatear duración
function formatDuration(duration) {
    if (!duration) return 'Pendiente';
    return duration < 1000 ? `${duration}ms` : `${(duration/1000).toFixed(2)}s`;
}

// Mostrar detalles de la request
function showRequestDetails(request) {
    detailsPanel.style.display = 'flex';
    
    const tabsHtml = `
        <div class="details-tabs">
            <button class="tab-btn" data-tab="response">Response Body</button>
            <button class="btn btn-success" id="copyResponseBtn">Copiar</button>
            <button class="btn" id="closeDetailsBtn">×</button>
        </div>
    `;
    
    const tabsContainer = document.querySelector('.details-header .details-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = tabsHtml;
        
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                showTab(btn.dataset.tab);
            });
        });
        
document.getElementById('copyResponseBtn').onclick = () => {
    let content = request.responseBody || 'No hay respuesta';
    
    // Si es un objeto, convertirlo a string JSON formateado
    if (typeof content === 'object') {
        try {
            content = JSON.stringify(content, null, 2);
        } catch (e) {
            content = String(content);
        }
    }
    // Si es string pero parece JSON, formatearlo
    else if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // No es JSON, dejarlo como está
        }
    }
    
    navigator.clipboard.writeText(content)
        .then(() => showTemporaryMessage('✅ Copiado al portapapeles'))
        .catch(() => showTemporaryMessage('❌ Error al copiar'));
};
        
        document.getElementById('closeDetailsBtn').onclick = () => {
            detailsPanel.style.display = 'none';
            selectedRequest = null;
            renderTable();
        };
    }
    
    showTab('response');
}

// Mostrar contenido de la pestaña
function showTab(tab) {
    if (!selectedRequest) return;
    
    let content = '';
    
    if (tab === 'response') {
        content = selectedRequest.responseBody || 'No hay respuesta disponible';
        
        try {
            if (typeof content === 'string') {
                if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                    const parsed = JSON.parse(content);
                    content = JSON.stringify(parsed, null, 2);
                }
            } else if (typeof content === 'object') {
                content = JSON.stringify(content, null, 2);
            }
        } catch (e) {
            console.log('Error formateando respuesta');
        }
    }
    
    detailsContent.textContent = content;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const tabName = btn.dataset.tab;
        if (tabName === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Inicializar event listeners
function initEventListeners() {
    searchInput.addEventListener('input', (e) => {
        filterText = e.target.value;
        renderTable();
    });
    
    groupBtn.addEventListener('click', () => {
        groupMode = !groupMode;
        renderTable();
    });
    
    clearBtn.addEventListener('click', () => {
        sendToBackground('clearRequests');
    });
    
    compareBtn.addEventListener('click', () => {
        compareModal.style.display = 'flex';
    });
    
    editorBtn.addEventListener('click', () => {
        if (selectedRequest) {
            loadRequestIntoEditor(selectedRequest);
            editorModal.style.display = 'flex';
        } else {
            loadRequestsForEditor();
            editorModal.style.display = 'flex';
        }
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            compareModal.style.display = 'none';
            editorModal.style.display = 'none';
            nullTestModal.style.display = 'none';
            schemaModal.style.display = 'none';
        });
    });
    
    document.getElementById('compareJsonBtn').addEventListener('click', compareJSON);
    
    sendEditedBtn.addEventListener('click', sendEditedRequest);
    
    requestSelector.addEventListener('change', () => {
        const selectedValue = requestSelector.value;
        if (!selectedValue) return;
        
        const req = findRequestById(selectedValue);
        if (req) {
            loadRequestIntoEditor(req);
        }
    });
    
    // Event listeners del schema
    document.getElementById('schemaBtn').addEventListener('click', () => {
        schemaModal.style.display = 'flex';
    });
    
    document.getElementById('analizarConSchemaBtn').addEventListener('click', analizarConSchema);
    
    document.getElementById('limpiarSchemaBtn').addEventListener('click', () => {
        schemaInput.value = '';
        schemaResult.innerHTML = '';
    });
}

// Cargar requests en selector
function loadRequestsForEditor() {
    let options = '<option value="">Seleccionar petición...</option>';
    
    requests.forEach((req) => {
        const displayUrl = truncateUrl(req.url);
        options += `<option value="${req.id}">${req.method} ${displayUrl}</option>`;
    });
    
    requestSelector.innerHTML = options;
}

// Enviar petición editada
function sendEditedRequest() {
    try {
        const url = editUrl.value.trim();
        const method = editMethod.value;
        let headers = {};
        let body = '';
        
        if (!url) {
            showTemporaryMessage('❌ La URL no puede estar vacía', true);
            return;
        }
        
        try {
            headers = JSON.parse(editHeaders.value || '{}');
            if (typeof headers !== 'object') {
                throw new Error('Headers deben ser un objeto');
            }
        } catch (e) {
            showTemporaryMessage('❌ Headers inválidos: ' + e.message, true);
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
            showTemporaryMessage('⚠️ Body no es JSON, se envía como texto');
            body = editBody.value;
        }
        
        if (!headers['Content-Type'] && method !== 'DELETE') {
            headers['Content-Type'] = 'application/json';
        }
        
        showTemporaryMessage('📤 Enviando petición...');
        
        const success = sendToBackground('resendRequest', { 
            url, 
            method, 
            headers, 
            body,
            originalId: selectedRequest?.id
        });
        
        if (!success) {
            showTemporaryMessage('❌ No se pudo enviar', true);
        }
        
    } catch (e) {
        console.error('Error en editor:', e);
        showTemporaryMessage('❌ Error: ' + e.message, true);
    }
}

// Función para enviar petición de test
async function sendTestRequest(url, method, headers, body) {
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

// Función para encontrar campos null con contexto
function encontrarCamposNullConContexto(obj, padre = 'raíz', path = '') {
    let resultados = [];
    
    for (const key in obj) {
        const valor = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        const padreActual = padre;
        
        if (valor === null) {
            resultados.push({
                campo: key,
                path: currentPath,
                padre: padreActual,
                valor: null,
                tipo: 'null'
            });
        } else if (Array.isArray(valor)) {
            valor.forEach((item, index) => {
                resultados = resultados.concat(
                    encontrarCamposNullConContexto(
                        item, 
                        `${key}[${index}]`, 
                        `${currentPath}[${index}]`
                    )
                );
            });
        } else if (typeof valor === 'object' && valor !== null) {
            resultados = resultados.concat(
                encontrarCamposNullConContexto(valor, key, currentPath)
            );
        }
    }
    
    return resultados;
}

// Función para inferir tipo de un valor en el schema
function inferirTipoSchema(valor) {
    if (valor === null) return 'null';
    if (Array.isArray(valor)) return 'array';
    
    switch(typeof valor) {
        case 'string':
            // Detectar si parece número
            if (!isNaN(valor) && valor.trim() !== '') return 'number';
            // Detectar si parece booleano
            if (valor.toLowerCase() === 'true' || valor.toLowerCase() === 'false') return 'boolean';
            return 'string';
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'object':
            return 'object';
        default:
            return typeof valor;
    }
}

// Función para analizar con schema JSON
function analizarConSchema() {
    if (!selectedRequest) {
        showTemporaryMessage('❌ Seleccioná una petición primero', true);
        return;
    }

    const schemaText = schemaInput.value;
    if (!schemaText.trim()) {
        showTemporaryMessage('❌ Pegá el JSON de referencia primero', true);
        return;
    }

    try {
        // Parsear el JSON schema
        let schemaObj;
        try {
            schemaObj = JSON.parse(schemaText);
        } catch (e) {
            showTemporaryMessage('❌ El JSON de referencia no es válido', true);
            return;
        }
        
        // Obtener el body actual
        let currentBody;
        try {
            currentBody = JSON.parse(editBody.value || '{}');
        } catch (e) {
            showTemporaryMessage('❌ El body actual no es JSON válido', true);
            return;
        }

        // Encontrar campos null con contexto
        const camposNull = encontrarCamposNullConContexto(currentBody);
        
        // Comparar con schema
        const analisis = compararConJsonSchema(camposNull, schemaObj);
        
        // Mostrar resultados
        mostrarAnalisisSchema(analisis);
        
    } catch (e) {
        console.error('Error analizando schema:', e);
        showTemporaryMessage('❌ Error: ' + e.message, true);
    }
}

// Comparar campos null con JSON schema
function compararConJsonSchema(camposNull, schemaObj, basePath = '') {
    const resultados = {
        camposNull: camposNull,
        compatibles: [],
        incompatibles: [],
        noEnSchema: [],
        resumen: {
            totalNull: camposNull.length,
            compatibles: 0,
            incompatibles: 0,
            noEnSchema: 0
        }
    };
    
    // Función para buscar un campo en el schema
    function buscarEnSchema(path) {
        const partes = path.split('.');
        let actual = schemaObj;
        
        for (let i = 0; i < partes.length; i++) {
            const parte = partes[i];
            
            // Manejar arrays [index]
            if (parte.includes('[')) {
                const arrayMatch = parte.match(/(.+)\[(\d+)\]/);
                if (arrayMatch) {
                    const arrayName = arrayMatch[1];
                    if (actual[arrayName] && Array.isArray(actual[arrayName])) {
                        actual = actual[arrayName][0] || {};
                    } else {
                        return null;
                    }
                }
            } else {
                if (actual && typeof actual === 'object' && parte in actual) {
                    actual = actual[parte];
                } else {
                    return null;
                }
            }
        }
        
        return actual;
    }
    
    camposNull.forEach(campoInfo => {
        const valorSchema = buscarEnSchema(campoInfo.path);
        
        if (valorSchema === undefined) {
            // Campo no encontrado en schema
            resultados.noEnSchema.push({
                ...campoInfo,
                sugerencia: '❓ No existe en el JSON de referencia'
            });
            resultados.resumen.noEnSchema++;
        } else {
            // Inferir tipo del schema
            const tipoSchema = inferirTipoSchema(valorSchema);
            
            // Verificar si el campo puede ser null según el schema
            const puedeSerNull = valorSchema === null;
            
            if (puedeSerNull) {
                resultados.compatibles.push({
                    ...campoInfo,
                    tipoSchema: tipoSchema,
                    sugerencia: '✅ Puede ser null (el schema también lo tiene como null)'
                });
                resultados.resumen.compatibles++;
            } else {
                resultados.incompatibles.push({
                    ...campoInfo,
                    tipoSchema: tipoSchema,
                    valorEjemplo: valorSchema,
                    sugerencia: `⚠️ NO debería ser null. El schema espera tipo: ${tipoSchema}`,
                    valorPorDefecto: obtenerValorEjemploSegunTipo(tipoSchema, valorSchema)
                });
                resultados.resumen.incompatibles++;
            }
        }
    });
    
    return resultados;
}

// Obtener valor de ejemplo según tipo
function obtenerValorEjemploSegunTipo(tipo, valorEjemplo) {
    if (valorEjemplo !== undefined) {
        return JSON.stringify(valorEjemplo);
    }
    
    switch(tipo) {
        case 'number':
            return '0';
        case 'string':
            return '""';
        case 'boolean':
            return 'false';
        case 'array':
            return '[]';
        case 'object':
            return '{}';
        default:
            return 'null';
    }
}

// Mostrar análisis del schema
function mostrarAnalisisSchema(analisis) {
    if (!schemaResult) return;
    
    let html = `
        <div style="background: #1e1e1e; border-radius: 4px; padding: 15px;">
            <h3 style="color: #61afef; margin-bottom: 15px;">📊 Análisis de Campos Null vs Schema</h3>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                    <div style="color: #abb2bf; font-size: 12px;">Total Nulls</div>
                    <div style="color: #e5c07b; font-size: 24px; font-weight: bold;">${analisis.resumen.totalNull}</div>
                </div>
                <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                    <div style="color: #abb2bf; font-size: 12px;">✅ Compatibles</div>
                    <div style="color: #98c379; font-size: 24px; font-weight: bold;">${analisis.resumen.compatibles}</div>
                </div>
                <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                    <div style="color: #abb2bf; font-size: 12px;">⚠️ Incompatibles</div>
                    <div style="color: #e06c75; font-size: 24px; font-weight: bold;">${analisis.resumen.incompatibles}</div>
                </div>
            </div>
    `;
    
    // Campos incompatibles (problemáticos)
    if (analisis.incompatibles.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #e06c75; margin-bottom: 10px;">⚠️ Campos que NO deberían ser null</h4>
                ${analisis.incompatibles.map(c => `
                    <div style="background: #2d2d2d; padding: 12px; margin-bottom: 8px; border-radius: 4px; border-left: 4px solid #e06c75;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div>
                                <code style="color: #e5c07b; font-size: 13px;">${c.path}</code>
                                <span style="color: #abb2bf; margin-left: 10px; font-size: 12px;">(en ${c.padre})</span>
                            </div>
                            <span style="color: #e06c75; background: #3e3e3e; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${c.tipoSchema}</span>
                        </div>
                        <div style="color: #e5c07b; font-size: 12px; margin-top: 5px;">
                            💡 ${c.sugerencia}
                        </div>
                        <div style="color: #98c379; font-size: 12px; margin-top: 5px; background: #1e1e1e; padding: 5px; border-radius: 3px;">
                            🔧 Valor de ejemplo: ${c.valorPorDefecto}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Campos compatibles (pueden ser null)
    if (analisis.compatibles.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #98c379; margin-bottom: 10px;">✅ Campos que pueden ser null</h4>
                ${analisis.compatibles.map(c => `
                    <div style="background: #2d2d2d; padding: 8px; margin-bottom: 5px; border-radius: 4px; border-left: 3px solid #98c379;">
                        <code style="color: #e5c07b;">${c.path}</code>
                        <span style="color: #abb2bf; margin-left: 10px;">(en ${c.padre})</span>
                        <span style="color: #98c379; float: right;">${c.tipoSchema}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Campos no encontrados en schema
    if (analisis.noEnSchema.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #abb2bf; margin-bottom: 10px;">❓ Campos no encontrados en schema</h4>
                ${analisis.noEnSchema.map(c => `
                    <div style="background: #2d2d2d; padding: 8px; margin-bottom: 5px; border-radius: 4px; border-left: 3px solid #abb2bf;">
                        <code style="color: #e5c07b;">${c.path}</code>
                        <span style="color: #abb2bf; margin-left: 10px;">(en ${c.padre})</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Si no hay nulls
    if (analisis.camposNull.length === 0) {
        html += `<p style="color: #98c379; text-align: center; padding: 20px;">✅ No hay campos null en el body actual</p>`;
    }
    
    html += `</div>`;
    
    schemaResult.innerHTML = html;
}

// Función para comparar JSON (existente)
function compareJSON() {
    const json1 = document.getElementById('json1').value.trim();
    const json2 = document.getElementById('json2').value.trim();
    const resultDiv = document.getElementById('compareResult');
    
    if (!json1 && !json2) {
        resultDiv.innerHTML = '<p class="info-message">📝 Pegá dos JSON para comparar</p>';
        return;
    }
    
    try {
        let obj1, obj2;
        
        try {
            obj1 = JSON.parse(json1);
        } catch (e) {
            obj1 = tryFixJson(json1);
            if (!obj1) throw new Error('JSON1 inválido');
        }
        
        try {
            obj2 = JSON.parse(json2);
        } catch (e) {
            obj2 = tryFixJson(json2);
            if (!obj2) throw new Error('JSON2 inválido');
        }
        
        const array1 = ensureArray(obj1);
        const array2 = ensureArray(obj2);
        
        let infoHtml = `<div class="info-message">📊 JSON1: ${array1.length} elementos | JSON2: ${array2.length} elementos</div>`;
        
        const diferencias = encontrarTodasLasDiferencias(array1, array2);
        
        if (diferencias.length === 0) {
            resultDiv.innerHTML = infoHtml + '<p class="success-message">✅ Los JSON son idénticos</p>';
        } else {
            resultDiv.innerHTML = infoHtml + '<h3>📋 Diferencias encontradas:</h3>' + formatearTodasLasDiferencias(diferencias);
        }
        
    } catch (e) {
        resultDiv.innerHTML = `<div class="error-message">❌ ${e.message}</div>`;
    }
}

// Funciones auxiliares para comparación JSON (existentes)
function tryFixJson(str) {
    try {
        if (str.includes('}{')) {
            const fixed = '[' + str.replace(/}{/g, '},{') + ']';
            return JSON.parse(fixed);
        }
        
        const lines = str.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
            const objects = lines
                .map(l => l.trim())
                .filter(l => l.startsWith('{') && l.endsWith('}'));
            
            if (objects.length > 1) {
                const fixed = '[' + objects.join(',') + ']';
                return JSON.parse(fixed);
            }
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

function ensureArray(obj) {
    if (Array.isArray(obj)) {
        return obj;
    } else if (obj && typeof obj === 'object') {
        return [obj];
    } else {
        return [];
    }
}

// Función para encontrar TODAS las diferencias (VERSIÓN QUE DESGLOSA OBJETOS)
function encontrarTodasLasDiferencias(arr1, arr2) {
    const diferencias = [];
    
    // Si son arrays, comparar elemento por elemento
    const maxLength = Math.max(arr1.length, arr2.length);
    
    for (let i = 0; i < maxLength; i++) {
        const item1 = arr1[i];
        const item2 = arr2[i];
        
        if (!item1 && item2) {
            diferencias.push({
                tipo: 'solo_en_segundo',
                ruta: `[${i}]`,
                mensaje: `Elemento en posición [${i}] solo existe en JSON2`
            });
        } else if (item1 && !item2) {
            diferencias.push({
                tipo: 'solo_en_primero',
                ruta: `[${i}]`,
                mensaje: `Elemento en posición [${i}] solo existe en JSON1`
            });
        } else if (item1 && item2) {
            // Comparar objetos directamente, sin prefijos de ID
            const diffs = compararObjetosSinId(item1, item2, `[${i}]`);
            diferencias.push(...diffs);
        }
    }
    
    return diferencias;
}


function compararObjetosSinId(obj1, obj2, ruta = '') {
    const diferencias = [];
    
    // Si son null o tipos diferentes
    if (obj1 === null || obj2 === null || typeof obj1 !== typeof obj2) {
        if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
            diferencias.push({
                tipo: 'valor_diferente',
                ruta: ruta || 'raíz',
                valor1: obj1,
                valor2: obj2
            });
        }
        return diferencias;
    }
    
    // Si no son objetos, comparar valores
    if (typeof obj1 !== 'object') {
        if (obj1 !== obj2) {
            diferencias.push({
                tipo: 'valor_diferente',
                ruta: ruta || 'raíz',
                valor1: obj1,
                valor2: obj2
            });
        }
        return diferencias;
    }
    
    // Si son arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        const maxLen = Math.max(obj1.length, obj2.length);
        for (let i = 0; i < maxLen; i++) {
            const nuevaRuta = ruta ? `${ruta}[${i}]` : `[${i}]`;
            const val1 = obj1[i];
            const val2 = obj2[i];
            
            if (val1 === undefined && val2 !== undefined) {
                diferencias.push({
                    tipo: 'solo_en_segundo',
                    ruta: nuevaRuta,
                    mensaje: `Elemento en ${nuevaRuta} solo existe en JSON2`
                });
            } else if (val1 !== undefined && val2 === undefined) {
                diferencias.push({
                    tipo: 'solo_en_primero',
                    ruta: nuevaRuta,
                    mensaje: `Elemento en ${nuevaRuta} solo existe en JSON1`
                });
            } else {
                const subDiffs = compararObjetosSinId(val1, val2, nuevaRuta);
                diferencias.push(...subDiffs);
            }
        }
        return diferencias;
    }
    
    // Si son objetos
    const todasLasKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of todasLasKeys) {
        const nuevaRuta = ruta ? `${ruta}.${key}` : key;
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        // Si la key no existe en uno de los objetos
        if (val1 === undefined && val2 !== undefined) {
            diferencias.push({
                tipo: 'solo_en_segundo',
                ruta: nuevaRuta,
                mensaje: `Propiedad "${key}" solo existe en JSON2`,
                valor2: val2
            });
        } else if (val1 !== undefined && val2 === undefined) {
            diferencias.push({
                tipo: 'solo_en_primero',
                ruta: nuevaRuta,
                mensaje: `Propiedad "${key}" solo existe en JSON1`,
                valor1: val1
            });
        } else {
            // Comparar valores
            const subDiffs = compararObjetosSinId(val1, val2, nuevaRuta);
            diferencias.push(...subDiffs);
        }
    }
    
    return diferencias;
}

// Nueva función para comparar objetos recursivamente
// Función para comparar objetos recursivamente (devuelve rutas limpias)
function compararObjetos(obj1, obj2, ruta = '') {
    const diferencias = [];
    
    // Si alguno es null o no es objeto
    if (obj1 === null || obj2 === null || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
        if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
            diferencias.push({
                tipo: 'valor_diferente',
                ruta: ruta,  // Ruta ya limpia
                valor1: obj1,
                valor2: obj2
            });
        }
        return diferencias;
    }
    
    // Obtener todas las keys de ambos objetos
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of allKeys) {
        const nuevaRuta = ruta ? `${ruta}.${key}` : key;
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        // Si ambos son objetos, comparar recursivamente
        if (val1 && val2 && typeof val1 === 'object' && typeof val2 === 'object') {
            const subDiferencias = compararObjetos(val1, val2, nuevaRuta);
            diferencias.push(...subDiferencias);
        }
        // Si son valores diferentes
        else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            diferencias.push({
                tipo: 'valor_diferente',
                ruta: nuevaRuta,  // Ruta limpia como "tools.raiting"
                valor1: val1,
                valor2: val2
            });
        }
    }
    
    return diferencias;
}

// También modificar la función de formateo
function formatearTodasLasDiferencias(diferencias) {
    if (diferencias.length === 0) return '<p class="success-message">✅ No hay diferencias</p>';
    
    let html = '<div class="differences-container">';
    
    diferencias.forEach(diff => {
        if (diff.tipo === 'valor_diferente') {
            // Formatear valores para mostrar
            const val1Str = diff.valor1 === null ? 'null' : 
                           (typeof diff.valor1 === 'string' ? `"${diff.valor1}"` : JSON.stringify(diff.valor1));
            const val2Str = diff.valor2 === null ? 'null' : 
                           (typeof diff.valor2 === 'string' ? `"${diff.valor2}"` : JSON.stringify(diff.valor2));
            
            html += `
                <div class="diff-item" style="border-left-color: #e5c07b; margin-bottom: 8px; padding: 10px;">
                    <div style="color: #e5c07b; font-family: monospace; font-weight: bold; margin-bottom: 5px;">
                        📊 ${diff.ruta}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: 20px;">
                        <span style="color: #e06c75; background: #2d2d2d; padding: 2px 8px; border-radius: 3px; font-family: monospace;">${val1Str}</span>
                        <span style="color: #abb2bf;">→</span>
                        <span style="color: #98c379; background: #2d2d2d; padding: 2px 8px; border-radius: 3px; font-family: monospace;">${val2Str}</span>
                    </div>
                </div>
            `;
        } else {
            // Para elementos solo en uno de los JSON
            const icono = diff.tipo === 'solo_en_primero' ? '➖' : '➕';
            const color = diff.tipo === 'solo_en_primero' ? '#e06c75' : '#98c379';
            
            html += `
                <div class="diff-item" style="border-left-color: ${color}; margin-bottom: 8px; padding: 8px;">
                    <div style="color: ${color}; font-family: monospace;">
                        ${icono} ${diff.mensaje || diff.ruta}
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}
// Función para testear campos null (placeholder)
async function testNullFields() {
    showTemporaryMessage('🔄 Función en desarrollo', false);
}

// Función para mostrar solo los nulls detectados (sin schema)
function mostrarNullsDetectados() {
    if (!selectedRequest) {
        showTemporaryMessage('❌ Seleccioná una petición primero', true);
        return;
    }

    try {
        // Obtener el body actual
        let currentBody;
        try {
            currentBody = JSON.parse(editBody.value || '{}');
        } catch (e) {
            showTemporaryMessage('❌ El body actual no es JSON válido', true);
            return;
        }

        // Encontrar campos null con contexto
        const camposNull = encontrarCamposNullConContexto(currentBody);
        
        // Limpiar el resultado anterior
        schemaResult.innerHTML = '';
        
        if (camposNull.length === 0) {
            schemaResult.innerHTML = `
                <div style="background: #1e1e1e; border-radius: 4px; padding: 20px; text-align: center;">
                    <p style="color: #98c379; font-size: 16px;">✅ No hay campos null en el body actual</p>
                </div>
            `;
            return;
        }

        // Mostrar solo los nulls detectados
        let html = `
            <div style="background: #1e1e1e; border-radius: 4px; padding: 15px;">
                <h3 style="color: #61afef; margin-bottom: 15px;">🔍 Campos Null Detectados</h3>
                <p style="color: #abb2bf; margin-bottom: 15px;">Total: ${camposNull.length} campos null</p>
        `;

        // Agrupar por padre para mejor visualización
        const porPadre = {};
        camposNull.forEach(c => {
            if (!porPadre[c.padre]) porPadre[c.padre] = [];
            porPadre[c.padre].push(c);
        });

        for (const [padre, campos] of Object.entries(porPadre)) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #e5c07b; margin-bottom: 8px;">📁 ${padre === 'raíz' ? 'Raíz' : padre}</h4>
                    ${campos.map(c => `
                        <div style="background: #2d2d2d; padding: 8px 12px; margin-bottom: 4px; border-radius: 4px; border-left: 3px solid #e5c07b;">
                            <code style="color: #e5c07b;">${c.campo}</code>
                            <span style="color: #abb2bf; margin-left: 10px; font-size: 12px;">ruta: ${c.path}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += `
            <div style="margin-top: 20px; padding: 10px; background: #2d2d2d; border-radius: 4px; border-left: 3px solid #61afef;">
                <p style="color: #abb2bf; margin-bottom: 5px;">📌 Para validar tipos:</p>
                <p style="color: #98c379; font-size: 12px;">1. Pegá un JSON de referencia abajo</p>
                <p style="color: #98c379; font-size: 12px;">2. Hacé click en "Comparar con Schema"</p>
            </div>
        `;

        html += `</div>`;
        schemaResult.innerHTML = html;

    } catch (e) {
        console.error('Error mostrando nulls:', e);
        schemaResult.innerHTML = `<div class="error-message">❌ Error: ${e.message}</div>`;
    }
}

// Modificar el event listener del botón schema
document.getElementById('schemaBtn').addEventListener('click', () => {
    schemaModal.style.display = 'flex';
    // Mostrar automáticamente los nulls detectados
    mostrarNullsDetectados();
});



// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (!connectToBackground()) {
        showTemporaryMessage('❌ No se pudo conectar con el background', true);
    }
    initEventListeners();
});