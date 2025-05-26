import { encodeFunctionData, parseAbi } from 'viem';
import * as frame from '@farcaster/frame-sdk';

export class FrameBlockchainClient {
  constructor() {
    this.ethProvider = null;
    this.contractAddress = process.env.NEXT_PUBLIC_POLLS_CONTRACT_ADDRESS;
    this.contractAbi = parseAbi([
      'function createPoll(string calldata pollId, uint256 creatorFid, uint256 durationDays, uint256 optionCount) external',
      'function submitVote(string calldata pollId, uint256 optionIndex, uint256 voterFid) external',
      'event PollCreated(string indexed pollId, address indexed creator, uint256 indexed creatorFid, uint256 expiresAt)',
      'event VoteCast(string indexed pollId, address indexed voter, uint256 indexed fid, uint256 optionIndex)'
    ]);
  }

  async initialize() {
    // Initialize Frame SDK ethProvider only
    await frame.sdk.actions.ready();
    this.ethProvider = frame.sdk.wallet.ethProvider;

    // Verify Base network
    await this.ensureBaseNetwork();
  }

  async ensureBaseNetwork() {
    const chainId = await this.ethProvider.request({method: 'eth_chainId'});
    const chainIdDecimal = parseInt(chainId, 16);
    
    if (chainIdDecimal !== 8453) {
      await this.ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }] // Base mainnet
      });
    }
  }

  async getAccount() {
    const accounts = await this.ethProvider.request({
      method: 'eth_requestAccounts'
    });
    return accounts[0];
  }

  // Viem for transaction construction, ethProvider for submission
  async sendTransaction(data) {
    const account = await this.getAccount();
    
    return await this.ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account,
        to: this.contractAddress,
        data: data
      }]
    });
  }
}