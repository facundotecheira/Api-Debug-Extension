const tableBody = document.getElementById('tableBody');
const groupHeader = document.getElementById('groupHeader');
const groupBtn = document.getElementById('groupBtn');

const TableRenderer = {
    render() {
        const requests = StateManager.getRequests();
        const filterText = StateManager.getFilterText();
        const groupMode = StateManager.getGroupMode();
        const selectedRequest = StateManager.getSelectedRequest();
        
        let filteredRequests = TableRenderer.filterRequests(requests, filterText);
        let dataToRender = groupMode ? RequestGrouper.group(filteredRequests) : filteredRequests;
        
        let html = '';
        dataToRender.forEach(req => {
            const isSelected = selectedRequest && selectedRequest.id === req.id;
            const statusClass = TableRenderer.getStatusClass(req.status);
            const duration = req.duration ? TableRenderer.formatDuration(req.duration) : 'Pendiente';
            const methodClass = TableRenderer.getMethodClass(req.method);
            
            html += `<tr class="${isSelected ? 'selected' : ''}" data-id="${req.id}">
                <td><span class="method-badge method-${methodClass}">${req.method || 'GET'}</span></td>
                <td>${TableRenderer.truncateUrl(req.url)}</td>
                <td><span class="status-badge status-${statusClass}">${req.status || 'Pendiente'}</span></td>
                <td>${duration}</td>
                ${groupMode ? `<td>${req.count || 1}</td>` : ''}
            </tr>`;
        });
        
        tableBody.innerHTML = html;
        
        groupHeader.style.display = groupMode ? 'table-cell' : 'none';
        groupBtn.textContent = groupMode ? 'Desagrupar' : 'Agrupar';
        
        TableRenderer.attachRowListeners();
    },
    
    attachRowListeners() {
        document.querySelectorAll('#tableBody tr').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const request = RequestFinder.findById(id);
                if (request) {
                    StateManager.setSelectedRequest(request);
                    DetailsPanel.show(request);
                    RequestEditor.load(request);
                    TableRenderer.render();
                }
            });
        });
    },
    
    filterRequests(requests, text) {
        if (!text) return requests;
        return requests.filter(req => 
            req.url.toLowerCase().includes(text.toLowerCase())
        );
    },
    
    getMethodClass(method) {
        if (!method) return 'get';
        return method.toLowerCase();
    },
    
    getStatusClass(status) {
        if (!status || status === 'pending') return 'pending';
        if (status >= 200 && status < 300) return 'success';
        if (status >= 400) return 'error';
        return 'warning';
    },
    
    formatDuration(duration) {
        if (!duration) return 'Pendiente';
        return duration < 1000 ? `${duration}ms` : `${(duration/1000).toFixed(2)}s`;
    },
    
    truncateUrl(url) {
        if (!url) return 'N/A';
        return url.length > 50 ? url.substring(0, 47) + '...' : url;
    }
};

if(!window.TableRenderer) window.TableRenderer = TableRenderer;