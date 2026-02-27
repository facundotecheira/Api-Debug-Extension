let requests = [];
let ports = [];
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === 'POST' || details.method === 'PUT' || details.method === 'DELETE') {
      let requestBody = null;
      
      if (details.requestBody) {
        if (details.requestBody.raw) {
          const decoder = new TextDecoder('utf-8');
          requestBody = details.requestBody.raw.map(item => {
            if (item.bytes) {
              return decoder.decode(item.bytes);
            }
            return item;
          }).join('');
        } else if (details.requestBody.formData) {
          requestBody = details.requestBody.formData;
        }
      }
      
      const request = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        timestamp: details.timeStamp,
        requestBody: requestBody,
        requestHeaders: [],
        status: 'pending',
        responseHeaders: [],
        responseBody: null
      };
      
      requests.push(request);
      notifyAll('newRequest', request);
    }
    return {};
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const request = requests.find(r => r.id === details.requestId);
    if (request) {
      request.requestHeaders = details.requestHeaders || [];
      
      const contentType = details.requestHeaders?.find(h => 
        h.name.toLowerCase() === 'content-type'
      );
      if (contentType) {
        request.contentType = contentType.value;
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const request = requests.find(r => r.id === details.requestId);
    if (request) {
      request.responseHeaders = details.responseHeaders || [];
    }
    return { responseHeaders: details.responseHeaders };
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const request = requests.find(r => r.id === details.requestId);
    if (request) {
      request.status = details.statusCode;
      request.duration = details.timeStamp - request.timestamp;
      
      fetch(details.url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(res => res.text())
      .then(body => {
        request.responseBody = body;
        notifyAll('requestCompleted', request);
      })
      .catch(() => {
        request.responseBody = 'Error al obtener respuesta';
        notifyAll('requestCompleted', request);
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const request = requests.find(r => r.id === details.requestId);
    if (request) {
      request.status = 'error';
      request.error = details.error;
      request.duration = details.timeStamp - request.timestamp;
      notifyAll('requestError', request);
    }
  },
  { urls: ['<all_urls>'] }
);

function notifyAll(event, data) {
  ports.forEach(port => {
    try {
      port.postMessage({ event, data });
    } catch (e) {
      console.error('Error notificando:', e);
    }
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'debug-panel') {
    ports.push(port);
    
    port.onMessage.addListener((msg) => {
      switch(msg.action) {
        case 'getRequests':
          port.postMessage({ event: 'allRequests', data: requests });
          break;
        case 'clearRequests':
          requests = [];
          port.postMessage({ event: 'cleared', data: [] });
          break;
        case 'resendRequest':
          resendRequest(msg.data, port);
          break;
      }
    });
    
    port.onDisconnect.addListener(() => {
      const index = ports.indexOf(port);
      if (index > -1) ports.splice(index, 1);
    });
  }
});

async function resendRequest(data, port) {
  const { url, method, headers, body, originalId } = data;
  
  try {
    if (!url) {
      port.postMessage({ event: 'resendError', data: 'URL vacía' });
      return;
    }

    const fetchOptions = {
      method: method,
      headers: {
        ...headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors',
      cache: 'no-cache'
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }

    console.log('🔄 Reenviando petición:', { url, method });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
    
    let responseBody;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      const text = await response.text();
      try {
        responseBody = JSON.parse(text);
      } catch (e) {
        responseBody = text;
      }
    }
    
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    port.postMessage({ 
      event: 'resendResult', 
      data: {
        url: url,
        method: method,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        ok: response.ok,
        originalId: originalId
      }
    });
    
  } catch (error) {
    console.error('❌ Error en resendRequest:', error);
    
    let errorMessage = 'Error desconocido';
    if (error.name === 'AbortError') {
      errorMessage = 'Timeout: La petición tardó demasiado';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Error de red: ¿Está corriendo la API?';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    port.postMessage({ event: 'resendError', data: errorMessage });
  }
}