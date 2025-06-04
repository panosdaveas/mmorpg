import { Squid } from '@0xsquid/sdk';
import { ethers } from 'ethers';

export async function sendCrossChainAsset({
  fromChainId,
  toChainId,
  fromToken,
  toToken,
  fromAmount,       // in smallest unit (e.g., 1 USDC = 1000000)
  toAddress,        // destination wallet (e.g., remote player)
  signer
}) {

  const integratorId = "blockchain-mmorpg-1af278cc-03d4-4c43-97b7-ce04979ab693";
  const squid = new Squid({
      baseUrl: "https://apiplus.squidrouter.com",
      integratorId: integratorId
  });

  await squid.init();

  const sender = await signer;

  // 1. Build route request
  const route = await squid.getRoute({
    fromChain: fromChainId.toString(),
    toChain: toChainId.toString(),
    fromToken,
    toToken,
    fromAmount: fromAmount.toString(),
    toAddress,
    sender,
    slippage: 1.0 // 1% slippage
  });

  if (!route) throw new Error("No route found");

  console.log("🧭 Best route:", route);

  // Optional: Show estimated amount user will receive
  console.log(`Estimated to receive: ${ethers.utils.formatUnits(route.estimate.toAmount, 6)} tokens`);

  // 2. Execute the route
  const txRequest = await squid.executeRoute({ signer, route });

  console.log("🚀 Transaction sent:", txRequest.hash);

  // 3. Listen for execution status
  squid.on("RouteExecutionCompleted", (tx) => {
    console.log("✅ Route complete:", tx);
    // You could notify the recipient player here
  });

  return txRequest;
}