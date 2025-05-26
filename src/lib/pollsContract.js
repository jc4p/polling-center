import { encodeFunctionData } from 'viem';

export class PollsContract {
  constructor(blockchainClient) {
    this.client = blockchainClient;
  }

  async createPoll(pollId, creatorFid, durationDays, optionCount) {
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

    // Use ethProvider to send the transaction
    const txHash = await this.client.sendTransaction(data);
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