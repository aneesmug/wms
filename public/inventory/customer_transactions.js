// public/js/customer_transactions.js

document.addEventListener('DOMContentLoaded', () => {
    const customerNameHeader = document.getElementById('customerNameHeader');
    const customerBalance = document.getElementById('customerBalance');
    const transactionForm = document.getElementById('transactionForm');
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    const transactionOrderSelect = document.getElementById('transactionOrder');
    const addTransactionSection = document.getElementById('addTransactionSection');
    const logoutBtn = document.getElementById('logoutBtn');

    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('customer_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

    if (transactionForm) transactionForm.addEventListener('submit', handleSaveTransaction);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    initializePage();

    async function initializePage() {
        if (!customerId) {
            showMessageBox('No customer ID provided in URL.', 'error');
            customerNameHeader.textContent = 'Error: Customer Not Found';
            return;
        }
        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        if (addTransactionSection) {
            addTransactionSection.classList.toggle('d-none', !canManage);
        }
        await Promise.all([
            loadCustomerDetails(),
            loadTransactions(),
            loadCustomerOrdersForDropdown()
        ]);
    }

    async function loadCustomerDetails() {
        const response = await fetchData(`api/customers.php?id=${customerId}`);
        if (response?.success) {
            const customer = response.data;
            customerNameHeader.textContent = `Transactions for ${customer.customer_name}`;
            const balanceFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(customer.balance || 0);
            customerBalance.textContent = balanceFormatted;
            customerBalance.classList.toggle('text-danger', (customer.balance || 0) < 0);
            customerBalance.classList.toggle('text-success', (customer.balance || 0) >= 0);
        } else {
            customerNameHeader.textContent = 'Could not load customer details.';
        }
    }

    async function loadTransactions() {
        if (!transactionsTableBody) return;
        transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Loading...</td></tr>`;
        const response = await fetchData(`api/customer_transactions.php?customer_id=${customerId}`);
        transactionsTableBody.innerHTML = '';
        if (response?.success && Array.isArray(response.data)) {
            if (response.data.length === 0) {
                transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No transactions found for this customer.</td></tr>`;
                return;
            }
            response.data.forEach(tx => {
                const row = transactionsTableBody.insertRow();
                const isCredit = ['payment', 'credit'].includes(tx.transaction_type);
                row.innerHTML = `<td>${new Date(tx.transaction_date).toLocaleString()}</td><td><span class="badge ${isCredit ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}">${tx.transaction_type}</span></td><td class="fw-bold ${isCredit ? 'text-success' : 'text-danger'}">${isCredit ? '+' : '-'} ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)}</td><td>${tx.order_number || 'N/A'}</td><td>${tx.notes || ''}</td><td>${tx.created_by_user || 'System'}</td>`;
            });
        } else {
            transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Error loading transactions.</td></tr>`;
        }
    }

    async function loadCustomerOrdersForDropdown() {
        if (!transactionOrderSelect) return;
        const response = await fetchData('api/outbound.php');
        transactionOrderSelect.innerHTML = '<option value="">None</option>';
        if (response?.success && Array.isArray(response.data)) {
            response.filter(order => order.customer_id == customerId).forEach(order => {
                transactionOrderSelect.add(new Option(`Order #${order.order_number} (${order.status})`, order.order_id));
            });
        }
    }

    async function handleSaveTransaction(event) {
        event.preventDefault();
        const saveBtn = document.getElementById('saveTransactionBtn');
        const data = {
            customer_id: customerId,
            transaction_type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value),
            order_id: document.getElementById('transactionOrder').value || null,
            notes: document.getElementById('transactionNotes').value.trim()
        };
        if (!data.transaction_type || isNaN(data.amount) || data.amount <= 0) {
            showMessageBox('Please provide a valid transaction type and a positive amount.', 'error');
            return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        const result = await fetchData('api/customer_transactions.php', 'POST', data);
        if (result?.success) {
            showMessageBox('Transaction saved successfully!', 'success');
            transactionForm.reset();
            await Promise.all([loadCustomerDetails(), loadTransactions()]);
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Transaction';
    }
    
    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
