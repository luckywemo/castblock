import { sdk } from '@farcaster/frame-sdk';

// Initialize the SDK
sdk.init();

// DOM Elements
const connectButton = document.getElementById('connect-button');
const castButton = document.getElementById('cast-button');
const messageInput = document.getElementById('message-input');
const connectionStatus = document.getElementById('connection-status');
const userInfo = document.getElementById('user-info');
const addressInput = document.getElementById('address-input');
const addAddressButton = document.getElementById('add-address-button');
const leaderboardBody = document.getElementById('leaderboard-body');
const nftViewerSection = document.getElementById('nft-viewer-section');
const nftOwner = document.getElementById('nft-owner');
const nftList = document.getElementById('nft-list');
const closeNftViewer = document.getElementById('close-nft-viewer');

// State
let isConnected = false;
let userAddress = null;
let leaderboard = [];

// Helper: Resolve Farcaster username to Ethereum address
async function resolveFarcasterUsername(username) {
    // Example: Use the Neynar API (public Farcaster API)
    // Replace 'YOUR_NEYNAR_API_KEY' with your actual API key if needed
    try {
        const res = await fetch(`https://api.neynar.com/v2/farcaster/user-by-username?username=${username}`, {
            headers: { 'accept': 'application/json', 'api_key': 'NEYNAR_PUBLIC_KEY' }
        });
        const data = await res.json();
        return data?.result?.user?.verified_addresses?.eth_addresses?.[0] || null;
    } catch (e) {
        return null;
    }
}

// Helper: Fetch NFT count and NFTs for an address (using Alchemy API as example)
async function fetchNfts(address) {
    // You can use your own Alchemy API key for production
    const apiKey = 'demo'; // Replace with your Alchemy API key
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${address}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return {
            count: data?.ownedNfts?.length || 0,
            nfts: data?.ownedNfts || []
        };
    } catch (e) {
        return { count: 0, nfts: [] };
    }
}

// Helper: Fetch Farcaster activity (number of casts)
async function fetchFarcasterActivity(address) {
    // Example: Use Neynar API to get user by address and count their casts
    try {
        const res = await fetch(`https://api.neynar.com/v2/farcaster/user-by-verification?address=${address}`, {
            headers: { 'accept': 'application/json', 'api_key': 'NEYNAR_PUBLIC_KEY' }
        });
        const data = await res.json();
        const fid = data?.result?.user?.fid;
        if (!fid) return 0;
        // Fetch casts for this fid
        const castsRes = await fetch(`https://api.neynar.com/v2/farcaster/casts?fid=${fid}&limit=100`, {
            headers: { 'accept': 'application/json', 'api_key': 'NEYNAR_PUBLIC_KEY' }
        });
        const castsData = await castsRes.json();
        return castsData?.result?.casts?.length || 0;
    } catch (e) {
        return 0;
    }
}

// Connect wallet
async function connectWallet() {
    try {
        const { address } = await sdk.connectWallet();
        isConnected = true;
        userAddress = address;
        connectionStatus.textContent = 'Connected';
        connectionStatus.style.backgroundColor = '#d4edda';
        castButton.disabled = false;
        userInfo.textContent = `Connected with: ${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        connectionStatus.textContent = 'Connection failed';
        connectionStatus.style.backgroundColor = '#f8d7da';
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

// Add to leaderboard
addAddressButton.addEventListener('click', async () => {
    let input = addressInput.value.trim();
    if (!input) return;
    addAddressButton.disabled = true;
    addAddressButton.textContent = 'Adding...';
    let address = input;
    let username = null;
    // If input looks like a username (no 0x prefix), resolve it
    if (!input.startsWith('0x')) {
        username = input;
        address = await resolveFarcasterUsername(input);
        if (!address) {
            alert('Could not resolve Farcaster username to Ethereum address.');
            addAddressButton.disabled = false;
            addAddressButton.textContent = 'Add to Leaderboard';
            return;
        }
    }
    // Fetch NFT count and Farcaster activity
    const [nftData, activity] = await Promise.all([
        fetchNfts(address),
        fetchFarcasterActivity(address)
    ]);
    leaderboard.push({
        address,
        username: username || address,
        nftCount: nftData.count,
        nfts: nftData.nfts,
        activity
    });
    renderLeaderboard();
    addressInput.value = '';
    addAddressButton.disabled = false;
    addAddressButton.textContent = 'Add to Leaderboard';
});

// Render leaderboard
function renderLeaderboard() {
    leaderboardBody.innerHTML = '';
    leaderboard.forEach((entry, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.username}</td>
            <td>${entry.nftCount}</td>
            <td>${entry.activity}</td>
            <td><button data-idx="${idx}" class="view-nfts-btn">View NFTs</button></td>
        `;
        leaderboardBody.appendChild(row);
    });
    // Add event listeners for NFT view buttons
    document.querySelectorAll('.view-nfts-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            showNftViewer(idx);
        });
    });
}

// Show NFT viewer
function showNftViewer(idx) {
    const entry = leaderboard[idx];
    nftOwner.textContent = entry.username;
    nftList.innerHTML = '';
    if (entry.nfts.length === 0) {
        nftList.innerHTML = '<p>No NFTs found.</p>';
    } else {
        entry.nfts.forEach(nft => {
            const div = document.createElement('div');
            div.className = 'nft-item';
            div.innerHTML = `
                <img src="${nft.media?.[0]?.gateway || ''}" alt="NFT" style="max-width:100px;max-height:100px;" />
                <div>${nft.title || 'Untitled'}</div>
                <div>${nft.contract?.address?.slice(0, 6)}...${nft.contract?.address?.slice(-4)}</div>
            `;
            nftList.appendChild(div);
        });
    }
    nftViewerSection.style.display = 'block';
}

closeNftViewer.addEventListener('click', () => {
    nftViewerSection.style.display = 'none';
});

// Event Listeners
connectButton.addEventListener('click', connectWallet);
castButton.addEventListener('click', castMessage);

// Check if already connected
sdk.isConnected().then(connected => {
    if (connected) {
        connectWallet();
    }
}); 