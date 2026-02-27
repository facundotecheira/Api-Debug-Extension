const detailsPanel = document.getElementById('detailsPanel');
const detailsContent = document.getElementById('detailsContent');
const copyResponseBtn = document.getElementById('copyResponseBtn');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');

const DetailsPanel = {
    show(request) {
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
                    DetailsPanel.showTab(btn.dataset.tab);
                });
            });
            
            document.getElementById('copyResponseBtn').onclick = () => DetailsPanel.copyResponse(request);
            document.getElementById('closeDetailsBtn').onclick = DetailsPanel.hide;
        }
        
        DetailsPanel.showTab('response');
    },
    
    hide() {
        detailsPanel.style.display = 'none';
        StateManager.setSelectedRequest(null);
        TableRenderer.render();
    },
    
    showTab(tab) {
        const request = StateManager.getSelectedRequest();
        if (!request) return;
        
        let content = '';
        
        if (tab === 'response') {
            content = request.responseBody || 'No hay respuesta disponible';
            
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
    },
    
    copyResponse(request) {
        let content = request.responseBody || 'No hay respuesta';
        
        if (typeof content === 'object') {
            try {
                content = JSON.stringify(content, null, 2);
            } catch (e) {
                content = String(content);
            }
        } else if (typeof content === 'string') {
            try {
                const parsed = JSON.parse(content);
                content = JSON.stringify(parsed, null, 2);
            } catch (e) {}
        }
        
        navigator.clipboard.writeText(content)
            .then(() => UI.showTemporaryMessage('✅ Copiado al portapapeles'))
            .catch(() => UI.showTemporaryMessage('❌ Error al copiar'));
    }
};

if(!window.DetailsPanel) window.DetailsPanel = DetailsPanel;