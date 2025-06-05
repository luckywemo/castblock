import { sdk } from '@farcaster/frame-sdk';

// Initialize the SDK
sdk.init();

// Configuration
const config = {
    NEYNAR_API_KEY: 'YOUR_NEYNAR_API_KEY', // Replace with your Neynar API key
    ALCHEMY_API_KEY: 'YOUR_ALCHEMY_API_KEY', // Replace with your Alchemy API key
    SORT_OPTIONS: {
        NFT_COUNT: 'nftCount',
        ACTIVITY: 'activity',
        NAME: 'username'
    }
};

// DOM Elements
const connectButton = document.getElementById('connect-button');
const castButton = document.getElementById('cast-button');
const messageInput = document.getElementById('message-input');
const connectionStatus = document.getElementById('connection-status');
const userInfo = document.getElementById('user-info');
const addressInput = document.getElementById('address-input');
const addAddressButton = document.getElementById('add-address-button');
const leaderboardBody = document.getElementById('leaderboard-body');
const sortButtons = document.querySelectorAll('.sort-btn');
const nftViewerSection = document.getElementById('nft-viewer-section');
const nftOwner = document.getElementById('nft-owner');
const nftList = document.getElementById('nft-list');
const closeNftViewer = document.getElementById('close-nft-viewer');

// State
let isConnected = false;
let userAddress = null;
let leaderboardData = [];
let currentSort = {
    field: config.SORT_OPTIONS.NFT_COUNT,
    ascending: false
};

// Loading States
function setLoading(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText;
    }
}

// Error Handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.container').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Helper: Resolve Farcaster username to Ethereum address
async function resolveFarcasterUsername(username) {
    try {
        const res = await fetch(`https://api.neynar.com/v2/farcaster/user-by-username?username=${username}`, {
            headers: { 
                'accept': 'application/json', 
                'api_key': config.NEYNAR_API_KEY 
            }
        });
        const data = await res.json();
        if (!data?.result?.user?.verified_addresses?.eth_addresses?.[0]) {
            throw new Error('No Ethereum address found for this username');
        }
        return data.result.user.verified_addresses.eth_addresses[0];
    } catch (e) {
        throw new Error(`Failed to resolve username: ${e.message}`);
    }
}

// Helper: Fetch NFT count and NFTs for an address
async function fetchNfts(address) {
    try {
        const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${config.ALCHEMY_API_KEY}/getNFTsForOwner?owner=${address}`;
        const res = await fetch(url);
        const data = await res.json();
        return {
            count: data?.ownedNfts?.length || 0,
            nfts: data?.ownedNfts || []
        };
    } catch (e) {
        throw new Error(`Failed to fetch NFTs: ${e.message}`);
    }
}

// Helper: Fetch Farcaster activity
async function fetchFarcasterActivity(address) {
    try {
        const res = await fetch(`https://api.neynar.com/v2/farcaster/user-by-verification?address=${address}`, {
            headers: { 
                'accept': 'application/json', 
                'api_key': config.NEYNAR_API_KEY 
            }
        });
        const data = await res.json();
        const fid = data?.result?.user?.fid;
        if (!fid) return 0;

        const castsRes = await fetch(`https://api.neynar.com/v2/farcaster/casts?fid=${fid}&limit=100`, {
            headers: { 
                'accept': 'application/json', 
                'api_key': config.NEYNAR_API_KEY 
            }
        });
        const castsData = await castsRes.json();
        return castsData?.result?.casts?.length || 0;
    } catch (e) {
        throw new Error(`Failed to fetch Farcaster activity: ${e.message}`);
    }
}

// Connect wallet
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAddress = accounts[0];
            connectionStatus.textContent = 'Connected: ' + userAddress;
            connectionStatus.classList.add('connected');
            connectButton.textContent = 'Connected';
            connectButton.disabled = true;
            userInfo.textContent = `Connected with: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Failed to connect wallet. Please try again.');
        }
    } else {
        alert('Please install MetaMask to use this application.');
    }
}

// Cast message
async function castMessage() {
    if (!isConnected || !messageInput.value.trim()) return;

    try {
        await sdk.cast({
            text: messageInput.value
        });
        messageInput.value = '';
        alert('Message cast successfully!');
    } catch (error) {
        console.error('Failed to cast message:', error);
        alert('Failed to cast message. Please try again.');
    }
}

// Fetch leaderboard data
async function fetchLeaderboard() {
    try {
        const response = await fetch('http://localhost:3000/api/leaderboard');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        leaderboardData = await response.json();
        renderLeaderboard();
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        alert('Failed to load leaderboard data.');
    }
}

// Render leaderboard
function renderLeaderboard() {
    leaderboardBody.innerHTML = '';
    leaderboardData.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username} (${user.address})</td>
            <td>${user.nftCount}</td>
            <td>${user.activityScore}</td>
            <td>
                <button onclick="viewNFTs('${user.address}')">View NFTs</button>
                <button onclick="removeUser('${user.address}')">Remove</button>
            </td>
        `;
        leaderboardBody.appendChild(row);
    });
}

// Add user to leaderboard
async function addUser() {
    const address = addressInput.value.trim();
    if (!address) {
        alert('Please enter an Ethereum address or Farcaster username.');
        return;
    }
    try {
        const response = await fetch('http://localhost:3000/api/add-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, username: address })
        });
        if (!response.ok) throw new Error('Failed to add user');
        alert('User added successfully!');
        addressInput.value = '';
        fetchLeaderboard();
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Failed to add user. Please try again.');
    }
}

// Remove user from leaderboard
async function removeUser(address) {
    if (!confirm('Are you sure you want to remove this user?')) return;
    try {
        const response = await fetch(`http://localhost:3000/api/remove-user/${address}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to remove user');
        alert('User removed successfully!');
        fetchLeaderboard();
    } catch (error) {
        console.error('Error removing user:', error);
        alert('Failed to remove user. Please try again.');
    }
}

// View NFTs for a user
async function viewNFTs(address) {
    try {
        const response = await fetch(`http://localhost:3000/api/nfts/${address}`);
        if (!response.ok) throw new Error('Failed to fetch NFTs');
        const nfts = await response.json();
        nftOwner.textContent = address;
        nftList.innerHTML = nfts.map(nft => `
            <div class="nft-item">
                <h3>${nft.name}</h3>
                <p>Collection: ${nft.collection}</p>
            </div>
        `).join('');
        nftViewerSection.style.display = 'block';
    } catch (error) {
        console.error('Error fetching NFTs:', error);
        alert('Failed to load NFTs. Please try again.');
    }
}

// Sort leaderboard
function sortLeaderboard(sortBy) {
    leaderboardData.sort((a, b) => {
        if (sortBy === 'username') return a.username.localeCompare(b.username);
        if (sortBy === 'nftCount') return b.nftCount - a.nftCount;
        if (sortBy === 'activity') return b.activityScore - a.activityScore;
        return 0;
    });
    renderLeaderboard();
}

// Event Listeners
connectButton.addEventListener('click', connectWallet);
castButton.addEventListener('click', castMessage);
addAddressButton.addEventListener('click', addUser);
closeNftViewer.addEventListener('click', () => {
    nftViewerSection.style.display = 'none';
});
sortButtons.forEach(button => {
    button.addEventListener('click', () => {
        sortLeaderboard(button.dataset.sort);
    });
});

// Initial load
fetchLeaderboard();

// Check if already connected
sdk.isConnected().then(connected => {
    if (connected) {
        connectWallet();
    }
}); 