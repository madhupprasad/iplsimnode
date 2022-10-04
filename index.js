import express from "express"; //requires express module
import lodash from "lodash";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import testRouter from "./controllers/test.js";
import fs from "fs";
import { clearInterval } from "timers";

var PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let roomId_roomAdmin_map = {};
let roomId_players_map = {};
let roomId_count_map = {};
let roomId_players_balance_map = {};

// maps for game
let roomId_sold_cricketers_map = {};
let roomId_current_cricketer_map = {};
let roomId_auctioned_cricketer_map = {};

let roomId_timerId_map = {};

let BALANCE = 1000;

// read JSON data
let cricketersRawData = fs.readFileSync("cricketers.json");
let cricketersData = JSON.parse(cricketersRawData);
let cricketersDataLength = cricketersData.length - 1;

const printAllData = () => {
  console.log(
    "\n",
    "roomId_players_map - ",
    roomId_players_map,
    "\n",
    "roomId_players_balance_map - ",
    roomId_players_balance_map,
    "\n",
    "roomId_count_map - ",
    roomId_count_map,
    "\n",
    "roomId_roomAdmin_map - ",
    roomId_roomAdmin_map
  );
};

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const deletePlayerData = ({ roomId, playerId }) => {
  delete roomId_players_map[roomId]?.[playerId];
  delete roomId_players_balance_map[roomId]?.[playerId];
  printAllData();
};

const deleteRoomData = (roomId) => {
  delete roomId_players_map[roomId];
  delete roomId_players_balance_map[roomId];
  delete roomId_count_map[roomId];
  delete roomId_roomAdmin_map[roomId];
  printAllData();
};

const saveAdmin = ({ roomId, playerId }) => {
  roomId_roomAdmin_map[roomId] = playerId;
};

const getRoomAdmin = (roomId) => {
  return roomId_roomAdmin_map[roomId] || null;
};

const saveRoomCount = ({ roomId, numberOfPlayers }) => {
  return (roomId_count_map[roomId] = parseInt(numberOfPlayers));
};

const getRoomCount = (roomId) => {
  return roomId_count_map[roomId];
};

const getPlayerName = (roomId, playerId) => {
  if (roomId_players_map[roomId]) {
    return roomId_players_map[roomId][playerId];
  }
};

const getJoinedPlayers = (roomId) => {
  if (!roomId_players_map[roomId]) return null;
  return Object.entries(roomId_players_map[roomId]).map(([key, value]) => {
    return { playerId: key, playerName: value };
  });
};

const getJoinedPlayersCount = (roomId) => {
  console.log("getting joined players count");
  const arr = getJoinedPlayers(roomId);
  if (!lodash.isEmpty(arr)) {
    return arr.length;
  }
  return 0;
};

const savePlayers = ({ roomId, playerName, playerId }) => {
  roomId_players_map[roomId] = roomId_players_map[roomId]
    ? { ...roomId_players_map[roomId], [playerId]: playerName }
    : { [playerId]: playerName };

  console.log("player data saved : ", roomId_players_map[roomId]);
};

const isCountReachedMax = (roomId) => {
  const currentCount = getJoinedPlayersCount(roomId);
  const maxCount = getRoomCount(roomId);
  if (currentCount === maxCount) {
    return true;
  } else {
    return false;
  }
};

const initializeBalanceForPlayer = ({ roomId, playerId }) => {
  const balanceObj = { [playerId]: BALANCE };
  roomId_players_balance_map[roomId] = roomId_players_balance_map[roomId]
    ? { ...roomId_players_balance_map[roomId], ...balanceObj }
    : { ...balanceObj };
  console.log("initialized balance : ", roomId_players_balance_map[roomId]);
};

const getBalanceOfPlayer = ({ roomId, playerId }) => {
  if (roomId_players_balance_map[roomId]) {
    return roomId_players_balance_map[roomId][playerId];
  } else {
    return "not found";
  }
};

const getNextPlayer = (roomId) => {
  while (true) {
    let pIndex = getRandomInt(cricketersDataLength);
    console.log("random number is ", pIndex);
    let nextPlayer = cricketersData[pIndex];
    if (
      roomId_auctioned_cricketer_map[roomId] &&
      roomId_auctioned_cricketer_map[roomId][nextPlayer.player]
    ) {
      continue;
    } else {
      return nextPlayer;
    }
  }
};

const saveAuctionedPlayer = (roomId, data) => {
  roomId_auctioned_cricketer_map[roomId] = roomId_auctioned_cricketer_map[
    roomId
  ]
    ? { ...roomId_auctioned_cricketer_map[roomId], [data.name]: data }
    : { [data.name]: data };
};

const saveCurrentPlayer = (roomId, data) => {
  roomId_current_cricketer_map[roomId] = data;
};

const getCurrentPlayer = (roomId) => {
  return roomId_current_cricketer_map[roomId];
};

const addAdditionalDetails = (data) => {
  const newData = lodash.cloneDeep(data);

  newData["currentBid"] = Math.floor(newData["base"]);
  newData["highestBidderId"] = "";

  return newData;
};

const updateCurrentPlayerStatus = ({ roomId, amount, playerId }) => {
  let curr = getCurrentPlayer(roomId);
  curr["currentBid"] += amount;
  curr["highestBidderId"] = playerId;
  console.log(playerId, "has updated", curr);
  saveCurrentPlayer(roomId, curr);
};

const refreshNewPlayer = ({ roomId, playerId, forceRefresh = false }) => {
  let nPlayer;
  const currentPlayer = getCurrentPlayer(roomId);
  if (currentPlayer && !forceRefresh) {
    nPlayer = currentPlayer;
  } else {
    nPlayer = getNextPlayer(roomId);
    nPlayer = addAdditionalDetails(nPlayer);
    saveCurrentPlayer(roomId, nPlayer);
    saveAuctionedPlayer(roomId, nPlayer);
  }
};

//Socket.io Connection--------------------------------------------------------------------------------------------------------------
io.on("connection", (socket) => {
  let get_joined_players_intervalId = null;
  let balance_timer_intervalId = null;

  // connected once create / join.
  console.log("Connected to server", socket.id);
  let playerId = socket.id;
  // create room event
  socket.on("create", (stringData) => {
    let data = JSON.parse(stringData);
    console.log("Room Created : ", stringData);
    let playerName = data.playerName;
    let roomId = socket.id.toString().slice(0, 5);
    let numberOfPlayers = data.numberOfPlayers;
    try {
      socket.join(roomId);
      io.to(roomId).emit("user_joined", socket.id);
      io.to(roomId).emit("room_id", roomId, playerId);
      console.log("Room Created with ID: ", roomId);

      saveAdmin({ roomId, playerId });
      savePlayers({ roomId, playerName, playerId });
      saveRoomCount({ roomId, numberOfPlayers });
      initializeBalanceForPlayer({ roomId, playerId });
    } catch (e) {
      console.log(e);
    }
  });

  // join room event
  socket.on("join", (stringData) => {
    let data = JSON.parse(stringData);
    let roomId = data.roomId;
    let playerName = data.playerName;
    console.log("Join Room", stringData);
    try {
      socket.join(roomId);
      io.to(roomId).emit("user_joined", socket.id);
      savePlayers({ roomId, playerName, playerId });
      initializeBalanceForPlayer({ roomId, playerId });
    } catch (e) {
      console.log(e);
    }
  });

  //get all connected players
  socket.on("get_joined_players", (roomId, pid) => {
    console.log("get_joined_players", getJoinedPlayers(roomId), pid);
    get_joined_players_intervalId = setInterval(() => {
      let playersList = getJoinedPlayers(roomId);
      if (playersList) {
        io.to(roomId).emit("get_joined_players", playersList);
      }
    }, 2000);
  });

  //check if all joined
  socket.on("all_joined", (roomId) => {
    function foo() {
      console.log("Checking players joined ...");
      if (isCountReachedMax(roomId)) {
        console.log("Count Reached Max");
        io.to(roomId).emit("all_joined", true);
      }
    }
    setTimeout(foo, 5000);
  });

  // stop timer which gives joined players data
  socket.on("stop_timer", () => {
    clearInterval(get_joined_players_intervalId);
  });

  // listen for start game event
  socket.on("start_game", (data) => {
    const { roomId } = JSON.parse(data);

    // Clear previous timer
    if (roomId_timerId_map[roomId]) {
      clearInterval(roomId_timerId_map[roomId]);
    }
    //Start Timer
    let timerSeconds = 10;
    roomId_timerId_map[roomId] = setInterval(function () {
      if (timerSeconds <= 0) {
        io.to(roomId).emit("timeout");
        clearInterval(this);
      }
      io.to(roomId).emit("timer", timerSeconds);
      --timerSeconds;
    }, 1000);

    function foo() {
      const { roomId, playerId } = JSON.parse(data);
      console.log("Game started", data);

      refreshNewPlayer({ roomId, playerId });
      io.to(roomId).emit("cricketer_data", getCurrentPlayer(roomId)); // access from current player map

      balance_timer_intervalId = setInterval(() => {
        io.to(playerId).emit(
          "balance_update",
          getBalanceOfPlayer({ roomId, playerId })
        );
      }, 2000);
    }
    setTimeout(foo, 1000);
  });

  // bid action
  socket.on("after_bid", (data) => {
    const { amount, playerId, roomId } = JSON.parse(data);

    // Clear previous timer
    if (roomId_timerId_map[roomId]) {
      console.log("Clear ????");
      clearInterval(roomId_timerId_map[roomId]);
    }

    // ATOMIC
    updateCurrentPlayerStatus({ roomId, playerId, amount });

    const playerName = getPlayerName(roomId, playerId);
    const currCricketerName = getCurrentPlayer(roomId);

    console.log("a bid by ", playerName, " for +", amount);

    const res = {
      playerName: playerName,
      highestBid: currCricketerName["currentBid"],
    };

    //Start Timer
    let timerSeconds = 10;
    roomId_timerId_map[roomId] = setInterval(function () {
      if (timerSeconds <= 0) {
        io.to(roomId).emit("timeout");
        clearInterval(roomId_timerId_map[roomId]);
      }
      io.to(roomId).emit("timer", timerSeconds);
      --timerSeconds;
    }, 1000);

    io.to(roomId).emit("after_bid", res);
  });

  //Next player
  socket.on("next_player", (data) => {
    console.log("next player called ... ");
    const { roomId, playerId } = JSON.parse(data);

    // Clear previous timer
    if (roomId_timerId_map[roomId]) {
      clearInterval(roomId_timerId_map[roomId]);
    } //Start Timer
    let timerSeconds = 10;
    roomId_timerId_map[roomId] = setInterval(function () {
      if (timerSeconds <= 0) {
        io.to(roomId).emit("timeout");
        clearInterval(roomId_timerId_map[roomId]);
      }
      io.to(roomId).emit("timer", timerSeconds);
      --timerSeconds;
    }, 1000);

    //
    refreshNewPlayer({ roomId, playerId, forceRefresh: true });
    io.to(roomId).emit("cricketer_data", getCurrentPlayer(roomId)); // access from current player map
  });

  // disconnect player
  socket.on("end", (data) => {
    const { roomId, playerId } = JSON.parse(data);
    console.log("Player getting disconnected ... ", roomId, " - ", playerId);
    if (playerId === getRoomAdmin(roomId)) {
      deleteRoomData(roomId);
    } else {
      deletePlayerData({ roomId, playerId });
    }
    socket.disconnect();
  });

  // on disconnect
  socket.on("disconnect", (reason) => {
    console.log(socket.id, " has left ");
    if (balance_timer_intervalId) {
      clearInterval(balance_timer_intervalId);
    }
  });
});

export { io };

// ------ REST API ---------

app.use(express.json());
app.use(cors());
app.use("/test", testRouter);

app.get("/", (req, res) => {
  res.send("Hello");
});

server.listen(PORT, () => {
  console.log(`Server up and running on port ${PORT}`);
}); //tells to host server on localhost:3000
