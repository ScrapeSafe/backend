import { http } from "viem";
import { Account, privateKeyToAccount, Address } from "viem/accounts";
import { StoryClient, StoryConfig } from "@story-protocol/core-sdk";

const privateKey: Address = "0xbb74ba59a232552ea71d883c000a3185945729617f8551598ec26ab46b2d45ac";
const account: Account = privateKeyToAccount(privateKey);

const config: StoryConfig = {
    account: account, // the account object from above
    transport: http(process.env.RPC_PROVIDER_URL),
    chainId: "aeneid",
};
export const client = StoryClient.newClient(config);