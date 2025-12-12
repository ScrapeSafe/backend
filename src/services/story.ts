// Story Protocol integration service
import { client } from "../utils/storyutlis";
import { uploadJSONToIPFS } from "../utils/uploadToIpfs";
import { createHash } from "crypto";
import { PILFlavor, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";
import { parseEther } from "viem";

interface StoryIpRegistration {
  ipId: string;
  txHash?: string;
  simulated: boolean;
}


export function isStoryConfigured(): boolean {
  return !!process.env.STORY_SDK_KEY;
}

export async function mintAndRegisterIp(
  siteId: number,
  domain: string,
  ownerAddress: string,
  imageUrl: string = "https://picsum.photos/200"
) {
  console.log(`[Story] Minting and Registering IP for ${domain}...`);

  const ipMetadata = {
    title: domain,
    description: `IP Asset for ${domain}`,
    image: imageUrl,
    mediaUrl: imageUrl,
    creators: [],
  };

  const nftMetadata = {
    name: `Ownership NFT for ${domain}`,
    description: `This is an NFT representing ownership of the IP Asset ${domain}`,
    image: imageUrl,
  };

  const ipIpfsHash = await uploadJSONToIPFS(ipMetadata);
  const ipHash = createHash("sha256")
    .update(JSON.stringify(ipMetadata))
    .digest("hex");
  const nftIpfsHash = await uploadJSONToIPFS(nftMetadata);
  const nftHash = createHash("sha256")
    .update(JSON.stringify(nftMetadata))
    .digest("hex");

  const response = await client.ipAsset.registerIpAsset({
    nft: {
      type: "mint",
      spgNftContract: "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc",
    },
    licenseTermsData: [
      {
        terms: PILFlavor.commercialRemix({
          commercialRevShare: 5,
          defaultMintingFee: parseEther("1"), // 1 WIP (Testnet IP)
          currency: WIP_TOKEN_ADDRESS,
        }),
      },
    ],
    ipMetadata: {
      ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
      ipMetadataHash: `0x${ipHash}`,
      nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
      nftMetadataHash: `0x${nftHash}`,
    },
  });

  if (!response.ipId) {
    throw new Error("Failed to register IP: ipId is missing");
  }

  console.log(
    `[Story] Root IPA created at transaction hash ${response.txHash}, IPA ID: ${response.ipId}`
  );

  return {
    ipId: response.ipId as string,
    txHash: response.txHash,
    simulated: false,
  };
}


export async function registerIpAsset(
  siteId: number,
  domain: string,
  ownerAddress: string
): Promise<StoryIpRegistration> {
  const sdkKey = process.env.STORY_SDK_KEY;

  if (!sdkKey) {
    const simulatedIpId = `story:local:${siteId}`;
    console.log(`[Story] Simulated IP registration for ${domain}: ${simulatedIpId}`);
    return {
      ipId: simulatedIpId,
      simulated: true,
    };
  }

  try {
    return await mintAndRegisterIp(siteId, domain, ownerAddress);
  } catch (error) {
    console.error('[Story] Registration failed, falling back to simulation:', error);
    const simulatedIpId = `story:local:${siteId}`;
    return {
      ipId: simulatedIpId,
      simulated: true,
    };
  }
}


export function parseSiteIdFromIpId(ipId: string): number | null {
  const localMatch = ipId.match(/^story:local:(\d+)$/);
  if (localMatch && localMatch[1]) {
    return parseInt(localMatch[1], 10);
  }

  const numericId = parseInt(ipId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }

  return null;
}

