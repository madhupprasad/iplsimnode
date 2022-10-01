const express = require("express"); //requires express module
const socket = require("socket.io"); //requires socket.io module
const fs = require("fs");
const app = express();
const lodash = require("lodash");
const { values } = require("lodash");
var PORT = process.env.PORT || 3000;
const server = app.listen(PORT); //tells to host server on localhost:3000

//Playing variables:
app.use(express.static("public")); //show static files in 'public' directory
console.log("Server is running");
const io = socket(server);

let roomId_roomAdmin_map = {};
let roomId_players_map = {};
let roomId_count_map = {};
let roomId_players_balance_map = {};
let BALANCE = 1000;

const printAllData = () => {
  console.log(
    "roomId_players_map",
    roomId_players_map,
    "roomId_players_balance_map",
    roomId_players_balance_map,
    "roomId_count_map",
    roomId_count_map,
    "roomId_roomAdmin_map",
    roomId_roomAdmin_map
  );
};

const deletePlayerData = ({ roomId, playerId }) => {
  delete roomId_players_map[roomId][playerId];
  delete roomId_players_balance_map[roomId][playerId];
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

const getJoinedPlayers = (roomId) => {
  return Object.entries(roomId_players_map[roomId]).map(([key, value]) => {
    return { playerId: key, playerName: value };
  });
};

const getJoinedPlayersCount = (roomId) => {
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

  console.log("player data saved", roomId_players_map[roomId]);
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

const getBalanceOfPlayer = (roomId, playerId) => {
  if (roomId_players_balance_map[roomId]) {
    return roomId_players_balance_map[roomId][playerId];
  } else {
    return null;
  }
};

//Socket.io Connection------------------
io.on("connection", (socket) => {
  // connected once create / join.
  console.log("Connected", socket.id);
  let playerId = socket.id;
  // create room event
  socket.on("create", (stringData) => {
    data = JSON.parse(stringData);
    console.log("Create Room", stringData);
    let playerName = data.playerName;
    let roomId = socket.id.toString().slice(0, 5);
    let numberOfPlayers = data.numberOfPlayers;
    try {
      socket.join(roomId);

      console.log("Room Created : ", roomId);

      saveAdmin({ roomId, playerId });

      io.to(roomId).emit("user_joined", socket.id);

      io.emit("room_id", roomId, playerId);
    } catch (e) {
      console.log(e);
    } finally {
      savePlayers({ roomId, playerName, playerId });
      saveRoomCount({ roomId, numberOfPlayers });
      initializeBalanceForPlayer({ roomId, playerId });
    }
  });

  // join room event
  socket.on("join", (stringData) => {
    data = JSON.parse(stringData);
    let roomId = data.roomId;
    let playerName = data.playerName;
    console.log("Join Room", stringData);
    try {
      socket.join(roomId);
      console.log(socket.rooms);
      io.to(roomId).emit("user_joined", socket.id);
    } catch (e) {
      console.log(e);
    } finally {
      savePlayers({ roomId, playerName, playerId });
      initializeBalanceForPlayer({ roomId, playerId });
      if (isCountReachedMax(roomId)) {
        console.log("Count Reached");
        io.timeout(5000).emit("all_joined", true);
      }
    }
  });

  //get admin name event
  socket.on("get_admin", (roomId) => {
    io.emit("get_admin", getRoomAdmin(roomId));
  });

  //get all connected players
  socket.on("get_joined_players", (roomId) => {
    console.log("get_joined_players", getJoinedPlayers(roomId));
    io.emit("get_joined_players", getJoinedPlayers(roomId));
  });

  socket.on("end", (data) => {
    const { roomId, playerId } = JSON.parse(data);

    if (playerId === getRoomAdmin(roomId)) {
      deleteRoomData(roomId);
      io.to(roomId).emit("exit", null);
    } else {
      deletePlayerData({ roomId, playerId });
      io.emit("refresh_players", true);
      io.to(roomId).emit("exit", playerId);
    }

    socket.disconnect();
  });
});
