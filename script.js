document.addEventListener('DOMContentLoaded', () => {
    // 1. Navegação de Abas (Tabs)
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;

            navLinks.forEach(l => l.classList.remove('is-active'));
            link.classList.add('is-active');

            views.forEach(view => {
                view.classList.remove('is-active');
                if (view.id === targetId) view.classList.add('is-active');
            });
        });
    });

    // 2. Lógica do Webhook e Logs
    const btnTestWebhook = document.getElementById('btn-test-webhook');
    const webhookFeedback = document.getElementById('webhook-feedback');
    const logsContainer = document.getElementById('webhook-logs');

    function appendLog(statusTag, type, message) {
        if (logsContainer.querySelector('.text-muted')) {
            logsContainer.innerHTML = '';
        }
        const time = new Date().toLocaleTimeString('pt-BR');
        const statusClass = type === 'success' ? 'status-ok' : 'status-error';
        const logEl = document.createElement('div');
        logEl.className = 'log-entry';
        logEl.innerHTML = `<span class="log-time">[${time}]</span> <span class="${statusClass}">${statusTag}</span> ${message}`;
        logsContainer.appendChild(logEl);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    btnTestWebhook.addEventListener('click', async () => {
        const url = document.getElementById('webhook-url').value.trim();
        const msg = document.getElementById('webhook-msg').value.trim();

        if (!url) {
            webhookFeedback.textContent = 'Insira uma URL válida.';
            webhookFeedback.className = 'feedback-msg error';
            appendLog('[Aviso]', 'error', 'Tentativa de envio cancelada (URL vazia).');
            return;
        }

        btnTestWebhook.textContent = "Enviando...";
        btnTestWebhook.disabled = true;
        webhookFeedback.textContent = '';

        try {
            const payload = { content: msg || "Mensagem de teste do Dashboard de Conciliação!" };
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                webhookFeedback.textContent = '✓ Mensagem enviada!';
                webhookFeedback.className = 'feedback-msg success';
                appendLog(`[${response.status} OK]`, 'success', `Requisição POST bem sucedida para: ${url}`);
            } else {
                webhookFeedback.textContent = `Erro: ${response.status}`;
                webhookFeedback.className = 'feedback-msg error';
                appendLog(`[${response.status} Erro]`, 'error', `Resposta do servidor: ${response.statusText}`);
            }
        } catch (error) {
            webhookFeedback.textContent = 'Erro de conexão/CORS.';
            webhookFeedback.className = 'feedback-msg error';
            appendLog('[Erro de Rede]', 'error', `Bloqueio de CORS ou Servidor Offline. Detalhes: ${error.message}`);
        } finally {
            btnTestWebhook.textContent = "Enviar Teste";
            btnTestWebhook.disabled = false;
        }
    });

    // 3. Lógica de Formatação e Painel de Testes
    const btnSaveTxn = document.getElementById('btn-save-txn');
    const btnDeleteTxn = document.getElementById('btn-delete-txn');
    const tableBody = document.querySelector('#transactions-table tbody');

    const valueInput = document.getElementById('test-value');
    const currencyInput = document.getElementById('test-currency');

    // Função super robusta para extrair e formatar qualquer bagunça numérica
    // Função super robusta para extrair e formatar qualquer bagunça numérica
    function formatCurrency(rawValue, rawCurrencyChoice) {
        let symbol = rawCurrencyChoice.split(' ')[0].trim();
        if (!symbol) symbol = 'R$';

        const usSystemCurrencies = ['$', '£'];
        const usesUsSystem = usSystemCurrencies.some(curr => rawCurrencyChoice.includes(curr));
        const localeString = usesUsSystem ? 'en-US' : 'pt-BR';

        let num = 0;
        if (rawValue) {
            let str = rawValue.replace(/[^\d.,]/g, '');

            if (str) {
                let lastDot = str.lastIndexOf('.');
                let lastComma = str.lastIndexOf(',');

                if (lastDot > -1 && lastComma > -1) {
                    if (lastDot > lastComma) {
                        str = str.replace(/,/g, '');
                    } else {
                        str = str.replace(/\./g, '').replace(',', '.');
                    }
                }
                else if (lastComma > -1) {
                    str = str.replace(',', '.');
                }
                else if (lastDot > -1) {
                    let parts = str.split('.');
                    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
                        str = str.replace(/\./g, '');
                    }
                }

                num = parseFloat(str);
                if (isNaN(num)) num = 0;
            }
        }

        // Aplica o locale dinamicamente no retorno
        return `${symbol} ${num.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // NOVIDADE: Auto-formatação quando o usuário sai do campo de valor
    valueInput.addEventListener('blur', () => {
        if (valueInput.value.trim() !== '') {
            valueInput.value = formatCurrency(valueInput.value, currencyInput.value);
        }
    });

    // NOVIDADE: Atualiza o campo de valor instantaneamente se o usuário mudar a moeda
    currencyInput.addEventListener('change', () => {
        if (valueInput.value.trim() !== '') {
            valueInput.value = formatCurrency(valueInput.value, currencyInput.value);
        }
    });

    btnSaveTxn.addEventListener('click', () => {
        const id = document.getElementById('test-id').value.trim();
        const event = document.getElementById('test-event').value;
        const rawValue = valueInput.value.trim();
        const currencySelection = currencyInput.value;
        const statusType = document.getElementById('test-status').value;

        if (!id) return alert('Insira um ID de transação (ex: txn_001)');

        // Força a formatação antes de ir para a tabela (garantia extra)
        const finalValue = formatCurrency(rawValue, currencySelection);
        valueInput.value = finalValue;

        const existingRow = document.getElementById(`row-${id}`);

        let statusBadge = '';
        let trailHtml = '';
        let isFlagged = false;

        if (statusType === 'done') {
            statusBadge = '<span class="status status--done">Conciliado</span>';
            trailHtml = '<span class="trail-node is-done"></span><span class="trail-line is-done"></span><span class="trail-node is-done"></span>';
        } else if (statusType === 'pending') {
            statusBadge = '<span class="status status--pending">Aguardando</span>';
            trailHtml = '<span class="trail-node is-done"></span><span class="trail-line"></span><span class="trail-node is-current"></span>';
        } else if (statusType === 'alert') {
            statusBadge = '<span class="status status--alert">Divergente</span>';
            trailHtml = '<span class="trail-node is-done"></span><span class="trail-line"></span><span class="trail-node is-alert"></span>';
            isFlagged = true;
        }

        const rowInnerHtml = `
      <td class="mono">${id}</td>
      <td>${event}</td>
      <td class="mono">${finalValue}</td>
      <td>
        <div class="trail" role="img">${trailHtml}</div>
      </td>
      <td>${statusBadge}</td>
      <td class="mono muted">agora</td>
    `;

        if (existingRow) {
            existingRow.innerHTML = rowInnerHtml;
            existingRow.className = isFlagged ? 'is-flagged' : '';
        } else {
            const newRow = document.createElement('tr');
            newRow.id = `row-${id}`;
            newRow.className = isFlagged ? 'is-flagged' : '';
            newRow.innerHTML = rowInnerHtml;
            tableBody.insertBefore(newRow, tableBody.firstChild);
        }
    });

    btnDeleteTxn.addEventListener('click', () => {
        const id = document.getElementById('test-id').value.trim();
        if (!id) return;
        const existingRow = document.getElementById(`row-${id}`);
        if (existingRow) {
            existingRow.remove();
        } else {
            alert('ID não encontrado na tabela.');
        }
    });
});