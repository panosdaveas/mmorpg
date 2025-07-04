// src/web3/TradeCenter.js
import { SquidManager } from '../../web3/SquidManager.js';

export class TradeCenter {
    constructor(localPlayer, multiplayerManager) {
        this.localPlayer = localPlayer;
        this.multiplayerManager = multiplayerManager;
        this.squidManager = new SquidManager();
        this.isVisible = false;
        this.isInitialized = false;

        // UI Elements
        this.container = null;
        this.loadingElement = null;

        // Trade data
        this.selectedRecipient = null;
        this.fromChain = null;
        this.toChain = null;
        this.amount = '';
        this.route = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            await this.squidManager.initialize();
            this.createUI();
            this.isInitialized = true;

            // Show mode indicator
            if (this.squidManager.isMockMode()) {
                console.log("TradeCenter initialized in MOCK MODE (for development)");
                this.showStatus("🔧 Running in development mode - trades are simulated", "info");
            } else {
                console.log("TradeCenter initialized successfully with Squid Router");
                this.showStatus("✅ Connected to Squid Router", "success");
            }
        } catch (error) {
            console.error("Failed to initialize TradeCenter:", error);
            this.showError("Failed to initialize trading system");
        }
    }

    createUI() {
        // Main container
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            border: 2px solid #444;
            font-family: monospace;
            font-size: 14px;
            z-index: 2000;
            width: 400px;
            display: none;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        this.container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #00ff00;">🔄 Trade Center</h3>
                <button id="trade-close" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">✕</button>
            </div>
            
            <div id="trade-loading" style="text-align: center; padding: 20px; display: none;">
                <div>🔄 Initializing...</div>
            </div>
            
            <div id="trade-content">
                <!-- Recipient Selection -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ffff00;">Recipient Player:</label>
                    <select id="recipient-select" style="width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #666; border-radius: 3px;">
                        <option value="">Select a player...</option>
                    </select>
                </div>

                <!-- From Chain -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ffff00;">From Chain:</label>
                    <select id="from-chain-select" style="width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #666; border-radius: 3px;">
                        <option value="">Select source chain...</option>
                    </select>
                </div>

                <!-- To Chain -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ffff00;">To Chain:</label>
                    <select id="to-chain-select" style="width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #666; border-radius: 3px;">
                        <option value="">Select destination chain...</option>
                    </select>
                </div>

                <!-- Amount -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ffff00;">Amount:</label>
                    <input type="number" id="amount-input" placeholder="0.0" step="0.000001" min="0" 
                           style="width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #666; border-radius: 3px;">
                </div>

                <!-- Route Info -->
                <div id="route-info" style="margin-bottom: 15px; padding: 10px; background: rgba(255, 255, 0, 0.1); border-radius: 5px; display: none;">
                    <div style="color: #ffff00; margin-bottom: 5px;">Route Preview:</div>
                    <div id="route-details" style="font-size: 12px;"></div>
                </div>

                <!-- Buttons -->
                <div style="display: flex; gap: 10px;">
                    <button id="get-quote-btn" style="flex: 1; padding: 10px; background: #0066cc; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        Get Quote
                    </button>
                    <button id="execute-trade-btn" style="flex: 1; padding: 10px; background: #00aa00; color: white; border: none; border-radius: 3px; cursor: pointer;" disabled>
                        Execute Trade
                    </button>
                </div>

                <!-- Status -->
                <div id="trade-status" style="margin-top: 15px; padding: 10px; border-radius: 5px; display: none;"></div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.setupEventListeners();
        this.populateChainSelects();
    }

    setupEventListeners() {
        // Close button
        document.getElementById('trade-close').addEventListener('click', () => {
            this.hide();
        });

        // Recipient selection
        document.getElementById('recipient-select').addEventListener('change', (e) => {
            this.selectedRecipient = e.target.value;
            this.updateToChain();
        });

        // Chain selections
        document.getElementById('from-chain-select').addEventListener('change', (e) => {
            this.fromChain = parseInt(e.target.value);
        });

        document.getElementById('to-chain-select').addEventListener('change', (e) => {
            this.toChain = parseInt(e.target.value);
        });

        // Amount input
        document.getElementById('amount-input').addEventListener('input', (e) => {
            this.amount = e.target.value;
        });

        // Get quote button
        document.getElementById('get-quote-btn').addEventListener('click', () => {
            this.getQuote();
        });

        // Execute trade button
        document.getElementById('execute-trade-btn').addEventListener('click', () => {
            this.executeTrade();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    populateChainSelects() {
        const chains = this.squidManager.getSupportedChains();
        const fromSelect = document.getElementById('from-chain-select');
        const toSelect = document.getElementById('to-chain-select');

        // Clear existing options (except first)
        fromSelect.innerHTML = '<option value="">Select source chain...</option>';
        toSelect.innerHTML = '<option value="">Select destination chain...</option>';

        chains.forEach(chain => {
            const option = `<option value="${chain.chainId}">${chain.chainName} (${chain.nativeCurrency.symbol})</option>`;
            fromSelect.innerHTML += option;
            toSelect.innerHTML += option;
        });
    }

    updateRecipientList() {
        const recipientSelect = document.getElementById('recipient-select');
        recipientSelect.innerHTML = '<option value="">Select a player...</option>';

        const remotePlayers = this.multiplayerManager.getRemotePlayers();

        Object.entries(remotePlayers).forEach(([socketId, player]) => {
            const address = "0x1c08Ad51b53C9DEaAD8e10C4a208d56a2Bd2cB8d";
            const chainId = player.getAttribute('chainId');

            if (address) {
                const displayName = `Player ${socketId.slice(0, 6)} (${address.slice(0, 6)}...${address.slice(-4)})`;
                recipientSelect.innerHTML += `<option value="${socketId}" data-address="${address}" data-chain="${chainId}">${displayName}</option>`;
            }
        });
    }

    updateToChain() {
        if (!this.selectedRecipient) return;

        const recipientSelect = document.getElementById('recipient-select');
        const selectedOption = recipientSelect.querySelector(`option[value="${this.selectedRecipient}"]`);

        if (selectedOption) {
            const recipientChain = selectedOption.getAttribute('data-chain');
            if (recipientChain) {
                document.getElementById('to-chain-select').value = recipientChain;
                this.toChain = parseInt(recipientChain);
            }
        }
    }

    async getQuote() {
        if (!this.validateInputs()) return;

        this.showStatus('Getting quote...', 'info');

        try {
            const fromToken = this.squidManager.getNativeToken(this.fromChain);
            const toToken = this.squidManager.getNativeToken(this.toChain);
            const fromAmount = this.squidManager.parseAmount(this.amount, fromToken.decimals);

            const recipientSelect = document.getElementById('recipient-select');
            const selectedOption = recipientSelect.querySelector(`option[value="${this.selectedRecipient}"]`);
            const toAddress = selectedOption.getAttribute('data-address');
            const fromAddress = this.localPlayer.getAttribute('address');

            const routeParams = {
                fromChain: this.fromChain,
                toChain: this.toChain,
                fromToken: fromToken.address,
                toToken: toToken.address,
                fromAmount,
                fromAddress,
                toAddress
            };

            this.route = await this.squidManager.getRoute(routeParams);
            this.displayRouteInfo();
            this.showStatus('Quote ready!', 'success');

            document.getElementById('execute-trade-btn').disabled = false;

        } catch (error) {
            console.error('Failed to get quote:', error);
            this.showStatus('Failed to get quote: ' + error.message, 'error');
        }
    }

    async executeTrade() {
        if (!this.route) {
            this.showStatus('No route available', 'error');
            return;
        }

        if (!this.localPlayer.signer) {
            this.showStatus('Wallet not connected', 'error');
            return;
        }

        this.showStatus('Executing trade...', 'info');

        try {
            const tx = await this.squidManager.executeRoute(this.route, this.localPlayer.signer);
            this.showStatus(`Trade submitted! Tx: ${tx.hash.slice(0, 10)}...`, 'success');

            // Wait for confirmation
            const receipt = await tx.wait();
            this.showStatus(`Trade confirmed! Block: ${receipt.blockNumber}`, 'success');

        } catch (error) {
            console.error('Failed to execute trade:', error);
            this.showStatus('Trade failed: ' + error.message, 'error');
        }
    }

    displayRouteInfo() {
        if (!this.route) return;

        const routeInfo = document.getElementById('route-info');
        const routeDetails = document.getElementById('route-details');

        const estimate = this.route.route.estimate;
        const fromToken = this.squidManager.getNativeToken(this.fromChain);
        const toToken = this.squidManager.getNativeToken(this.toChain);

        const fromAmount = this.squidManager.formatAmount(estimate.fromAmount, fromToken.decimals);
        const toAmount = this.squidManager.formatAmount(estimate.toAmount, toToken.decimals);
        const gasCosts = this.squidManager.formatAmount(estimate.gasCosts[0]?.amount || '0', fromToken.decimals);
        console.log(this.route);

        routeDetails.innerHTML = `
            <div>Send: ${fromAmount} ${fromToken.symbol}</div>
            <div>Receive: ${toAmount} ${toToken.symbol}</div>
            <div>Gas Cost: ~${gasCosts} ${fromToken.symbol}</div>
            <div>Route Type: ${estimate.routeType}</div>
        `;

        routeInfo.style.display = 'block';
    }

    validateInputs() {
        if (!this.selectedRecipient) {
            this.showStatus('Please select a recipient', 'error');
            return false;
        }

        if (!this.fromChain) {
            this.showStatus('Please select source chain', 'error');
            return false;
        }

        if (!this.toChain) {
            this.showStatus('Please select destination chain', 'error');
            return false;
        }

        if (!this.amount || parseFloat(this.amount) <= 0) {
            this.showStatus('Please enter a valid amount', 'error');
            return false;
        }

        return true;
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('trade-status');

        const colors = {
            info: '#0099ff',
            success: '#00aa00',
            error: '#ff4444'
        };

        statusElement.style.background = `rgba(${type === 'error' ? '255,68,68' : type === 'success' ? '0,170,0' : '0,153,255'}, 0.2)`;
        statusElement.style.color = colors[type];
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    async show() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        this.updateRecipientList();
        this.container.style.display = 'block';
        this.isVisible = true;

        // Show mode indicator if in mock mode
        // if (this.squidManager.isMockMode()) {
        //     document.getElementById('mode-indicator').style.display = 'block';
        // }
    }

    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;

        // Reset form
        this.selectedRecipient = null;
        this.fromChain = null;
        this.toChain = null;
        this.amount = '';
        this.route = null;

        document.getElementById('route-info').style.display = 'none';
        document.getElementById('trade-status').style.display = 'none';
        document.getElementById('execute-trade-btn').disabled = true;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}