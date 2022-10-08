import lodash from "lodash";
import { addAdditionalDetails, getRandomInt } from "./utils.js";

export class Room {
    constructor(cricketersRawData) {
        this.cricketersData = JSON.parse(cricketersRawData);
        this.cricketersDataLength = this.cricketersData.length - 1;
    }

    #wallet = 1000;

    // room ID Maps
    roomId_roomAdmin_map = {};
    roomId_players_map = {};
    roomId_count_map = {};
    roomId_players_balance_map = {};

    room_Id_request_count_map = {};

    // maps for game play
    roomId_sold_cricketers_map = {};
    roomId_current_cricketer_map = {};
    roomId_auctioned_cricketer_map = {};
    roomId_playerId_sold_map = {};

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
            this.roomId_roomAdmin_map,
            "\n",
            "roomId_sold_cricketers_map - ",
            this.roomId_sold_cricketers_map,
            "\n",
            "roomId_current_cricketer_map - ",
            this.roomId_current_cricketer_map,
            "\n",
            "roomId_auctioned_cricketer_map - ",
            this.roomId_auctioned_cricketer_map
        );
    };

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
        const balanceObj = { [playerId]: this.#wallet };
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

    updateBalanceOfPlayer = ({ roomId, playerId, amount }) => {
        if (this.roomId_players_balance_map?.[roomId]?.[playerId]) {
            this.roomId_players_balance_map[roomId][playerId] -= amount;
        }
    };

    getNextPlayer = (roomId) => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let pIndex = getRandomInt(this.cricketersDataLength);
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

    getCurrentCricketer = (roomId) => {
        return this.roomId_current_cricketer_map[roomId];
    };

    updateCurrentCricketerStatus = ({ roomId, amount, playerId }) => {
        let curr = this.getCurrentCricketer(roomId);

        // balance check
        const balance = this.getBalanceOfPlayer({ roomId, playerId });
        const amountToBeSpent = (curr["latestBid"] || curr["base"]) + amount;
        if (amountToBeSpent > balance) {
            return true;
        }

        curr["is_sold"] = true;
        curr["latestBid"] = (curr["latestBid"] || curr["base"]) + amount;
        curr["highestBidderId"] = playerId;
        curr["highestBidderName"] = this.getPlayerName(roomId, playerId);
        this.saveCurrentPlayer(roomId, curr);
    };

    updateSoldCricketerMap = (roomId, data) => {
        this.roomId_sold_cricketers_map[roomId] = this
            .roomId_sold_cricketers_map[roomId]
            ? {
                  ...this.roomId_sold_cricketers_map[roomId],
                  [data["player"]]: data,
              }
            : { [data["player"]]: data };
    };

    refreshNewPlayer = ({ roomId, forceRefresh = false }) => {
        let nPlayer;
        const currentPlayer = this.getCurrentCricketer(roomId);
        if (currentPlayer && !forceRefresh) {
            nPlayer = currentPlayer;
        } else {
            nPlayer = this.getNextPlayer(roomId);
            nPlayer = addAdditionalDetails(nPlayer);
            this.saveCurrentPlayer(roomId, nPlayer);
            this.saveAuctionedPlayer(roomId, nPlayer);
        }
    };

    restartTimer = ({ roomId, io, onZero }) => {
        // Clear previous timer
        if (this.roomId_timerId_map[roomId]) {
            clearInterval(this.roomId_timerId_map[roomId]);
        }
        //Start Timer
        let timerSeconds = 10;
        this.roomId_timerId_map[roomId] = setInterval(() => {
            if (timerSeconds <= 0) {
                onZero();
                clearInterval(this.roomId_timerId_map[roomId]);
            }
            io.to(roomId).emit("timer", timerSeconds);
            --timerSeconds;
        }, 1000);
    };

    updatePlayerCricketerMap = ({ roomId, playerId, currCricketer }) => {
        let isRoomExist = this.roomId_playerId_sold_map?.[roomId];
        let isPlayerExist = this.roomId_playerId_sold_map?.[roomId]?.[playerId];
        if (isRoomExist) {
            if (isPlayerExist) {
                this.roomId_playerId_sold_map[roomId][playerId] = [
                    ...this.roomId_playerId_sold_map[roomId][playerId],
                    currCricketer,
                ];
            } else {
                this.roomId_playerId_sold_map[roomId][playerId] = [
                    currCricketer,
                ];
            }
        } else {
            this.roomId_playerId_sold_map[roomId] = {
                [playerId]: [currCricketer],
            };
        }
    };

    getInfo = (roomId) => {
        return this.roomId_playerId_sold_map[roomId];
    };
}
