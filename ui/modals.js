const compareModal = document.getElementById('compareModal');
const editorModal = document.getElementById('editorModal');
const nullTestModal = document.getElementById('nullTestModal');
const schemaModal = document.getElementById('schemaModal');

const ModalManager = {
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    },
    
    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    },
    
    hideAll() {
        compareModal.style.display = 'none';
        editorModal.style.display = 'none';
        nullTestModal.style.display = 'none';
        schemaModal.style.display = 'none';
    },
    
    initEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
        
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', ModalManager.hideAll);
        });
    }
};

if(!window.ModalManager) window.ModalManager = ModalManager;