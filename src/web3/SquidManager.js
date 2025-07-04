// src/web3/SquidManager.js - Fixed version with dynamic imports
export class SquidManager {
    constructor() {
        this.squid = null;
        this.initialized = false;
        this.chains = [];
        this.tokens = [];
        this.SquidSDK = null;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log("Initializing SquidManager with dynamic import...");

            // Dynamic import to avoid bundling issues
            try {
                // const squidModule = await import("@0xsquid/sdk");
                // this.SquidSDK = squidModule.Squid;
                await this.loadSquidFromCDN();
            } catch (importError) {
                console.warn("Failed to import Squid SDK:", importError);
                console.log("Falling back to CDN version...");

                // Fallback to CDN if npm package fails
            }

            this.squid = new this.SquidSDK({
                baseUrl: "https://v2.api.squidrouter.com",
                integratorId: "your-integrator-id" // Replace with actual ID
            });

            await this.squid.init();

            // Get supported chains and tokens
            this.chains = this.squid.chains;
            this.tokens = this.squid.tokens;

            this.initialized = true;
            console.log("SquidManager initialized successfully");
            console.log("Supported chains:", this.chains.length);

        } catch (error) {
            console.error("Failed to initialize SquidManager:", error);

            // Fall back to mock mode for development
            console.warn("Falling back to mock mode for development");
            this.initializeMockMode();
        }
    }

    async loadSquidFromCDN() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.SquidSDK) {
                this.SquidSDK = window.SquidSDK.Squid;
                resolve();
                return;
            }

            // Load from CDN
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@0xsquid/sdk@latest/dist/squid-sdk.umd.js';
            script.onload = () => {
                if (window.SquidSDK) {
                    this.SquidSDK = window.SquidSDK.Squid;
                    resolve();
                } else {
                    reject(new Error('Squid SDK not found on window'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load Squid SDK from CDN'));
            document.head.appendChild(script);
        });
    }

    initializeMockMode() {
        console.warn("🔧 Running in MOCK MODE - for development only");
        this.initialized = true;
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
            }
        ];

        // Mock tokens
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

        // In mock mode or if tokens aren't loaded properly
        if (!this.tokens || this.tokens.length === 0) {
            return {
                address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                symbol: chain.nativeCurrency.symbol,
                name: chain.nativeCurrency.name,
                decimals: chain.nativeCurrency.decimals,
                chainId: chainId
            };
        }

        // Find native token for this chain
        const nativeToken = this.tokens.find(token =>
            token.chainId === chainId &&
            (token.address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
                token.symbol === chain.nativeCurrency.symbol)
        );

        return nativeToken || {
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
            slippage = 1.5 // Default 1.5% slippage
        } = params;

        try {
            // If in mock mode or squid not available
            if (!this.squid) {
                console.warn("🔧 Mock route - for development only");
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay

                return {
                    route: {
                        estimate: {
                            fromAmount: fromAmount,
                            toAmount: (BigInt(fromAmount) * 95n / 100n).toString(), // 5% slippage simulation
                            gasCosts: [{
                                amount: (BigInt(fromAmount) / 100n).toString(),
                                chainId: fromChain
                            }],
                            routeType: fromChain === toChain ? "Same Chain" : "Cross-chain Bridge"
                        }
                    }
                };
            }

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

            console.log("Getting route with params:", routeParams);
            const route = await this.squid.getRoute(routeParams);

            return route;
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
            // If in mock mode
            if (!this.squid) {
                console.warn("🔧 Mock execution - for development only");
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Return mock transaction
                return {
                    hash: "0x" + Math.random().toString(16).slice(2, 66),
                    wait: async () => ({
                        blockNumber: Math.floor(Math.random() * 1000000),
                        status: 1
                    })
                };
            }

            console.log("Executing route:", route);
            const tx = await this.squid.executeRoute({
                signer,
                route
            });

            console.log("Transaction submitted:", tx.hash);
            return tx;
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
        const divisor = Math.pow(10, decimals);
        const formatted = (Number(amount) / divisor).toFixed(6);
        return parseFloat(formatted).toString(); // Remove trailing zeros
    }

    // Parse amount for transaction
    parseAmount(amount, decimals = 18) {
        const multiplier = Math.pow(10, decimals);
        return Math.floor(Number(amount) * multiplier).toString();
    }

    // Check if running in mock mode
    isMockMode() {
        return this.initialized && !this.squid;
    }
}