import { encodeFunctionData } from 'viem';

export class PollsContract {
  constructor(blockchainClient) {
    this.client = blockchainClient;
  }

  async createPoll(pollId, creatorFid, durationDays, optionCount) {
    console.log('🚀 Creating poll with parameters:');
    console.log(`  pollId: ${pollId} (type: ${typeof pollId})`);
    console.log(`  creatorFid: ${creatorFid} (type: ${typeof creatorFid})`);
    console.log(`  durationDays: ${durationDays} (type: ${typeof durationDays})`);
    console.log(`  optionCount: ${optionCount} (type: ${typeof optionCount})`);
    
    // Use viem to encode the function call
    const data = encodeFunctionData({
      abi: this.client.contractAbi,
      functionName: 'createPoll',
      args: [
        pollId,
        BigInt(creatorFid),
        BigInt(durationDays), 
        BigInt(optionCount)
      ]
    });

    console.log(`📦 Encoded transaction data: ${data}`);

    // Use ethProvider to send the transaction
    const txHash = await this.client.sendTransaction(data);
    console.log(`✅ Transaction sent with hash: ${txHash}`);
    return txHash;
  }

  async submitVote(pollId, optionIndex, voterFid) {
    // Use viem to encode the function call
    const data = encodeFunctionData({
      abi: this.client.contractAbi,
      functionName: 'submitVote',
      args: [pollId, BigInt(optionIndex), BigInt(voterFid)]
    });

    // Use ethProvider to send the transaction
    const txHash = await this.client.sendTransaction(data);
    return txHash;
  }
}