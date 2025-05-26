'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { FrameBlockchainClient } from './blockchain';
import { PollsContract } from './pollsContract';

const Web3Context = createContext();

export function Web3Provider({ children }) {
  const [blockchainClient, setBlockchainClient] = useState(null);
  const [pollsContract, setPollsContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeWeb3();
  }, []);

  const initializeWeb3 = async () => {
    try {
      setIsInitializing(true);
      
      // Create blockchain client
      const client = new FrameBlockchainClient();
      
      // Initialize Frame SDK and ensure Base network
      await client.initialize();
      
      // Get connected account
      const connectedAccount = await client.getAccount();
      
      // Create contract instance
      const contract = new PollsContract(client);
      
      setBlockchainClient(client);
      setPollsContract(contract);
      setAccount(connectedAccount);
      setIsConnected(true);
      
    } catch (error) {
      console.error('Web3 initialization failed:', error);
      setIsConnected(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const value = {
    blockchainClient,
    pollsContract,
    isConnected,
    account,
    isInitializing,
    initializeWeb3
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}