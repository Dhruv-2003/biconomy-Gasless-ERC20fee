import Head from "next/head";
import Image from "next/image";
import { Inter } from "@next/font/google";
import styles from "../styles/Home.module.css";
import { BalancesDto } from "@biconomy/node-client";
import SocialLogin from "@biconomy/web3-auth";
import { ChainId, FeeQuote } from "@biconomy/core-types";
import SmartAccount from "@biconomy/smart-account";
import { ethers } from "ethers";
import { useState, useEffect, useRef } from "react";

import { ERC20_TOKEN_ADDRESS, ERC20_interface } from "../constants";

const inter = Inter({ subsets: ["latin"] });

export default function login() {
  const [isLoggedIn, setisLoggedIn] = useState<boolean | null>(false);
  const [account, setAccount] = useState("");
  const socialLoginSDKRef = useRef<SocialLogin | null>();
  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>();

  const [walletProvider, setWalletProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);

  useEffect(() => {
    initSocialLoginSDK().then(() => {
      if (socialLoginSDKRef?.current?.provider) {
        setupSmartAccount();
      }
    });
  }, [eoaAddress]);

  const initSocialLoginSDK = async () => {
    try {
      const socialLoginSDK = new SocialLogin();
      await socialLoginSDK.init(ethers.utils.hexValue(ChainId.POLYGON_MUMBAI)); // Enter the network id in hex) parameter
      socialLoginSDKRef.current = socialLoginSDK;
      return socialLoginSDK;
    } catch (error) {
      console.log(error);
    }
  };

  const login = async () => {
    try {
      if (!socialLoginSDKRef.current) {
        /// Intialize the Social Login
        await initSocialLoginSDK();
      }
      if (!socialLoginSDKRef.current?.provider) {
        /// Show the Social Login Connect modal
        socialLoginSDKRef.current?.showConnectModal();
        socialLoginSDKRef.current?.showWallet();
      } else {
        /// setup the Smart ContractWallet
        getEOAAccount();
        if (!smartAccount) {
          setupSmartAccount();
        } else {
          getSCWWallet(smartAccount);
        }
      }
      setisLoggedIn(true);
    } catch (error) {
      console.error(error);
    }
  };

  /// get the EOA account
  const getEOAAccount = async () => {
    try {
      if (socialLoginSDKRef.current?.provider) {
        const provider = new ethers.providers.Web3Provider(
          socialLoginSDKRef.current.provider
        );
        const accounts = await provider.listAccounts();
        console.log("EOA address", accounts);
        setEoaAddress(accounts[0]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getSCWWallet = async (smartAccount: SmartAccount) => {
    try {
      if (smartAccount) {
        const smartContractWalletAddress = smartAccount.address;
        console.log("address", smartAccount);
        setSmartAccountAddress(smartContractWalletAddress);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const setupSmartAccount = async () => {
    try {
      const options = {
        activeNetworkId: ChainId.POLYGON_MUMBAI,
        supportedNetworksIds: [
          ChainId.GOERLI,
          ChainId.POLYGON_MAINNET,
          ChainId.POLYGON_MUMBAI,
        ],
        networkConfig: [
          {
            chainId: ChainId.POLYGON_MUMBAI,
            // Optional dappAPIKey (only required if you're using Gasless)
            dappAPIKey: "59fRCMXvk.8a1652f0-b522-4ea7-b296-98628499aee3",
            // if need to override Rpc you can add providerUrl:
          },
        ],
      };

      /// checking if Social login Account is created or not
      if (!socialLoginSDKRef?.current?.provider) return;
      socialLoginSDKRef.current.hideWallet();

      getEOAAccount();

      // intialize Smart Account
      const provider = new ethers.providers.Web3Provider(
        socialLoginSDKRef.current.provider
      );

      let smartAccount = new SmartAccount(provider, options);
      smartAccount = await smartAccount.init();
      setSmartAccount(smartAccount);

      getSCWWallet(smartAccount);
      setisLoggedIn(true);

      smartAccount.on("txHashGenerated", (response: any) => {
        console.log("txHashGenerated event received via emitter", response);
      });
      smartAccount.on("onHashChanged", (response: any) => {
        console.log("onHashChanged event received via emitter", response);
      });
      // Event listener that gets triggered once a transaction is mined
      smartAccount.on("txMined", (response: any) => {
        console.log("txMined event received via emitter", response);
      });
      // Event listener that gets triggered on any error
      smartAccount.on("error", (response: any) => {
        console.log("error event received via emitter", response);
      });
    } catch (error) {
      console.log(error);
    }
  };

  const sendSingleGaslessTransaction = async () => {
    try {
      const erc20Interface = new ethers.utils.Interface([
        "function transfer(address _to, uint256 _value)",
      ]);

      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const encodedData = erc20Interface.encodeFunctionData("transfer", [
        "0xBF17F859989A73C55c7BA5Fefb40e63715216B9b",
        ethers.utils.parseEther("10"),
      ]);

      // You need to create transaction objects of the following interface
      const tx = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: encodedData,
      };

      const txResponse = await smartAccount?.sendGasLessTransaction({
        transaction: tx,
      });

      console.log("tx hash generated", txResponse?.hash);
      // If you do not subscribe to listener, one can also get the receipt like shown below
      const receipt = await txResponse?.wait();
      console.log("tx receipt", receipt);
    } catch (error) {
      console.log(error);
    }
  };

  const sendBatchGaslessTransaction = async () => {
    try {
      const txs = [];
      const erc20Interface = new ethers.utils.Interface(ERC20_interface);

      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const approvalEncodedData = erc20Interface.encodeFunctionData("approve", [
        ERC20_TOKEN_ADDRESS,
        ethers.utils.parseEther("10"),
      ]);

      // You need to create transaction objects of the following interface
      const tx1 = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: approvalEncodedData,
      };

      txs.push(tx1);
      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const TranferFromEncodedData = erc20Interface.encodeFunctionData(
        "transferFrom",
        [
          eoaAddress,
          "0xBF17F859989A73C55c7BA5Fefb40e63715216B9b",
          ethers.utils.parseEther("10"),
        ]
      );

      // You need to create transaction objects of the following interface
      const tx2 = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: TranferFromEncodedData,
      };

      txs.push(tx2);

      // Sending gasless transaction
      const txResponse = await smartAccount?.sendGaslessTransactionBatch({
        transactions: txs,
      });
      console.log("tx hash generated", txResponse?.hash);
      // If you do not subscribe to listener, one can also get the receipt like shown below
      const receipt = await txResponse?.wait();
      console.log("tx receipt", receipt);
    } catch (error) {
      console.log(error);
    }
  };

  const sendSingleERC20Transaction = async () => {
    try {
      const erc20Interface = new ethers.utils.Interface([
        "function transfer(address _to, uint256 _value)",
      ]);

      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const encodedData = erc20Interface.encodeFunctionData("transfer", [
        "0xBF17F859989A73C55c7BA5Fefb40e63715216B9b",
        ethers.utils.parseEther("10"),
      ]);

      // You need to create transaction objects of the following interface
      const tx = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: encodedData,
      };

      const feeQuotes = await smartAccount?.prepareRefundTransaction({
        transaction: tx,
      });

      if (feeQuotes) {
        /// Choose from feeQuotes
        const transaction = await smartAccount?.createRefundTransaction({
          transaction: tx,
          feeQuote: feeQuotes[1], // say user chooses USDC from above
        });

        if (transaction) {
          const txId = await smartAccount?.sendTransaction({
            tx: transaction,
          });

          console.log(txId);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const sendBatchERC20Transaction = async () => {
    try {
      const txs = [];
      const erc20Interface = new ethers.utils.Interface(ERC20_interface);

      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const approvalEncodedData = erc20Interface.encodeFunctionData("approve", [
        ERC20_TOKEN_ADDRESS,
        ethers.utils.parseEther("10"),
      ]);

      // You need to create transaction objects of the following interface
      const tx1 = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: approvalEncodedData,
      };

      txs.push(tx1);
      // Encode an ERC-20 token transfer to recipientAddress of the specified amount
      const TranferFromEncodedData = erc20Interface.encodeFunctionData(
        "transferFrom",
        [
          eoaAddress,
          "0xBF17F859989A73C55c7BA5Fefb40e63715216B9b",
          ethers.utils.parseEther("10"),
        ]
      );

      // You need to create transaction objects of the following interface
      const tx2 = {
        to: ERC20_TOKEN_ADDRESS, // destination smart contract address
        data: TranferFromEncodedData,
      };

      txs.push(tx2);

      const feeQuotes = await smartAccount?.prepareRefundTransactionBatch({
        transactions: txs,
      });

      if (feeQuotes) {
        /// Choose from feeQuotes
        const transaction = await smartAccount?.createRefundTransactionBatch({
          transactions: txs,
          feeQuote: feeQuotes[1], // say user chooses USDC from above
        });

        if (transaction) {
          const txId = await smartAccount?.sendTransaction({
            tx: transaction,
          });

          console.log(txId);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getTokenBalance = async (eoa: string) => {
    try {
      const balanceParams: BalancesDto = {
        // if no chainId is supplied, SDK will automatically pick active one that
        // is being supplied for initialization
        chainId: ChainId.POLYGON_MUMBAI, // chainId of your choice
        eoaAddress: eoa,
        // If empty string you receive balances of all tokens watched by Indexer
        // you can only whitelist token addresses that are listed in token respostory
        // specified above ^
        tokenAddresses: [ERC20_TOKEN_ADDRESS],
      };
    } catch (error) {
      console.log(error);
    }
  };

  const logout = async () => {
    try {
      if (!socialLoginSDKRef.current) {
        console.error("Web3Modal not initialized.");
        return;
      }
      await socialLoginSDKRef.current.logout();
      socialLoginSDKRef.current.hideWallet();
      setSmartAccount(null);
      setEoaAddress(null);
      setSmartAccountAddress(null);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      <main className={styles.main}>
        <div className={styles.description}>
          <h1>Welcome to Biconomy Gasless transaction </h1>
        </div>
        <div>
          <a>EOA Address : {eoaAddress} </a>
          <br />
          {smartAccountAddress && (
            <a>Smart Contract Wallet Address : {smartAccountAddress}</a>
          )}
        </div>
        <div>
          <a>Gasless Transaction</a>
          <button
            onClick={() => {
              sendSingleGaslessTransaction();
            }}
          >
            Send Single{" "}
          </button>
          <button
            onClick={() => {
              sendBatchGaslessTransaction();
            }}
          >
            Send Batch
          </button>
        </div>
        <div>
          <a>ERC20 Gas Fee Transaction</a>
          <button
            onClick={() => {
              sendSingleERC20Transaction();
            }}
          >
            Send Single
          </button>
          <button
            onClick={() => {
              sendBatchERC20Transaction();
            }}
          >
            Send Batch
          </button>
        </div>
        <div className={styles.center}>
          <div className={styles.thirteen}>
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  login();
                } else logout();
              }}
            >
              {!isLoggedIn ? <a>Login</a> : <a>Logout</a>}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
