// src/web3/SquidManager.js - Proper SDK import with bundling fixes
export class SquidManager {
    constructor() {
        this.squid = null;
        this.initialized = false;
        this.chains = [];
        this.tokens = [];
        this.mode = 'uninitialized';
        this.SquidSDK = null;
    }

    async initialize() {
        if (this.initialized) return;

        console.log("Initializing SquidManager with proper import...");

        // Try multiple approaches in order
        try {
            await this.tryDirectImport();
            this.mode = 'direct';
            console.log("✅ Direct import successful");
        } catch (error) {
            console.warn("Direct import failed:", error.message);

            try {
                await this.tryDynamicImport();
                this.mode = 'dynamic';
                console.log("✅ Dynamic import successful");
            } catch (error2) {
                console.warn("Dynamic import failed:", error2.message);

                try {
                    await this.tryWithPolyfills();
                    this.mode = 'polyfill';
                    console.log("✅ Polyfill import successful");
                } catch (error3) {
                    console.warn("All import methods failed, using mock mode");
                    this.initializeMockMode();
                    this.mode = 'mock';
                }
            }
        }

        this.initialized = true;
    }

    async tryDirectImport() {
        // This will work if bundler is properly configured
        const { Squid } = await import("@0xsquid/sdk");
        this.SquidSDK = Squid;
        await this.initializeSquidSDK();
    }

    async tryDynamicImport() {
        // Try importing with error handling for missing types
        try {
            const squidModule = await import("@0xsquid/sdk");
            this.SquidSDK = squidModule.Squid || squidModule.default?.Squid || squidModule.default;

            if (!this.SquidSDK) {
                throw new Error("Squid class not found in module");
            }

            await this.initializeSquidSDK();
        } catch (error) {
            if (error.message.includes('squid-types')) {
                // Try to continue without the types package
                console.warn("Continuing without @0xsquid/squid-types...");
                await this.tryWorkaroundImport();
            } else {
                throw error;
            }
        }
    }

    async tryWorkaroundImport() {
        // Create a workaround for the missing types
        if (!window.SquidTypesWorkaround) {
            window.SquidTypesWorkaround = {
                // Mock the missing types that cause bundling issues
                ChainType: {},
                RouteType: {},
                TokenType: {}
            };
        }

        // Try importing again with workaround in place
        const squidModule = await import("@0xsquid/sdk");
        this.SquidSDK = squidModule.Squid || squidModule.default?.Squid || squidModule.default;

        if (!this.SquidSDK) {
            throw new Error("Squid class not found after workaround");
        }

        await this.initializeSquidSDK();
    }

    async tryWithPolyfills() {
        // Ensure polyfills are available
        if (typeof global === 'undefined') {
            window.global = window.globalThis || window;
        }

        if (typeof process === 'undefined') {
            window.process = { env: {} };
        }

        // Try importing with polyfills
        const squidModule = await import("@0xsquid/sdk");
        this.SquidSDK = squidModule.Squid;
        await this.initializeSquidSDK();
    }

    async initializeSquidSDK() {
        if (!this.SquidSDK) {
            throw new Error('Squid SDK not available');
        }

        try {
            console.log("Creating Squid instance...");

            this.squid = new this.SquidSDK({
                baseUrl: "https://v2.api.squidrouter.com",
                integratorId: "blockchain-mmorpg-1af278cc-03d4-4c43-97b7-ce04979ab693" // You can replace with your own
            });

            console.log("Initializing Squid SDK...");
            await this.squid.init();

            // Get supported chains and tokens
            this.chains = this.squid.chains || [];
            this.tokens = this.squid.tokens || [];

            console.log(`✅ Squid SDK initialized with ${this.chains.length} chains and ${this.tokens.length} tokens`);

        } catch (error) {
            console.error("Failed to initialize Squid SDK:", error);
            throw error;
        }
    }

    initializeMockMode() {
        console.warn("🔧 Running in MOCK MODE - for development only");

        this.chains = [
            {
                chainId: 1,
                chainName: "Ethereum",
                rpc: "https://eth.llamarpc.com",
                nativeCurrency: { symbol: "ETH", name: "Ethereum", decimals: 18 }
            },
            {
                chainId: 137,
                chainName: "Polygon",
                rpc: "https://polygon.llamarpc.com",
                nativeCurrency: { symbol: "MATIC", name: "Polygon", decimals: 18 }
            },
            {
                chainId: 56,
                chainName: "BSC",
                rpc: "https://bsc.llamarpc.com",
                nativeCurrency: { symbol: "BNB", name: "BNB Smart Chain", decimals: 18 }
            },
            {
                chainId: 43114,
                chainName: "Avalanche",
                rpc: "https://avax.network/ext/bc/C/rpc",
                nativeCurrency: { symbol: "AVAX", name: "Avalanche", decimals: 18 }
            },
            {
                chainId: 42161,
                chainName: "Arbitrum",
                rpc: "https://arb1.arbitrum.io/rpc",
                nativeCurrency: { symbol: "ETH", name: "Ethereum", decimals: 18 }
            },
            {
                chainId: 10,
                chainName: "Optimism",
                rpc: "https://mainnet.optimism.io",
                nativeCurrency: { symbol: "ETH", name: "Ethereum", decimals: 18 }
            },
            {
                chainId: 250,
                chainName: "Fantom",
                rpc: "https://rpc.ftm.tools",
                nativeCurrency: { symbol: "FTM", name: "Fantom", decimals: 18 }
            }
        ];

        // Create mock tokens
        this.tokens = this.chains.map(chain => ({
            chainId: chain.chainId,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            symbol: chain.nativeCurrency.symbol,
            name: chain.nativeCurrency.name,
            decimals: chain.nativeCurrency.decimals
        }));
    }

    // Get native token for a chain
    getNativeToken(chainId) {
        if (!this.initialized) {
            throw new Error("SquidManager not initialized");
        }

        const chain = this.chains.find(c => c.chainId === chainId);
        if (!chain) {
            throw new Error(`Chain ${chainId} not supported`);
        }

        // For real mode, try to find the actual native token
        if (this.mode !== 'mock' && this.tokens.length > 0) {
            const nativeToken = this.tokens.find(token =>
                token.chainId === chainId &&
                (token.address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
                    token.symbol === chain.nativeCurrency.symbol)
            );

            if (nativeToken) {
                return nativeToken;
            }
        }

        // Fallback to chain's native currency info
        return {
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            symbol: chain.nativeCurrency.symbol,
            name: chain.nativeCurrency.name,
            decimals: chain.nativeCurrency.decimals,
            chainId: chainId
        };
    }

    // Get all native tokens for supported chains
    getAllNativeTokens() {
        if (!this.initialized) {
            throw new Error("SquidManager not initialized");
        }

        return this.chains.map(chain => ({
            chainId: chain.chainId,
            chainName: chain.chainName,
            symbol: chain.nativeCurrency.symbol,
            name: chain.nativeCurrency.name,
            decimals: chain.nativeCurrency.decimals,
            token: this.getNativeToken(chain.chainId)
        }));
    }

    // Get route for swap
    async getRoute(params) {
        if (!this.initialized) {
            throw new Error("SquidManager not initialized");
        }

        const {
            fromChain,
            toChain,
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
            toAddress,
            slippage = 1.5
        } = params;

        try {
            // If using real Squid SDK
            if (this.mode !== 'mock' && this.squid) {
                const routeParams = {
                    fromChain,
                    fromToken,
                    fromAmount,
                    toChain,
                    toToken,
                    toAddress,
                    fromAddress,
                    slippage,
                    enableForecall: false,
                    quoteOnly: false
                };

                console.log("Getting real route from Squid API...");
                const route = await this.squid.getRoute(routeParams);
                console.log("✅ Real route received:", route);
                return route;
            }

            // Mock mode
            console.log("🔧 Generating mock route...");
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

            const mockSlippagePercent = Math.floor(Math.random() * 5) + 3; // 3-7% slippage
            const mockGasPercent = Math.floor(Math.random() * 3) + 1; // 1-3% gas cost

            const receivedAmount = BigInt(fromAmount) * BigInt(100 - mockSlippagePercent) / 100n;
            const gasCost = BigInt(fromAmount) * BigInt(mockGasPercent) / 100n;

            return {
                route: {
                    estimate: {
                        fromAmount: fromAmount,
                        toAmount: receivedAmount.toString(),
                        gasCosts: [{
                            amount: gasCost.toString(),
                            chainId: fromChain
                        }],
                        routeType: fromChain === toChain ? "Same Chain Swap" : "Cross-chain Bridge + Swap",
                        exchangeRate: (Number(receivedAmount) / Number(fromAmount)).toFixed(6),
                        estimatedRouteDuration: fromChain === toChain ? 30 : 180 // seconds
                    }
                }
            };

        } catch (error) {
            console.error("Failed to get route:", error);
            throw error;
        }
    }

    // Execute the swap
    async executeRoute(route, signer) {
        if (!this.initialized) {
            throw new Error("SquidManager not initialized");
        }

        try {
            // Real execution with Squid SDK
            if (this.mode !== 'mock' && this.squid) {
                console.log("Executing real route via Squid...");
                const tx = await this.squid.executeRoute({
                    signer,
                    route
                });
                console.log("✅ Real transaction submitted:", tx.hash);
                return tx;
            }

            // Mock execution
            console.log("🔧 Simulating trade execution...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate realistic mock transaction
            const mockTxHash = "0x" + Array.from({ length: 64 }, () =>
                Math.floor(Math.random() * 16).toString(16)
            ).join('');

            console.log("🔧 Mock transaction hash:", mockTxHash);

            return {
                hash: mockTxHash,
                wait: async () => {
                    console.log("🔧 Waiting for mock confirmation...");
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    return {
                        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
                        status: 1,
                        transactionHash: mockTxHash,
                        gasUsed: Math.floor(Math.random() * 100000) + 21000
                    };
                }
            };

        } catch (error) {
            console.error("Failed to execute route:", error);
            throw error;
        }
    }

    // Get supported chains info
    getSupportedChains() {
        if (!this.initialized) {
            return [];
        }

        return this.chains.map(chain => ({
            chainId: chain.chainId,
            chainName: chain.chainName,
            rpc: chain.rpc,
            nativeCurrency: chain.nativeCurrency
        }));
    }

    // Check if chain is supported
    isChainSupported(chainId) {
        if (!this.initialized) {
            return false;
        }

        return this.chains.some(chain => chain.chainId === chainId);
    }

    // Format amount for display
    formatAmount(amount, decimals = 18) {
        try {
            const divisor = Math.pow(10, decimals);
            const formatted = (Number(amount) / divisor).toFixed(6);
            return parseFloat(formatted).toString();
        } catch (error) {
            console.error("Error formatting amount:", error);
            return "0";
        }
    }

    // Parse amount for transaction
    parseAmount(amount, decimals = 18) {
        try {
            const multiplier = Math.pow(10, decimals);
            return Math.floor(Number(amount) * multiplier).toString();
        } catch (error) {
            console.error("Error parsing amount:", error);
            return "0";
        }
    }

    // Check current mode
    getMode() {
        return this.mode;
    }

    isMockMode() {
        return this.mode === 'mock';
    }

    isRealMode() {
        return this.mode !== 'mock';
    }

    getModeDescription() {
        switch (this.mode) {
            case 'direct': return 'Direct Import - Full SDK';
            case 'dynamic': return 'Dynamic Import - Full SDK';
            case 'polyfill': return 'Polyfilled Import - Full SDK';
            case 'mock': return 'Mock Mode - Simulated';
            default: return 'Uninitialized';
        }
    }
}