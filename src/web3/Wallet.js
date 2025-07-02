// wallet.js
import { BrowserProvider } from "ethers";

export class WalletConnector {
    constructor(localPlayer) {
        this.localPlayer = localPlayer;
        this.provider = null;
        this.signer = null;

        // Bind methods to ensure `this` refers to the class instance
        this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
        this.handleChainChanged = this.handleChainChanged.bind(this);
    }

    async connect() {
        if (!window.ethereum) {
            alert("MetaMask not installed");
            return;
        }

        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });
            this.provider = new BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            const address = await this.signer.getAddress();
            const chainId = Number(this.signer.provider._network.chainId);

            console.log("Connected address:", address);
            this.localPlayer.setAttribute("address", address);
            this.localPlayer.setAttribute("chainId", chainId);

            this.addListeners();
        } catch (err) {
            console.error("MetaMask connection error:", err);
        }
        return this.signer;
    }

    /**
     * Send native tokens (ETH, MATIC, etc.) to another player
     * @param {string} recipientAddress - Target wallet address
     * @param {string} amountInEth - Amount in ETH (e.g., "0.1" or "max")
     * @returns {Promise<object>} Transaction result
     */
    async sendNativeToken(recipientAddress, amountInEth) {
        try {
            // 1. Validation
            if (!this.signer) {
                throw new Error("Wallet not connected");
            }

            if (!recipientAddress || recipientAddress.length !== 42) {
                throw new Error("Invalid recipient address");
            }

            // 2. Get current balance
            const senderAddress = await this.signer.getAddress();
            const balance = await this.provider.getBalance(senderAddress);

            console.log(`Current balance: ${formatEther(balance)} ETH`);

            // 3. Estimate gas for the transaction
            const gasLimit = await this.provider.estimateGas({
                to: recipientAddress,
                value: parseEther("0.001") // Use small amount for estimation
            });

            // 4. Get current gas price
            const feeData = await this.provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas;
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

            // 5. Calculate gas cost
            const estimatedGasCost = gasLimit * maxFeePerGas;

            // 6. Handle "max" amount
            let valueToSend;
            if (amountInEth.toLowerCase() === "max") {
                // Send maximum: balance minus gas costs
                valueToSend = balance - estimatedGasCost;
                if (valueToSend <= 0n) {
                    throw new Error("Insufficient balance for gas fees");
                }
            } else {
                valueToSend = parseEther(amountInEth);

                // Check if we have enough for amount + gas
                const totalNeeded = valueToSend + estimatedGasCost;
                if (balance < totalNeeded) {
                    throw new Error(`Insufficient balance. Need ${formatEther(totalNeeded)} ETH, have ${formatEther(balance)} ETH`);
                }
            }

            // 7. Prepare transaction
            const transaction = {
                to: recipientAddress,
                value: valueToSend,
                gasLimit: gasLimit,
                maxFeePerGas: maxFeePerGas,
                maxPriorityFeePerGas: maxPriorityFeePerGas
            };

            console.log("Sending transaction:", {
                to: recipientAddress,
                amount: formatEther(valueToSend) + " ETH",
                estimatedGas: formatEther(estimatedGasCost) + " ETH"
            });

            // 8. Send transaction
            const txResponse = await this.signer.sendTransaction(transaction);

            console.log("Transaction sent! Hash:", txResponse.hash);

            // 9. Return transaction info
            return {
                success: true,
                hash: txResponse.hash,
                amountSent: formatEther(valueToSend),
                gasUsed: formatEther(estimatedGasCost),
                transaction: txResponse
            };

        } catch (error) {
            console.error("Send transaction failed:", error);

            return {
                success: false,
                error: error.message,
                hash: null
            };
        }
    }

    /**
     * Get current balance in ETH
     * @returns {Promise<string>} Balance in ETH
     */
    async getBalance() {
        if (!this.signer) {
            throw new Error("Wallet not connected");
        }

        const address = await this.signer.getAddress();
        const balance = await this.provider.getBalance(address);
        return formatEther(balance);
    }

    /**
     * Estimate transaction cost
     * @param {string} recipientAddress - Target address
     * @param {string} amountInEth - Amount to send
     * @returns {Promise<object>} Cost estimation
     */
    async estimateTransactionCost(recipientAddress, amountInEth) {
        try {
            const gasLimit = await this.provider.estimateGas({
                to: recipientAddress,
                value: parseEther(amountInEth)
            });

            const feeData = await this.provider.getFeeData();
            const estimatedGasCost = gasLimit * feeData.maxFeePerGas;

            return {
                gasLimit: gasLimit.toString(),
                gasCostInEth: formatEther(estimatedGasCost),
                totalCostInEth: formatEther(parseEther(amountInEth) + estimatedGasCost)
            };
        } catch (error) {
            console.error("Gas estimation failed:", error);
            throw error;
        }
    }

    addListeners() {
        window.ethereum.on("accountsChanged", this.handleAccountsChanged);
        window.ethereum.on("chainChanged", this.handleChainChanged);
    }

    removeListeners() {
        window.ethereum.removeListener("accountsChanged", this.handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", this.handleChainChanged);
    }

    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            console.log("Disconnected or locked");
            this.localPlayer.removeAttribute("address");
        } else {
            console.log("Account changed:", accounts[0]);
            this.localPlayer.setAttribute("address", accounts[0]);
        }
    }

    handleChainChanged(chainId) {
        const decimalChainId = parseInt(chainId, 16); // Convert hex to number
        console.log("Network changed to:", decimalChainId);
    }
}