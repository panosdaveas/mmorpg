import { WalletConnector } from "../web3/Wallet.js";

export function connectWallet(player) {
    const wallet = new WalletConnector(player);
    wallet.connect();
}