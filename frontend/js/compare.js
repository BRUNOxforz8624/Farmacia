const compareSearch = document.getElementById('compare-search');
const minQty = document.getElementById('min-qty');
const minMonths = document.getElementById('min-months');
const applyFiltersBtn = document.getElementById('apply-filters');
const clearFiltersBtn = document.getElementById('clear-filters');
const filterSupplier = document.getElementById('filter-supplier');
const minPrice = document.getElementById('min-price');
const maxPrice = document.getElementById('max-price');
const sortBy = document.getElementById('sort-by');

let allResults = [];

if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyFilters);
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearFilters);
}

if (compareSearch) {
    compareSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
}

function clearFilters() {
    if (compareSearch) compareSearch.value = '';
    if (minQty) minQty.value = '5';
    if (minMonths) minMonths.value = '6';
    if (filterSupplier) filterSupplier.value = '';
    if (minPrice) minPrice.value = '';
    if (maxPrice) maxPrice.value = '';
    if (sortBy) sortBy.value = 'price_asc';
    applyFilters();
}

async function applyFilters() {
    const search = compareSearch?.value.trim() || '';
    const qty = minQty?.value || 5;
    const months = minMonths?.value || 6;
    
    try {
        let url;
        
        if (search) {
            url = `/api/compare/product?q=${encodeURIComponent(search)}&min_qty=${qty}&min_months=${months}`;
        } else {
            url = `/api/compare/best?min_qty=${qty}&min_months=${months}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        allResults = data.results || [];
        populateSupplierFilter(allResults);
        applyClientFilters();
        
    } catch (error) {
        console.error('Error comparing:', error);
        showToast('Error al comparar precios', 'error');
    }
}

function populateSupplierFilter(results) {
    if (!filterSupplier) return;
    
    const suppliers = [...new Set(results.map(r => r.supplier_name).filter(Boolean))];
    const current = filterSupplier.value;
    
    filterSupplier.innerHTML = '<option value="">Todos</option>';
    suppliers.sort().forEach(s => {
        filterSupplier.innerHTML += `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`;
    });
}

function applyClientFilters() {
    let filtered = [...allResults];
    
    const supplier = filterSupplier?.value || '';
    const pMin = minPrice?.value ? parseFloat(minPrice.value) : null;
    const pMax = maxPrice?.value ? parseFloat(maxPrice.value) : null;
    const sort = sortBy?.value || 'price_asc';
    
    if (supplier) {
        filtered = filtered.filter(r => r.supplier_name === supplier);
    }
    
    if (pMin !== null) {
        filtered = filtered.filter(r => r.price >= pMin);
    }
    
    if (pMax !== null) {
        filtered = filtered.filter(r => r.price <= pMax);
    }
    
    switch (sort) {
        case 'price_asc':
            filtered.sort((a, b) => a.price - b.price);
            break;
        case 'price_desc':
            filtered.sort((a, b) => b.price - a.price);
            break;
        case 'quantity_desc':
            filtered.sort((a, b) => b.quantity - a.quantity);
            break;
        case 'expiration_desc':
            filtered.sort((a, b) => (b.months_until_expiration || 0) - (a.months_until_expiration || 0));
            break;
    }
    
    displayResults(filtered);
}

if (filterSupplier) filterSupplier.addEventListener('change', applyClientFilters);
if (minPrice) minPrice.addEventListener('change', applyClientFilters);
if (maxPrice) maxPrice.addEventListener('change', applyClientFilters);
if (sortBy) sortBy.addEventListener('change', applyClientFilters);

function displayResults(results) {
    const tbody = document.querySelector('#compare-table tbody');
    const countBadge = document.getElementById('results-count');
    
    countBadge.textContent = results.length;
    tbody.innerHTML = '';
    
    if (results.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; color:var(--gray-400); padding:60px 20px">
                    <div class="empty-state">
                        <h3>No se encontraron resultados</h3>
                        <p>Intenta ajustar los filtros de busqueda</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    results.forEach(item => {
        const statusClass = item.is_valid ? 'status-valid' : 'status-invalid';
        const statusText = item.is_valid ? 'Valida' : 'Rechazada';
        
        let expiryText = 'N/A';
        if (item.months_until_expiration !== null) {
            expiryText = `${item.months_until_expiration} meses`;
        }
        
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(item.barcode || '-')}</td>
                <td>${escapeHtml(item.product_name)}</td>
                <td>${escapeHtml(item.supplier_name)}</td>
                <td><strong>$${item.price.toFixed(2)}</strong></td>
                <td>${item.quantity} uds</td>
                <td>${expiryText}</td>
                <td>${escapeHtml(item.special_conditions || '-')}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    applyFilters();
});
