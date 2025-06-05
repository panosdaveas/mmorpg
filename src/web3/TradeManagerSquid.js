// TradeManager.js
// Handles player-to-player trade logic in a multiplayer + Squid SDK context

export class TradeManager {
    constructor(multiplayerManager, localPlayer, signer) {
        this.mm = multiplayerManager;
        this.localPlayer = localPlayer;
        this.signer = signer;

        this.activeTrades = new Map(); // sessionId -> metadata

        // Listen for trade requests
        this.mm.on("onTradeRequest", (data) => this.handleTradeRequest(data));
        this.mm.on("onTradeAccepted", (data) => this.handleTradeAccepted(data));
        this.mm.on("onTradeSuccess", (data) => this.notify(`✅ Trade completed: ${data.amount}`));
        this.mm.on("onTradeFailed", (data) => this.notify(`❌ Trade failed: ${data.error}`));
    }

    // Emit message directly to a specific player ID
    emitToPlayer(playerId, message) {
        if (this.mm.socket && this.mm.isConnected) {
            this.mm.socket.emit("privateMessage", {
                to: playerId,
                ...message
            });
        }
    }

    // Initiate a trade request to another player
    async requestTrade(remotePlayer, tokenInfo) {
        const remotePlayerId = remotePlayer.getAttribute("id");
        const sessionId = `${Date.now()}-${remotePlayerId}`;
        const tradeData = {
            type: "TRADE_REQUEST",
            sessionId,
            fromPlayerId: this.mm.mySocketId,
            toPlayerId: remotePlayer.id,
            fromAddress: this.localPlayer.getAttribute("address"),
            toAddress: remotePlayer.getAttribute("address"),
            fromChainId: this.localPlayer.getAttribute("chainId"),
            toChainId: remotePlayer.getAttribute("chainId"),
            fromAmount: tokenInfo.amount, // in wei
            fromToken: tokenInfo.fromToken,
            toToken: tokenInfo.toToken,
        };

        this.emitToPlayer(remotePlayerId, tradeData);
        this.activeTrades.set(sessionId, tradeData);
        this.notify(`📤 Trade request sent to ${remotePlayerId}`);
        // this.handleTradeRequest(tradeData);
    }

    // Handle incoming trade request
    handleTradeRequest(data) {
        const confirmed = confirm(`Player wants to send you 1 token. Accept?`);
        if (confirmed) {
            this.emitToPlayer(data.fromPlayerId, {
                type: "TRADE_ACCEPTED",
                sessionId: data.sessionId,
                toPlayerId: this.mm.mySocketId,
                toAddress: this.localPlayer.getAttribute("address"),
                toChainId: this.localPlayer.getAttribute("chainId"),
                accepted: true,
            });
        }
    }

    // Handle trade accepted confirmation
    async handleTradeAccepted(data) {
        const trade = this.activeTrades.get(data.sessionId);
        if (!trade || !data.accepted) return;

        try {
            const { sendCrossChainAsset } = await import("./Squid.js");

            await sendCrossChainAsset({
                fromChainId: trade.fromChainId,
                toChainId: trade.toChainId,
                fromToken: trade.fromToken,
                toToken: trade.toToken,
                fromAmount: trade.fromAmount,
                toAddress: trade.toAddress,
                signer: this.signer,
            });

            this.emitToPlayer(data.toPlayerId, {
                type: "TRADE_SUCCESS",
                amount: "1 token",
            });
        } catch (err) {
            console.log(err);
            this.emitToPlayer(data.toPlayerId, {
                type: "TRADE_FAILED",
                error: err.message
            });
        }
    }

    notify(msg) {
        console.log("[TradeManager]", msg);
        // Optionally hook into game HUD notification system
    }
  }