const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadDashboard();
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const page = item.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');
            
            loadPageData(page);
        });
    });
}

function loadPageData(page) {
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'upload': loadUploadHistory(); break;
        case 'products': loadProducts(); break;
        case 'compare': applyFilters(); break;
    }
}

async function loadDashboard() {
    try {
        const statsRes = await fetch(`${API_BASE}/api/products/stats`);
        const stats = await statsRes.json();
        
        document.getElementById('total-products').textContent = stats.total_products;
        document.getElementById('total-suppliers').textContent = stats.total_suppliers;
        document.getElementById('valid-offers').textContent = stats.valid_offers;
        document.getElementById('invalid-offers').textContent = stats.invalid_offers;
        
        const dealsRes = await fetch(`${API_BASE}/api/compare/best?min_qty=5&min_months=6`);
        const deals = await dealsRes.json();
        
        const tbody = document.querySelector('#best-deals-table tbody');
        tbody.innerHTML = '';
        
        deals.results.slice(0, 10).forEach(deal => {
            tbody.innerHTML += `
                <tr>
                    <td>${escapeHtml(deal.barcode || '-')}</td>
                    <td>${escapeHtml(deal.product_name)}</td>
                    <td>${escapeHtml(deal.supplier_name)}</td>
                    <td><strong>$${deal.price.toFixed(2)}</strong></td>
                    <td>${deal.quantity}</td>
                    <td>${deal.months_until_expiration ? deal.months_until_expiration + ' meses' : 'N/A'}</td>
                    <td>${escapeHtml(deal.special_conditions || '-')}</td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadProducts(search = '') {
    try {
        const url = search 
            ? `${API_BASE}/api/products/?search=${encodeURIComponent(search)}`
            : `${API_BASE}/api/products/`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        const tbody = document.querySelector('#products-table tbody');
        tbody.innerHTML = '';
        
        for (const product of data.products) {
            const priceRes = await fetch(`${API_BASE}/api/products/${product.id}`);
            const priceData = await priceRes.json();
            
            const prices = priceData.prices;
            let minPrice = '-';
            let supplier = '-';
            let qty = 0;
            let expiry = '-';
            
            if (prices.length > 0) {
                const cheapest = prices.reduce((min, p) => p.price < min.price ? p : min, prices[0]);
                minPrice = '$' + cheapest.price.toFixed(2);
                supplier = cheapest.supplier_name;
                qty = cheapest.quantity;
                expiry = cheapest.expiration_date || '-';
            }
            
            tbody.innerHTML += `
                <tr>
                    <td>${escapeHtml(product.barcode || '-')}</td>
                    <td>${escapeHtml(product.name)}</td>
                    <td><strong>${minPrice}</strong></td>
                    <td>${escapeHtml(supplier)}</td>
                    <td>${qty}</td>
                    <td>${expiry}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">Eliminar</button></td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function deleteProduct(id) {
    if (!confirm('Eliminar este producto y todos sus precios?')) return;
    
    try {
        await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
        showToast('Producto eliminado', 'success');
        loadProducts();
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => loadProducts(e.target.value));
    }
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
