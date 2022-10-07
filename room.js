import lodash from "lodash";

const BALANCE = 1000;

export class Room {
    constructor(cricketersRawData) {
        this.cricketersData = JSON.parse(cricketersRawData);
        this.cricketersDataLength = this.cricketersData.length - 1;
    }

    // room ID Maps
    roomId_roomAdmin_map = {};
    roomId_players_map = {};
    roomId_count_map = {};
    roomId_players_balance_map = {};

    // maps for game play
    roomId_sold_cricketers_map = {};
    roomId_current_cricketer_map = {};
    roomId_auctioned_cricketer_map = {};

    roomId_timerId_map = {};

    printAllData = () => {
        console.log(
            "\n",
            "roomId_players_map - ",
            this.roomId_players_map,
            "\n",
            "roomId_players_balance_map - ",
            this.roomId_players_balance_map,
            "\n",
            "roomId_count_map - ",
            this.roomId_count_map,
            "\n",
            "roomId_roomAdmin_map - ",
            this.roomId_roomAdmin_map
        );
    };

    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    deletePlayerData = ({ roomId, playerId }) => {
        delete this.roomId_players_map[roomId]?.[playerId];
        delete this.roomId_players_balance_map[roomId]?.[playerId];
        this.printAllData();
    };

    deleteRoomData = (roomId) => {
        delete this.roomId_players_map[roomId];
        delete this.roomId_players_balance_map[roomId];
        delete this.roomId_count_map[roomId];
        delete this.roomId_roomAdmin_map[roomId];
        this.printAllData();
    };

    saveAdmin = ({ roomId, playerId }) => {
        this.roomId_roomAdmin_map[roomId] = playerId;
    };

    getRoomAdmin = (roomId) => {
        return this.roomId_roomAdmin_map[roomId] || null;
    };

    saveRoomCount = ({ roomId, numberOfPlayers }) => {
        return (this.roomId_count_map[roomId] = parseInt(numberOfPlayers));
    };

    getRoomCount = (roomId) => {
        return this.roomId_count_map[roomId];
    };

    getPlayerName = (roomId, playerId) => {
        if (this.roomId_players_map[roomId]) {
            return this.roomId_players_map[roomId][playerId];
        }
    };

    getJoinedPlayers = (roomId) => {
        if (!this.roomId_players_map[roomId]) return null;
        return Object.entries(this.roomId_players_map[roomId]).map(
            ([key, value]) => {
                return { playerId: key, playerName: value };
            }
        );
    };

    getJoinedPlayersCount = (roomId) => {
        console.log("getting joined players count");
        const arr = this.getJoinedPlayers(roomId);
        if (!lodash.isEmpty(arr)) {
            return arr.length;
        }
        return 0;
    };

    savePlayers = ({ roomId, playerName, playerId }) => {
        this.roomId_players_map[roomId] = this.roomId_players_map[roomId]
            ? { ...this.roomId_players_map[roomId], [playerId]: playerName }
            : { [playerId]: playerName };

        console.log("player data saved : ", this.roomId_players_map[roomId]);
    };

    isCountReachedMax = (roomId) => {
        const currentCount = this.getJoinedPlayersCount(roomId);
        const maxCount = this.getRoomCount(roomId);
        if (currentCount === maxCount) {
            return true;
        } else {
            return false;
        }
    };

    initializeBalanceForPlayer = ({ roomId, playerId }) => {
        const balanceObj = { [playerId]: BALANCE };
        this.roomId_players_balance_map[roomId] = this
            .roomId_players_balance_map[roomId]
            ? { ...this.roomId_players_balance_map[roomId], ...balanceObj }
            : { ...balanceObj };
        console.log(
            "initialized balance : ",
            this.roomId_players_balance_map[roomId]
        );
    };

    getBalanceOfPlayer = ({ roomId, playerId }) => {
        if (this.roomId_players_balance_map[roomId]) {
            return this.roomId_players_balance_map[roomId][playerId];
        } else {
            return "not found";
        }
    };

    getNextPlayer = (roomId) => {
        while (true) {
            let pIndex = this.getRandomInt(this.cricketersDataLength);
            console.log("random number is ", pIndex);
            let nextPlayer = this.cricketersData[pIndex];
            if (
                this.roomId_auctioned_cricketer_map[roomId] &&
                this.roomId_auctioned_cricketer_map[roomId][nextPlayer.player]
            ) {
                continue;
            } else {
                return nextPlayer;
            }
        }
    };

    saveAuctionedPlayer = (roomId, data) => {
        this.roomId_auctioned_cricketer_map[roomId] = this
            .roomId_auctioned_cricketer_map[roomId]
            ? {
                  ...this.roomId_auctioned_cricketer_map[roomId],
                  [data.name]: data,
              }
            : { [data.name]: data };
    };

    saveCurrentPlayer = (roomId, data) => {
        this.roomId_current_cricketer_map[roomId] = data;
    };

    getCurrentPlayer = (roomId) => {
        return this.roomId_current_cricketer_map[roomId];
    };

    addAdditionalDetails = (data) => {
        const newData = lodash.cloneDeep(data);

        newData["currentBid"] = Math.floor(newData["base"]);
        newData["highestBidderId"] = "";

        return newData;
    };

    updateCurrentPlayerStatus = ({ roomId, amount, playerId }) => {
        let curr = this.getCurrentPlayer(roomId);
        curr["currentBid"] += amount;
        curr["highestBidderId"] = playerId;
        console.log(playerId, "has updated", curr);
        this.saveCurrentPlayer(roomId, curr);
    };

    refreshNewPlayer = ({ roomId, playerId, forceRefresh = false }) => {
        let nPlayer;
        const currentPlayer = this.getCurrentPlayer(roomId);
        if (currentPlayer && !forceRefresh) {
            nPlayer = currentPlayer;
        } else {
            nPlayer = this.getNextPlayer(roomId);
            nPlayer = this.addAdditionalDetails(nPlayer);
            this.saveCurrentPlayer(roomId, nPlayer);
            this.saveAuctionedPlayer(roomId, nPlayer);
        }
    };
}
