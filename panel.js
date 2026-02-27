document.addEventListener('DOMContentLoaded', () => {
    UI.addStyles();
    
    ModalManager.initEventListeners();

    if (!BackgroundConnector.connect()) {
        UI.showTemporaryMessage('❌ No se pudo conectar con el background', true);
    }
    
    initEventListeners();
});

function initEventListeners() {

    document.getElementById('searchInput').addEventListener('input', (e) => {
        StateManager.setFilterText(e.target.value);
        TableRenderer.render();
    });
    
    document.getElementById('groupBtn').addEventListener('click', () => {
        StateManager.setGroupMode(!StateManager.getGroupMode());
        TableRenderer.render();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        BackgroundConnector.sendToBackground('clearRequests');
    });
    
    document.getElementById('compareBtn').addEventListener('click', () => {
        ModalManager.show('compareModal');
    });
    
    document.getElementById('editorBtn').addEventListener('click', () => {
        const selectedRequest = StateManager.getSelectedRequest();
        if (selectedRequest) {
            RequestEditor.load(selectedRequest);
        } else {
            RequestEditor.loadSelector();
        }
        ModalManager.show('editorModal');
    });
    
    document.getElementById('schemaBtn').addEventListener('click', () => {
        ModalManager.show('schemaModal');
        mostrarNullsDetectados();
    });
    
    document.getElementById('compareJsonBtn').addEventListener('click', () => {
        const json1 = document.getElementById('json1').value;
        const json2 = document.getElementById('json2').value;
        const result = JsonComparer.compare(json1, json2);
        
        const resultDiv = document.getElementById('compareResult');
        
        if (result.type === 'info') {
            resultDiv.innerHTML = `<p class="info-message">${result.message}</p>`;
        } else if (result.type === 'success') {
            resultDiv.innerHTML = `<p class="success-message">${result.message}</p>`;
        } else if (result.type === 'error') {
            resultDiv.innerHTML = `<div class="error-message">${result.message}</div>`;
        } else if (result.type === 'differences') {
            resultDiv.innerHTML = result.message + '<h3>📋 Diferencias encontradas:</h3>' + 
                                 JsonComparer.formatDifferences(result.differences);
        }
    });
    
    document.getElementById('sendEditedBtn').addEventListener('click', () => {
        ResendRequest.send();
    });
    
    document.getElementById('requestSelector').addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        if (!selectedValue) return;
        
        const req = RequestFinder.findById(selectedValue);
        if (req) {
            RequestEditor.load(req);
        }
    });
    
    document.getElementById('analizarConSchemaBtn').addEventListener('click', () => {
        const selectedRequest = StateManager.getSelectedRequest();
        if (!selectedRequest) {
            UI.showTemporaryMessage('❌ Seleccioná una petición primero', true);
            return;
        }

        const schemaText = document.getElementById('schemaInput').value;
        if (!schemaText.trim()) {
            UI.showTemporaryMessage('❌ Pegá el JSON de referencia primero', true);
            return;
        }

        try {
            const schemaObj = JSON.parse(schemaText);
            const currentBody = JSON.parse(editBody.value || '{}');
            const camposNull = NullAnalyzer.findNullFields(currentBody);
            const analisis = NullAnalyzer.compareWithSchema(camposNull, schemaObj);
            
            document.getElementById('schemaResult').innerHTML = NullAnalyzer.formatResults(analisis);
        } catch (e) {
            UI.showTemporaryMessage('❌ Error: ' + e.message, true);
        }
    });
    
    document.getElementById('limpiarSchemaBtn').addEventListener('click', () => {
        document.getElementById('schemaInput').value = '';
        document.getElementById('schemaResult').innerHTML = '';
    });
    
    document.getElementById('testNullFieldsBtn').addEventListener('click', () => {
        UI.showTemporaryMessage('🔄 Función en desarrollo', false);
    });
}

function mostrarNullsDetectados() {
    const selectedRequest = StateManager.getSelectedRequest();
    if (!selectedRequest) {
        UI.showTemporaryMessage('❌ Seleccioná una petición primero', true);
        return;
    }

    try {
        const currentBody = JSON.parse(editBody.value || '{}');
        const camposNull = NullAnalyzer.findNullFields(currentBody);
        document.getElementById('schemaResult').innerHTML = NullAnalyzer.showNullsOnly(camposNull);
    } catch (e) {
        console.error('Error mostrando nulls:', e);
        document.getElementById('schemaResult').innerHTML = `<div class="error-message">❌ Error: ${e.message}</div>`;
    }
}