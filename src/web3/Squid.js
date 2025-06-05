// sendCrossChainAsset.js
import { Squid } from "@0xsquid/sdk";
import { ethers } from "ethers";

export async function sendCrossChainAsset({
  fromChainId,
  toChainId,
  fromToken,
  toToken,
  fromAmount,
  toAddress,
  signer,
}) {
  const integratorId = "blockchain-mmorpg-1af278cc-03d4-4c43-97b7-ce04979ab693";
  if (!integratorId) {
    throw new Error("Missing Squid integratorId");
  }

  const squid = new Squid({
    baseUrl: "https://apiplus.squidrouter.com",
    integratorId
  });

  await squid.init();
  console.log("[Squid] Initialized");

  const params = {
    fromAddress: signer,
    fromChain: String(fromChainId),
    fromToken: fromToken,
    fromAmount: fromAmount,
    toChain: String(toChainId),
    toToken: toToken,
    toAddress: toAddress,
    enableBoost: true,
  };

  console.log("[Squid] Fetching route:", params);
  console.log("[Squid] Route Params:", JSON.stringify(params, null, 2));
  // const { route, requestId } = await squid.getRoute(params);
  let route, requestId;

  try {
    const result = await squid.getRoute(params);
    route = result.route;
    requestId = result.requestId;
  } catch (err) {
    if (err.response) {
      console.error("[Squid] Route request failed with 500:", err.response.data);
    } else {
      console.error("[Squid] Unexpected error getting route:", err.message || err);
    }
    throw err; // rethrow to stop execution
  }
  console.log("[Squid] Route estimated output:", route.estimate.toAmount);

  const transactionRequest = route.transactionRequest;

  // Approve token spending
  const erc20Abi = ["function approve(address spender, uint256 amount) public returns (bool)"];
  const tokenContract = new ethers.Contract(fromToken, erc20Abi, signer);

  console.log(`[Squid] Approving ${fromAmount} for`, transactionRequest.target);
  const approvalTx = await tokenContract.approve(transactionRequest.target, fromAmount);
  await approvalTx.wait();
  console.log("[Squid] Approval confirmed");

  // Execute the transaction
  console.log("[Squid] Executing cross-chain transaction...");
  const tx = await squid.executeRoute({ signer, route });
  const receipt = await tx.wait();
  console.log("[Squid] Transaction confirmed:", receipt.transactionHash);

  // Optional: check status via Squid API
  const statusCheck = async () => {
    const maxRetries = 10;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const params = {
      transactionId: receipt.transactionHash,
      requestId,
      integratorId,
      fromChainId,
      toChainId
    };

    let status;
    let attempts = 0;

    do {
      await delay(5000);
      status = await squid.getStatus(params);
      console.log(`[Squid] Route status: ${status.squidTransactionStatus}`);
      attempts++;
    } while (status && !["success", "partial_success", "needs_gas", "not_found"].includes(status.squidTransactionStatus) && attempts < maxRetries);

    return status;
  };

  const finalStatus = await statusCheck();
  console.log("[Squid] Final transaction status:", finalStatus.squidTransactionStatus);

  return {
    txHash: receipt.transactionHash,
    axelarScan: `https://axelarscan.io/gmp/${receipt.transactionHash}`,
    status: finalStatus.squidTransactionStatus
  };
}