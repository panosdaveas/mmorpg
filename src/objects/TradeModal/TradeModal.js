import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { events } from "../../Events.js";
import { Sprite } from "../../Sprite.js";
import { resources } from "../../Resource.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAP_WIDTH, MAP_HEIGHT } from "../../constants/worldConstants.js";

export class TradeModal extends GameObject {
    constructor({ position, multiplayerManager }) {
        super({ position: position ?? new Vector2(0, 0) });

        this.multiplayerManager = multiplayerManager;
        this.isVisible = false;
        this.selectedPlayer = null;
        this.selectedChain = null;
        this.amount = "";
        this.tokenAddress = "";
        this.supportedChains = [];
        this.lifiWidget = null;

        // Modal dimensions
        this.width = 400;
        this.height = 400;

        // UI state
        this.activeTab = 'players'; // 'players' or 'chains'
        this.scrollOffset = 0;
        this.maxVisibleItems = 6;

        // Create modal background
        this.createModalElements();
    }

    createModalElements() {
        // Semi-transparent overlay
        this.overlay = new GameObject({
            position: new Vector2(0, 0)
        });

        // Modal container
        this.container = new GameObject({
            position: new Vector2(
                (CANVAS_WIDTH - this.width) / 2,
                (CANVAS_HEIGHT - this.height) / 2
            )
        });

        this.addChild(this.overlay);
        this.addChild(this.container);
    }

    async ready() {
        // Listen for trading modal trigger
        events.on("OPEN_TRADING_MODAL", this, (data) => {
            this.openModal(data);
        });

        events.on("CLOSE_TRADING_MODAL", this, () => {
            this.closeModal();
        });

        // Initialize Li.Fi SDK
        await this.initializeLiFi();

        // Bind click handlers
        this.bindEventHandlers();
    }

    async initializeLiFi() {
        try {
            // Try to use Li.Fi from CDN first
            if (window.LiFi) {
                this.lifi = window.LiFi;
                this.supportedChains = await this.fetchSupportedChains();
            } else {
                // Load Li.Fi script dynamically
                await this.loadLiFiScript();
                this.supportedChains = await this.fetchSupportedChains();
            }

            console.log('Li.Fi initialized with chains:', this.supportedChains.length);
        } catch (error) {
            console.error('Failed to initialize Li.Fi:', error);
            // Fallback chains if Li.Fi fails to load
            this.supportedChains = [
                { id: 1, name: 'Ethereum', nativeToken: { symbol: 'ETH' } },
                { id: 137, name: 'Polygon', nativeToken: { symbol: 'MATIC' } },
                { id: 56, name: 'BSC', nativeToken: { symbol: 'BNB' } },
                { id: 42161, name: 'Arbitrum', nativeToken: { symbol: 'ETH' } },
                { id: 10, name: 'Optimism', nativeToken: { symbol: 'ETH' } }
            ];
        }
    }

    loadLiFiScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://widget.lifi.com/widget.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async fetchSupportedChains() {
        try {
            const response = await fetch('https://li.quest/v1/chains');
            const data = await response.json();
            return data.chains || this.getFallbackChains();
        } catch (error) {
            console.error('Failed to fetch chains from Li.Fi API:', error);
            return this.getFallbackChains();
        }
    }

    getFallbackChains() {
        return [
            { id: 1, name: 'Ethereum', nativeToken: { symbol: 'ETH' } },
            { id: 137, name: 'Polygon', nativeToken: { symbol: 'MATIC' } },
            { id: 56, name: 'BSC', nativeToken: { symbol: 'BNB' } },
            { id: 42161, name: 'Arbitrum', nativeToken: { symbol: 'ETH' } },
            { id: 10, name: 'Optimism', nativeToken: { symbol: 'ETH' } }
        ];
    }

    bindEventHandlers() {
        // Add canvas click listener for modal interactions
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                if (this.isVisible) {
                    this.handleCanvasClick(e);
                }
            });

            canvas.addEventListener('keydown', (e) => {
                if (this.isVisible) {
                    this.handleKeyInput(e);
                }
            });
        }
    }

    openModal(data = {}) {
        this.isVisible = true;
        this.selectedPlayer = data.targetPlayer || null;

        // Reset state
        this.activeTab = 'players';
        this.scrollOffset = 0;
        this.amount = "";
        this.tokenAddress = "";

        // Emit event to lock game input
        events.emit("START_TEXT_BOX");

        console.log('Trading modal opened');
    }

    closeModal() {
        this.isVisible = false;
        this.selectedPlayer = null;

        // Emit event to unlock game input
        events.emit("END_TEXT_BOX");

        console.log('Trading modal closed');
    }

    getConnectedPlayers() {
        if (!this.multiplayerManager?.players) {
            return {};
        }

        // Filter out players without addresses
        const validPlayers = {};
        for (const [id, player] of Object.entries(this.multiplayerManager.players)) {
            const address = player.getAttribute?.("address");
            if (address && address !== "undefined") {
                validPlayers[id] = player;
            }
        }

        return validPlayers;
    }

    handleCanvasClick(e) {
        const rect = e.target.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert to game coordinates
        const gameX = clickX;
        const gameY = clickY;

        // Check if click is within modal bounds
        const modalX = this.container.position.x;
        const modalY = this.container.position.y;

        if (gameX >= modalX && gameX <= modalX + this.width &&
            gameY >= modalY && gameY <= modalY + this.height) {
            this.handleModalClick(gameX - modalX, gameY - modalY);
        } else {
            // Click outside modal - close it
            this.closeModal();
        }
    }

    handleModalClick(x, y) {
        // Tab buttons (at top of modal)
        if (y >= 10 && y <= 40) {
            if (x >= 20 && x <= 120) {
                this.activeTab = 'players';
            } else if (x >= 140 && x <= 240) {
                this.activeTab = 'chains';
            }
            return;
        }

        // Close button
        if (x >= this.width - 30 && x <= this.width - 10 && y >= 10 && y <= 30) {
            this.closeModal();
            return;
        }

        // List items
        const itemHeight = 60;
        const listStartY = 80;
        const listEndY = this.height - 120;

        if (y >= listStartY && y <= listEndY) {
            const itemIndex = Math.floor((y - listStartY) / itemHeight) + this.scrollOffset;

            if (this.activeTab === 'players') {
                const players = Object.entries(this.getConnectedPlayers());
                if (itemIndex < players.length) {
                    this.selectedPlayer = players[itemIndex][1];
                    console.log('Selected player:', this.selectedPlayer.getAttribute?.("address"));
                }
            } else if (this.activeTab === 'chains') {
                if (itemIndex < this.supportedChains.length) {
                    this.selectedChain = this.supportedChains[itemIndex];
                    console.log('Selected chain:', this.selectedChain.name);
                }
            }
        }

        // Action buttons
        if (y >= this.height - 100 && y <= this.height - 70) {
            if (x >= 20 && x <= 120 && this.selectedPlayer && this.selectedChain) {
                this.initiateTrade();
            } else if (x >= 140 && x <= 240) {
                this.openLiFiWidget();
            }
        }
    }

    handleKeyInput(e) {
        switch (e.key) {
            case 'Escape':
                this.closeModal();
                break;
            case 'ArrowUp':
                this.scrollOffset = Math.max(0, this.scrollOffset - 1);
                break;
            case 'ArrowDown':
                const maxItems = this.activeTab === 'players'
                    ? Object.keys(this.getConnectedPlayers()).length
                    : this.supportedChains.length;
                this.scrollOffset = Math.min(
                    Math.max(0, maxItems - this.maxVisibleItems),
                    this.scrollOffset + 1
                );
                break;
        }
    }

    async initiateTrade() {
        if (!this.selectedPlayer || !this.selectedChain) {
            console.error('Missing required trade parameters');
            return;
        }

        const targetAddress = this.selectedPlayer.getAttribute("address");
        const sourceChainId = this.selectedChain.id;

        console.log('Initiating trade to:', targetAddress, 'on chain:', sourceChainId);

        try {
            // This would integrate with your existing trade logic
            events.emit("INITIATE_CROSS_CHAIN_TRADE", {
                targetPlayer: this.selectedPlayer,
                targetAddress: targetAddress,
                sourceChain: sourceChainId,
                destChain: this.selectedPlayer.getAttribute("chainId") || sourceChainId,
                amount: this.amount || "0.01",
                tokenAddress: this.tokenAddress || "native"
            });

            this.closeModal();
        } catch (error) {
            console.error('Trade initiation failed:', error);
        }
    }

    openLiFiWidget() {
        // Open the standard Li.Fi widget as fallback
        if (window.lifi) {
            window.lifi.open();
        } else {
            console.warn('Li.Fi widget not available');
        }
    }

    // Override draw method to render the modal
    draw(ctx, x, y) {
        if (!this.isVisible) return;

        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Draw modal background
        const modalX = this.container.position.x;
        const modalY = this.container.position.y;

        // Modal background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(modalX, modalY, this.width, this.height);

        // Modal border
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.strokeRect(modalX, modalY, this.width, this.height);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Cross-Chain Trading', modalX + 20, modalY + 30);

        // Close button
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(modalX + this.width - 30, modalY + 10, 20, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.fillText('×', modalX + this.width - 22, modalY + 24);

        // Tab buttons
        this.drawTab(ctx, modalX + 20, modalY + 50, 'Players', this.activeTab === 'players');
        this.drawTab(ctx, modalX + 140, modalY + 50, 'Chains', this.activeTab === 'chains');

        // Content area
        if (this.activeTab === 'players') {
            this.drawPlayersList(ctx, modalX, modalY);
        } else {
            this.drawChainsList(ctx, modalX, modalY);
        }

        // Action buttons
        this.drawButton(ctx, modalX + 20, modalY + this.height - 80, 'Trade',
            this.selectedPlayer && this.selectedChain);
        this.drawButton(ctx, modalX + 140, modalY + this.height - 80, 'Li.Fi Widget', true);

        // Selection info
        this.drawSelectionInfo(ctx, modalX, modalY);
    }

    drawTab(ctx, x, y, text, isActive) {
        ctx.fillStyle = isActive ? '#4a9eff' : '#444444';
        ctx.fillRect(x, y, 100, 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(text, x + 10, y + 20);
    }

    drawPlayersList(ctx, modalX, modalY) {
        const players = Object.entries(this.getConnectedPlayers());
        const listY = modalY + 90;
        const itemHeight = 50;

        ctx.fillStyle = '#333333';
        ctx.fillRect(modalX + 10, listY, this.width - 20, this.height - 200);

        for (let i = 0; i < Math.min(this.maxVisibleItems, players.length - this.scrollOffset); i++) {
            const playerIndex = i + this.scrollOffset;
            if (playerIndex >= players.length) break;

            const [playerId, player] = players[playerIndex];
            const itemY = listY + 10 + (i * itemHeight);
            const isSelected = this.selectedPlayer === player;

            // Item background
            ctx.fillStyle = isSelected ? '#4a9eff' : '#444444';
            ctx.fillRect(modalX + 15, itemY, this.width - 30, itemHeight - 5);

            // Player info
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.fillText(`Player: ${playerId}`, modalX + 25, itemY + 15);

            const address = player.getAttribute?.("address") || "No address";
            const shortAddress = address.length > 10
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : address;
            ctx.fillText(`Address: ${shortAddress}`, modalX + 25, itemY + 30);
        }

        // Scroll indicator
        if (players.length > this.maxVisibleItems) {
            ctx.fillStyle = '#666666';
            ctx.fillText(`${this.scrollOffset + 1}-${Math.min(this.scrollOffset + this.maxVisibleItems, players.length)} of ${players.length}`,
                modalX + this.width - 100, modalY + this.height - 160);
        }
    }

    drawChainsList(ctx, modalX, modalY) {
        const listY = modalY + 90;
        const itemHeight = 40;

        ctx.fillStyle = '#333333';
        ctx.fillRect(modalX + 10, listY, this.width - 20, this.height - 200);

        for (let i = 0; i < Math.min(this.maxVisibleItems, this.supportedChains.length - this.scrollOffset); i++) {
            const chainIndex = i + this.scrollOffset;
            if (chainIndex >= this.supportedChains.length) break;

            const chain = this.supportedChains[chainIndex];
            const itemY = listY + 10 + (i * itemHeight);
            const isSelected = this.selectedChain === chain;

            // Item background
            ctx.fillStyle = isSelected ? '#4a9eff' : '#444444';
            ctx.fillRect(modalX + 15, itemY, this.width - 30, itemHeight - 5);

            // Chain info
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.fillText(`${chain.name} (${chain.nativeToken?.symbol || 'Native'})`, modalX + 25, itemY + 20);
        }
    }

    drawButton(ctx, x, y, text, enabled) {
        ctx.fillStyle = enabled ? '#4a9eff' : '#666666';
        ctx.fillRect(x, y, 100, 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(text, x + 10, y + 20);
    }

    drawSelectionInfo(ctx, modalX, modalY) {
        const infoY = modalY + this.height - 120;

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Arial';

        if (this.selectedPlayer) {
            const address = this.selectedPlayer.getAttribute?.("address") || "Unknown";
            const shortAddress = address.length > 10
                ? `${address.slice(0, 8)}...${address.slice(-6)}`
                : address;
            ctx.fillText(`Selected: ${shortAddress}`, modalX + 20, infoY);
        }

        if (this.selectedChain) {
            ctx.fillText(`Chain: ${this.selectedChain.name}`, modalX + 20, infoY + 15);
        }

        // Instructions
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px Arial';
        ctx.fillText('Use arrow keys to scroll, ESC to close', modalX + 20, modalY + this.height - 10);
    }

    step(delta, root) {
        // Update any animations or state here if needed
        super.step(delta, root);
    }
}