const UI = {
    showTemporaryMessage(text, isError = false) {
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
    },
    
    addStyles() {
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
    }
};

if(!window.UI) window.UI = UI;