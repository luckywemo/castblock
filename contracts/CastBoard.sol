// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CastBoard {
    struct User {
        string username;
        uint256 nftCount;
        uint256 activityScore;
        bool isActive;
    }

    mapping(address => User) public users;
    address[] public userAddresses;
    
    event UserAdded(address indexed userAddress, string username);
    event UserUpdated(address indexed userAddress, uint256 nftCount, uint256 activityScore);
    event UserRemoved(address indexed userAddress);

    function addUser(address _userAddress, string memory _username) external {
        require(!users[_userAddress].isActive, "User already exists");
        require(bytes(_username).length > 0, "Username cannot be empty");

        users[_userAddress] = User({
            username: _username,
            nftCount: 0,
            activityScore: 0,
            isActive: true
        });

        userAddresses.push(_userAddress);
        emit UserAdded(_userAddress, _username);
    }

    function updateUser(address _userAddress, uint256 _nftCount, uint256 _activityScore) external {
        require(users[_userAddress].isActive, "User does not exist");

        users[_userAddress].nftCount = _nftCount;
        users[_userAddress].activityScore = _activityScore;

        emit UserUpdated(_userAddress, _nftCount, _activityScore);
    }

    function removeUser(address _userAddress) external {
        require(users[_userAddress].isActive, "User does not exist");

        users[_userAddress].isActive = false;
        
        // Remove from userAddresses array
        for (uint i = 0; i < userAddresses.length; i++) {
            if (userAddresses[i] == _userAddress) {
                userAddresses[i] = userAddresses[userAddresses.length - 1];
                userAddresses.pop();
                break;
            }
        }

        emit UserRemoved(_userAddress);
    }

    function getUserCount() external view returns (uint256) {
        return userAddresses.length;
    }

    function getActiveUsers() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint i = 0; i < userAddresses.length; i++) {
            if (users[userAddresses[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeUsers = new address[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint i = 0; i < userAddresses.length; i++) {
            if (users[userAddresses[i]].isActive) {
                activeUsers[currentIndex] = userAddresses[i];
                currentIndex++;
            }
        }

        return activeUsers;
    }
} 