// PDF Upload
const pdfDropZone = document.getElementById('pdf-drop-zone');
const pdfInput = document.getElementById('pdf-input');

if (pdfDropZone) {
    pdfDropZone.addEventListener('click', () => pdfInput.click());
    
    pdfDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        pdfDropZone.classList.add('dragover');
    });
    
    pdfDropZone.addEventListener('dragleave', () => {
        pdfDropZone.classList.remove('dragover');
    });
    
    pdfDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfDropZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.pdf')) {
            uploadFile(file, 'pdf');
        }
    });
    
    pdfInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            uploadFile(e.target.files[0], 'pdf');
        }
    });
}

// Excel Upload
const excelDropZone = document.getElementById('excel-drop-zone');
const excelInput = document.getElementById('excel-input');

if (excelDropZone) {
    excelDropZone.addEventListener('click', () => excelInput.click());
    
    excelDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        excelDropZone.classList.add('dragover');
    });
    
    excelDropZone.addEventListener('dragleave', () => {
        excelDropZone.classList.remove('dragover');
    });
    
    excelDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        excelDropZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls'))) {
            uploadFile(file, 'excel');
        }
    });
    
    excelInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            uploadFile(e.target.files[0], 'excel');
        }
    });
}

// Web Scraping
const scrapeBtn = document.getElementById('scrape-btn');
const webUrl = document.getElementById('web-url');

if (scrapeBtn) {
    scrapeBtn.addEventListener('click', () => {
        const url = webUrl.value.trim();
        if (!url) {
            showToast('Ingresa una URL', 'error');
            return;
        }
        
        scrapeWeb(url);
    });
}

async function uploadFile(file, type) {
    const progressEl = document.getElementById(`${type}-progress`);
    const fillEl = document.getElementById(`${type}-progress-fill`);
    const statusEl = document.getElementById(`${type}-status`);
    
    progressEl.style.display = 'block';
    fillEl.style.width = '30%';
    statusEl.textContent = 'Subiendo archivo...';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        fillEl.style.width = '60%';
        statusEl.textContent = 'Procesando...';
        
        const res = await fetch(`/api/upload/${type}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            fillEl.style.width = '100%';
            statusEl.textContent = `Completado: ${data.records} registros`;
            showToast(data.message, 'success');
            loadUploadHistory();
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
        
    } catch (error) {
        fillEl.style.width = '100%';
        fillEl.style.background = 'var(--danger)';
        statusEl.textContent = `Error: ${error.message}`;
        showToast('Error al procesar archivo', 'error');
    }
    
    setTimeout(() => {
        progressEl.style.display = 'none';
        fillEl.style.width = '0%';
        fillEl.style.background = 'var(--primary)';
    }, 3000);
}

async function scrapeWeb(url) {
    const progressEl = document.getElementById('web-progress');
    const fillEl = document.getElementById('web-progress-fill');
    const statusEl = document.getElementById('web-status');
    
    progressEl.style.display = 'block';
    fillEl.style.width = '30%';
    statusEl.textContent = 'Conectando...';
    
    try {
        fillEl.style.width = '60%';
        statusEl.textContent = 'Scrapeando pagina...';
        
        const res = await fetch('/api/upload/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            fillEl.style.width = '100%';
            statusEl.textContent = `Completado: ${data.records} registros`;
            showToast(data.message, 'success');
            loadUploadHistory();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        fillEl.style.width = '100%';
        fillEl.style.background = 'var(--danger)';
        statusEl.textContent = `Error: ${error.message}`;
        showToast('Error al scrapear', 'error');
    }
    
    setTimeout(() => {
        progressEl.style.display = 'none';
        fillEl.style.width = '0%';
        fillEl.style.background = 'var(--primary)';
    }, 3000);
}

async function loadUploadHistory() {
    try {
        const res = await fetch('/api/upload/history');
        const uploads = await res.json();
        
        const tbody = document.querySelector('#upload-history-table tbody');
        tbody.innerHTML = '';
        
        uploads.forEach(upload => {
            const typeBadge = getTypeBadge(upload.file_type);
            const statusBadge = getStatusBadge(upload.status);
            
            tbody.innerHTML += `
                <tr>
                    <td>${escapeHtml(upload.filename)}</td>
                    <td>${typeBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${upload.records_imported}</td>
                    <td>${new Date(upload.created_at).toLocaleDateString()}</td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function getTypeBadge(type) {
    const types = {
        'pdf': '<span class="badge" style="background:#dc2626">PDF</span>',
        'excel': '<span class="badge" style="background:#16a34a">Excel</span>',
        'web': '<span class="badge" style="background:#2563eb">Web</span>'
    };
    return types[type] || type;
}

function getStatusBadge(status) {
    const statuses = {
        'completed': '<span class="badge badge-success">Completado</span>',
        'processing': '<span class="badge badge-warning">Procesando</span>',
        'error': '<span class="badge badge-danger">Error</span>'
    };
    return statuses[status] || status;
}
