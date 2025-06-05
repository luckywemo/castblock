const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Contract ABI and address
const contractABI = require('./contracts/CastBoard.json').abi;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Initialize provider and contract
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// Farcaster API configuration
const FARCASTER_API_URL = 'https://api.farcaster.xyz/v2';

// Helper function to get Farcaster user data
async function getFarcasterUserData(username) {
    try {
        const response = await axios.get(`${FARCASTER_API_URL}/user/${username}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching Farcaster data:', error);
        throw error;
    }
}

// Helper function to get NFT data
async function getNFTData(address) {
    try {
        // Using Alchemy API for NFT data
        const response = await axios.get(
            `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}/getNFTs/?owner=${address}`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching NFT data:', error);
        throw error;
    }
}

// API Endpoints
app.post('/api/add-user', async (req, res) => {
    try {
        const { address, username } = req.body;
        
        // Get Farcaster data
        const farcasterData = await getFarcasterUserData(username);
        
        // Get NFT data
        const nftData = await getNFTData(address);
        
        // Create signer for contract interaction
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contractWithSigner = contract.connect(signer);
        
        // Add user to contract
        const tx = await contractWithSigner.addUser(address, username);
        await tx.wait();
        
        // Update user data
        await contractWithSigner.updateUser(
            address,
            nftData.totalCount,
            farcasterData.activityScore || 0
        );
        
        res.json({ success: true, message: 'User added successfully' });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const activeUsers = await contract.getActiveUsers();
        const leaderboardData = await Promise.all(
            activeUsers.map(async (address) => {
                const user = await contract.users(address);
                return {
                    address,
                    username: user.username,
                    nftCount: user.nftCount.toNumber(),
                    activityScore: user.activityScore.toNumber()
                };
            })
        );
        
        res.json(leaderboardData);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/remove-user/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contractWithSigner = contract.connect(signer);
        
        const tx = await contractWithSigner.removeUser(address);
        await tx.wait();
        
        res.json({ success: true, message: 'User removed successfully' });
    } catch (error) {
        console.error('Error removing user:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 