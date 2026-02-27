const RequestGrouper = {
    group(requests) {
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
};

const RequestFinder = {
    findById(id) {
        if (!id) return null;
        
        const requests = StateManager.getRequests();
        let request = requests.find(r => r.id === id);
        if (request) return request;
        
        if (StateManager.getGroupMode()) {
            const groups = RequestGrouper.group(requests);
            const group = groups.find(g => g.id === id || g.originalId === id);
            if (group) return group;
        }
        
        return null;
    }
};

if(!window.RequestGrouper) window.RequestGrouper = RequestGrouper;
if(!window.RequestFinder) window.RequestFinder = RequestFinder;