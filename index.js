import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import testRouter from "./controllers/test.js";
import fs from "fs";
import { clearInterval } from "timers";
import { Room } from "./room_class.js";
import * as dotenv from "dotenv";
import { env } from "process";
dotenv.config();

var PORT = env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// init room class
let cricketersRawData = fs.readFileSync("cricketers.json");
const room = new Room(cricketersRawData);

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

            room.saveAdmin({ roomId, playerId });
            room.savePlayers({ roomId, playerName, playerId });
            room.saveRoomCount({ roomId, numberOfPlayers });
            room.initializeBalanceForPlayer({ roomId, playerId });
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
            room.savePlayers({ roomId, playerName, playerId });
            room.initializeBalanceForPlayer({ roomId, playerId });
        } catch (e) {
            console.log(e);
        }
    });

    //get all connected players
    socket.on("get_joined_players", (roomId, pid) => {
        console.log("get_joined_players", room.getJoinedPlayers(roomId), pid);
        get_joined_players_intervalId = setInterval(() => {
            let playersList = room.getJoinedPlayers(roomId);
            if (playersList) {
                io.to(roomId).emit("get_joined_players", playersList);
            }
        }, 2000);
    });

    //check if all joined
    socket.on("all_joined", (roomId) => {
        function foo() {
            console.log("Checking players joined ...");
            if (room.isCountReachedMax(roomId)) {
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
        if (room.roomId_timerId_map[roomId]) {
            clearInterval(room.roomId_timerId_map[roomId]);
        }
        //Start Timer
        let timerSeconds = 10;
        room.roomId_timerId_map[roomId] = setInterval(function () {
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

            room.refreshNewPlayer({ roomId, playerId });
            io.to(roomId).emit("cricketer_data", room.getCurrentPlayer(roomId)); // access from current player map

            balance_timer_intervalId = setInterval(() => {
                io.to(playerId).emit(
                    "balance_update",
                    room.getBalanceOfPlayer({ roomId, playerId })
                );
            }, 2000);
        }
        setTimeout(foo, 1000);
    });

    // bid action
    socket.on("after_bid", (data) => {
        const { amount, playerId, roomId } = JSON.parse(data);

        // Clear previous timer
        if (room.roomId_timerId_map[roomId]) {
            console.log("Clear ????");
            clearInterval(room.roomId_timerId_map[roomId]);
        }

        // ATOMIC
        room.updateCurrentPlayerStatus({ roomId, playerId, amount });

        const playerName = room.getPlayerName(roomId, playerId);
        const currCricketerName = room.getCurrentPlayer(roomId);

        console.log("a bid by ", playerName, " for +", amount);

        const res = {
            playerName: playerName,
            highestBid: currCricketerName["currentBid"],
        };

        //Start Timer
        let timerSeconds = 10;
        room.roomId_timerId_map[roomId] = setInterval(function () {
            if (timerSeconds <= 0) {
                io.to(roomId).emit("timeout");
                clearInterval(room.roomId_timerId_map[roomId]);
            }
            io.to(roomId).emit("timer", timerSeconds);
            --timerSeconds;
        }, 1000);

        io.to(roomId).emit("after_bid", res);
    });

    //Next player
    socket.on("next_player", (data) => {
        console.log("next player called ... ");
        // eslint-disable-next-line no-unused-vars
        const { roomId, playerId } = JSON.parse(data);

        // Clear previous timer
        if (room.roomId_timerId_map[roomId]) {
            clearInterval(room.roomId_timerId_map[roomId]);
        } //Start Timer
        let timerSeconds = 10;
        room.roomId_timerId_map[roomId] = setInterval(function () {
            if (timerSeconds <= 0) {
                io.to(roomId).emit("timeout");
                clearInterval(room.roomId_timerId_map[roomId]);
            }
            io.to(roomId).emit("timer", timerSeconds);
            --timerSeconds;
        }, 1000);

        //
        room.refreshNewPlayer({ roomId, forceRefresh: true });
        io.to(roomId).emit("cricketer_data", room.getCurrentPlayer(roomId)); // access from current player map
    });

    // disconnect player
    socket.on("end", (data) => {
        const { roomId, playerId } = JSON.parse(data);
        console.log(
            "Player getting disconnected ... ",
            roomId,
            " - ",
            playerId
        );
        if (playerId === room.getRoomAdmin(roomId)) {
            room.deleteRoomData(roomId);
        } else {
            room.deletePlayerData({ roomId, playerId });
        }
        socket.disconnect();
    });

    // on disconnect
    socket.on("disconnect", () => {
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
