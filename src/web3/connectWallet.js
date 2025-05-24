import { ethers } from "ethers";

export async function connectWithMetaMask() {
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask is not installed!");
        return;
    }

    try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Create an ethers provider
        const provider = new ethers.providers.Web3Provider(window.ethereum);

        // Get the signer (the user)
        const signer = provider.getSigner();

        // Get user's address
        const address = await signer.getAddress();

        console.log("Connected wallet address:", address);
        return { provider, signer, address };
    } catch (error) {
        console.error("Error connecting to MetaMask:", error);
    }
}