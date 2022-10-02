import express from "express"; //requires express module
import lodash from "lodash";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import testRouter from "./controllers/test.js";

var PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

const getJoinedPlayers = (roomId) => {
  console.log("lol");
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
    return null;
  }
};

//Socket.io Connection------------------
io.on("connection", (socket) => {
  let get_joined_players_intervalId;
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
      if (isCountReachedMax(roomId)) {
        console.log("Count Reached Max");
        io.to(roomId).emit("all_joined", true);
      }
    }
    setTimeout(foo, 5000);
  });

  socket.on("stop_timer", () => {
    clearInterval(get_joined_players_intervalId);
  });

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
  console.log("Server up and running on port ${PORT}");
}); //tells to host server on localhost:3000
