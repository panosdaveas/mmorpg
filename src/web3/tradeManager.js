// axelarBridge.js
import { AxelarAssetTransfer, Environment, CHAINS, AxelarQueryAPI } from "@axelar-network/axelarjs-sdk";
import { ethers } from "ethers";

export async function tradeManager({
    sourceChain,
    destChain,
    fromTokenAddress,
    amount,
    toAddress,
    signer,
    socket,
    toPlayerId,           // ✅ Added missing parameter
    // asset = "avax",
}) {
    const fromChain = getAxelarChainByChainId(sourceChain).chainObject;
    const toChain = getAxelarChainByChainId(destChain).chainObject;
    const api = new AxelarQueryAPI({
        environment: "testnet",
      });
    const asset = await api.getDenomFromSymbol("aUSDC", fromChain.toLowerCase());
    console.log("asset", asset);
    
    
    try {
        // Validate and normalize the toAddress
        if (!toAddress || typeof toAddress !== 'string') {
            throw new Error('Invalid toAddress provided');
        }

        // Ensure toAddress is a valid hex address (not ENS)
        if (!ethers.isAddress(toAddress)) {
            throw new Error('toAddress must be a valid Ethereum address, not an ENS name');
        }

        // Normalize the address (checksum it)
        const normalizedToAddress = ethers.getAddress(toAddress);
        console.log('[Axelar] Using destination address:', normalizedToAddress);

        const sdk = new AxelarAssetTransfer({
            environment: Environment.TESTNET
        });

        console.log(`[Axelar] Getting deposit address from ${fromChain} to ${toChain}`);

        // Get deposit address for the cross-chain transfer
        const depositAddress = await sdk.getDepositAddress({
            fromChain,
            toChain,
            destinationAddress: normalizedToAddress,
            asset: asset,
            options: {
                shouldUnwrapIntoNative: true,
                refundAddress: await signer.getAddress() // optional. See note (4) below
              }
        });

        console.log("[Axelar] Deposit address:", depositAddress);

        // Convert amount to BigNumber if it's a string
        const transferAmount = ethers.parseUnits(amount.toString(), 18);

        // For native token transfers (like AVAX), use direct transfer
        if (asset.toLowerCase() === "avax" && fromChain === CHAINS.TESTNET.AVALANCHE) {
            console.log("[Axelar] Sending native AVAX...");

            const tx = await signer.sendTransaction({
                to: depositAddress,
                value: transferAmount,
                gasLimit: 100000
            });

            const receipt = await tx.wait();
            console.log("[Axelar] Native token sent:", receipt.transactionHash);

            const explorerUrl = `https://axelarscan.io/gmp/${receipt.transactionHash}`;

            // Notify via socket
            if (socket && toPlayerId) {
                socket.emit("privateMessage", {
                    to: toPlayerId,
                    type: "TRADE_CONFIRMED",
                    txHash: receipt.transactionHash,
                    explorerUrl,
                    amount: amount.toString(),
                    fromChain,
                    toChain,
                });
            }

            return {
                txHash: receipt.transactionHash,
                explorerUrl,
                depositAddress
            };
        }

        // For ERC20 token transfers
        const erc20Abi = [
            "function approve(address spender, uint256 amount) public returns (bool)",
            "function transfer(address to, uint256 amount) public returns (bool)",
            "function allowance(address owner, address spender) public view returns (uint256)",
            "function balanceOf(address account) public view returns (uint256)"
        ];

        const tokenContract = new ethers.Contract(fromTokenAddress, erc20Abi, signer);

        // Check current allowance
        const signerAddress = await signer.getAddress();
        const currentAllowance = await tokenContract.allowance(
            signerAddress,
            depositAddress
        );

        console.log("[Axelar] Current allowance:", ethers.formatUnits(currentAllowance, 18));

        // Approve if needed
        if (currentAllowance < transferAmount) {
            console.log(`[Axelar] Approving ${ethers.formatUnits(transferAmount, 18)} tokens...`);

            const approvalTx = await tokenContract.approve(depositAddress, transferAmount);
            await approvalTx.wait();
            console.log("[Axelar] Approval successful.");
        }

        // Transfer tokens to deposit address
        console.log("[Axelar] Sending tokens to deposit address...");
        const transferTx = await tokenContract.transfer(depositAddress, transferAmount);
        const receipt = await transferTx.wait();

        console.log("[Axelar] Tokens sent:", receipt.transactionHash);

        const explorerUrl = `https://axelarscan.io/gmp/${receipt.transactionHash}`;

        // Notify via socket
        if (socket && toPlayerId) {
            socket.emit("privateMessage", {
                to: toPlayerId,
                type: "TRADE_CONFIRMED",
                txHash: receipt.transactionHash,
                explorerUrl,
                amount: amount.toString(),
                fromChain,
                toChain,
            });
        }

        return {
            txHash: receipt.transactionHash,
            explorerUrl,
            depositAddress
        };

    } catch (error) {
        console.error("[Axelar] Trade failed:", error);

        // Notify about failure via socket
        if (socket && toPlayerId) {
            socket.emit("privateMessage", {
                to: toPlayerId,
                type: "TRADE_FAILED",
                error: error.message,
                fromChain,
                toChain,
            });
        }

        throw error;
    }
}

// Helper function to get supported chains
export function getSupportedChains() {
    return {
        testnet: CHAINS.TESTNET,
        mainnet: CHAINS.MAINNET
    };
}

// Manual mapping of chain IDs to Axelar chain objects
const CHAIN_ID_TO_AXELAR_CHAIN = {
    // Testnet mappings
    testnet: {
        43113: () => CHAINS.TESTNET.AVALANCHE,    // Avalanche Fuji
        1287: () => CHAINS.TESTNET.MOONBEAM,      // Moonbeam Alpha
        80001: () => CHAINS.TESTNET.POLYGON,      // Polygon Mumbai
        5: () => CHAINS.TESTNET.ETHEREUM,         // Ethereum Goerli
        97: () => CHAINS.TESTNET.BINANCE,         // BSC Testnet
        250: () => CHAINS.TESTNET.FANTOM,         // Fantom Testnet
        421613: () => CHAINS.TESTNET.ARBITRUM,    // Arbitrum Goerli
        420: () => CHAINS.TESTNET.OPTIMISM,       // Optimism Goerli
        // Add more testnet chains as needed
    },
    // Mainnet mappings (if needed)
    mainnet: {
        43114: () => CHAINS.MAINNET.AVALANCHE,    // Avalanche Mainnet
        1284: () => CHAINS.MAINNET.MOONBEAM,      // Moonbeam Mainnet
        137: () => CHAINS.MAINNET.POLYGON,        // Polygon Mainnet
        1: () => CHAINS.MAINNET.ETHEREUM,         // Ethereum Mainnet
        56: () => CHAINS.MAINNET.BINANCE,         // BSC Mainnet
        250: () => CHAINS.MAINNET.FANTOM,         // Fantom Mainnet
        42161: () => CHAINS.MAINNET.ARBITRUM,     // Arbitrum Mainnet
        10: () => CHAINS.MAINNET.OPTIMISM,        // Optimism Mainnet
        // Add more mainnet chains as needed
    }
};

// Helper function to get Axelar chain object by chain ID
export function getAxelarChainByChainId(chainId, environment = "testnet") {
    const chainMapping = CHAIN_ID_TO_AXELAR_CHAIN[environment];

    if (!chainMapping) {
        throw new Error(`Environment '${environment}' not supported. Use 'testnet' or 'mainnet'.`);
    }

    const getChainFn = chainMapping[chainId];
    if (!getChainFn) {
        const availableChainIds = Object.keys(chainMapping);
        throw new Error(`Chain ID ${chainId} not found in ${environment}. Available chain IDs: ${availableChainIds.join(', ')}`);
    }

    const chainObject = getChainFn();

    return {
        chainObject,
        chainId: chainId,
        environment
    };
}

// Helper function to check if asset is supported
export async function isAssetSupported(fromChain, toChain, asset) {
    try {
        const sdk = new AxelarAssetTransfer({
            environment: Environment.TESTNET
        });

        // This will throw if not supported
        await sdk.getDepositAddress({
            fromChain,
            toChain,
            destinationAddress: "0x0000000000000000000000000000000000000000", // dummy address
            asset
        });

        return true;
    } catch (error) {
        console.log(`Asset ${asset} not supported between ${fromChain} and ${toChain}`);
        return false;
    }
}