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
const nftViewerSection = document.getElementById('nft-viewer-section');
const nftOwner = document.getElementById('nft-owner');
const nftList = document.getElementById('nft-list');
const closeNftViewer = document.getElementById('close-nft-viewer');

// State
let isConnected = false;
let userAddress = null;
let leaderboard = [];
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

// Sort leaderboard
function sortLeaderboard(field) {
    if (currentSort.field === field) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.field = field;
        currentSort.ascending = false;
    }

    leaderboard.sort((a, b) => {
        let comparison = 0;
        if (field === config.SORT_OPTIONS.NFT_COUNT) {
            comparison = a.nftCount - b.nftCount;
        } else if (field === config.SORT_OPTIONS.ACTIVITY) {
            comparison = a.activity - b.activity;
        } else {
            comparison = a.username.localeCompare(b.username);
        }
        return currentSort.ascending ? comparison : -comparison;
    });

    renderLeaderboard();
}

// Connect wallet
async function connectWallet() {
    setLoading(connectButton, true);
    try {
        const { address } = await sdk.connectWallet();
        isConnected = true;
        userAddress = address;
        connectionStatus.textContent = 'Connected';
        connectionStatus.style.backgroundColor = '#d4edda';
        castButton.disabled = false;
        userInfo.textContent = `Connected with: ${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch (error) {
        connectionStatus.textContent = 'Connection failed';
        connectionStatus.style.backgroundColor = '#f8d7da';
        showError('Failed to connect wallet: ' + error.message);
    } finally {
        setLoading(connectButton, false);
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
    if (!input) {
        showError('Please enter an address or username');
        return;
    }

    setLoading(addAddressButton, true);
    try {
        let address = input;
        let username = null;

        if (!input.startsWith('0x')) {
            username = input;
            address = await resolveFarcasterUsername(input);
        }

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
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(addAddressButton, false);
    }
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
            <td>
                <button data-idx="${idx}" class="view-nfts-btn">View NFTs</button>
                <button data-idx="${idx}" class="remove-btn">Remove</button>
            </td>
        `;
        leaderboardBody.appendChild(row);
    });

    // Add event listeners
    document.querySelectorAll('.view-nfts-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            showNftViewer(idx);
        });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            leaderboard.splice(idx, 1);
            renderLeaderboard();
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
                <div class="nft-info">
                    <div class="nft-title">${nft.title || 'Untitled'}</div>
                    <div class="nft-contract">${nft.contract?.address?.slice(0, 6)}...${nft.contract?.address?.slice(-4)}</div>
                    <div class="nft-description">${nft.description || 'No description available'}</div>
                </div>
            `;
            nftList.appendChild(div);
        });
    }
    nftViewerSection.style.display = 'block';
}

// Close NFT viewer
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