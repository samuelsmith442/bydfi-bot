// Dashboard state
let earlySignals = [];
let confirmedSignals = [];
const API_URL = '/api/signals';

/**
 * Format price change with appropriate color class
 * @param {string|number} change - Price change percentage
 * @returns {string} HTML string with formatted price change
 */
function formatPriceChange(change) {
    const num = parseFloat(change);
    const sign = num >= 0 ? '+' : '';
    const className = num >= 0 ? 'positive' : 'negative';
    return `<span class="price-change ${className}">${sign}${num.toFixed(2)}%</span>`;
}

/**
 * Render early entry signals to the DOM
 */
function renderEarlySignals() {
    const container = document.getElementById('early-signals');
    
    if (earlySignals.length === 0) {
        container.innerHTML = '<div class="no-data">No early signals detected</div>';
        return;
    }

    container.innerHTML = earlySignals.map((signal, idx) => `
        <div class="signal-item ${signal.type === 'EARLY_LONG' ? 'long' : 'short'}">
            <div class="signal-header">
                <span class="signal-symbol">#${idx + 1} ${signal.symbol}</span>
                <span class="signal-badge badge-early">${signal.confidence.toUpperCase()}</span>
            </div>
            <div class="signal-details">
                ${signal.triggers.join(' • ')}
            </div>
            <div class="signal-price">
                <span class="price-value">$${signal.data.lastPrice}</span>
                ${formatPriceChange(signal.data.priceChange)}
            </div>
        </div>
    `).join('');
}

/**
 * Render confirmed signals to the DOM
 */
function renderConfirmedSignals() {
    const container = document.getElementById('confirmed-signals');
    
    if (confirmedSignals.length === 0) {
        container.innerHTML = '<div class="no-data">No confirmed signals detected</div>';
        return;
    }

    container.innerHTML = confirmedSignals.map((signal, idx) => `
        <div class="signal-item ${signal.score > 0 ? 'long' : 'short'}">
            <div class="signal-header">
                <span class="signal-symbol">#${idx + 1} ${signal.symbol}</span>
                <span class="signal-badge ${signal.score > 0 ? 'badge-long' : 'badge-short'}">
                    ${signal.score > 0 ? '📈 BUY' : '📉 SELL'}
                </span>
            </div>
            <div class="signal-details">
                ${signal.reasons.join(' • ')}
            </div>
            <div class="signal-price">
                <div>
                    <span class="price-value">$${signal.data.lastPrice}</span>
                    ${formatPriceChange(signal.data.priceChange)}
                </div>
                <span class="score ${Math.abs(signal.score) >= 5 ? 'high' : 'medium'}">Score: ${signal.score}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Update the last update timestamp in the UI
 */
function updateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('last-update').textContent = `Last update: ${time}`;
}

/**
 * Fetch signals from the bot API and update the dashboard
 */
async function fetchSignals() {
    try {
        console.log(`[Dashboard] Fetching from: ${API_URL}`);
        const response = await fetch(API_URL);
        console.log(`[Dashboard] Response status: ${response.status}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('[Dashboard] Received data:', data);
        
        earlySignals = data.earlySignals || [];
        confirmedSignals = data.confirmedSignals || [];
        
        console.log(`[Dashboard] Parsed: ${earlySignals.length} early signals, ${confirmedSignals.length} confirmed signals`);
        
        // Update mode display
        if (data.mode) {
            document.getElementById('mode').textContent = `${data.mode.toUpperCase()} Mode`;
        }
        
        updateTime();
        renderEarlySignals();
        renderConfirmedSignals();
        
        console.log(`✅ Dashboard updated: ${earlySignals.length} early, ${confirmedSignals.length} confirmed`);
    } catch (error) {
        console.error('❌ Error fetching signals:', error);
        const errorMsg = `<div class="no-data">⚠️ Cannot connect to bot<br/>Make sure bot is running: npm start<br/>Error: ${error.message}</div>`;
        document.getElementById('early-signals').innerHTML = errorMsg;
        document.getElementById('confirmed-signals').innerHTML = errorMsg;
    }
}

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchSignals();
    setInterval(fetchSignals, 5000); // Refresh every 5 seconds for real-time updates
});
