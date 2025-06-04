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

            console.log("Connected address:", address);
            this.localPlayer.setAttribute("address", address);

            this.addListeners();
            return this.signer;
        } catch (err) {
            console.error("MetaMask connection error:", err);
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