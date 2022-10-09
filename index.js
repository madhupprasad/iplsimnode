import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import apiRouter from "./controllers/api.js";
import fs from "fs";
import { clearInterval } from "timers";
import { Room } from "./room_class.js";
import * as dotenv from "dotenv";
import { env } from "process";
import path from "path";
dotenv.config();
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
var PORT = env.PORT || 3000;

const app = express();
const server = http.createServer(app, {
    origin: true,
});
const io = new Server(server);

var dir = path.join(__dirname, "images");
app.use(express.static(dir));

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

            room.active_roomIds[roomId] = true;
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

        if (!room.active_roomIds[roomId]) {
            io.to(playerId).emit("no_room");
            console.log("No Room as ", roomId);
            return;
        }

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

        room.restartTimer({
            roomId,
            io,
            onZero: () => {
                io.to(roomId).emit("timeout");
            },
        });

        function foo() {
            const { roomId, playerId } = JSON.parse(data);
            console.log("Game started", data);

            room.refreshNewPlayer({ roomId, playerId });
            io.to(roomId).emit(
                "cricketer_data",
                room.getCurrentCricketer(roomId)
            ); // access from current player map

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
    socket.on("on_bid", (data) => {
        const { amount, playerId, roomId } = JSON.parse(data);

        // ATOMIC ----
        const error = room.updateCurrentCricketerStatus({
            roomId,
            playerId,
            amount,
        });
        // ATOMIC ----

        if (error) {
            io.to(playerId).emit("out_of_balance");
            return;
        }

        const playerName = room.getPlayerName(roomId, playerId);
        const currCricketer = room.getCurrentCricketer(roomId);

        console.log(playerName, "-", currCricketer);

        room.restartTimer({
            roomId,
            io,
            onZero: () => {
                io.to(roomId).emit("timeout");
            },
        });

        io.to(roomId).emit("on_bid", {
            playerName: playerName,
            highestBid: currCricketer["latestBid"],
        });

        io.to(playerId).emit(
            "crystal",
            room.getBalanceOfPlayer({ roomId, playerId }) -
                currCricketer["latestBid"]
        );
    });

    socket.on("transaction_end", (data) => {
        const { roomId, playerId } = JSON.parse(data);

        // make sure all players sent request
        const count = room.getRoomCount(roomId);
        room.room_Id_request_count_map[roomId] =
            (room.room_Id_request_count_map[roomId] || 0) + 1;
        const allIn = room.room_Id_request_count_map[roomId] === count;

        if (allIn) {
            room.room_Id_request_count_map[roomId] = 0;

            console.log(playerId);
            const currCricketer = room.getCurrentCricketer(roomId);
            // if sold
            if (currCricketer["is_sold"]) {
                const amount = currCricketer["latestBid"];
                const playerId = currCricketer["highestBidderId"];
                room.updateBalanceOfPlayer({ roomId, playerId, amount });
                room.updateSoldCricketerMap(roomId, currCricketer);
                room.updatePlayerCricketerMap({
                    roomId,
                    playerId,
                    currCricketer,
                });
                console.log("sold to : ", room.getPlayerName(roomId, playerId));
                io.to(roomId).emit(
                    "sold",
                    room.getPlayerName(roomId, playerId)
                );
            } else {
                //if not sold
                console.log("UnSold : ", currCricketer["player"]);
                io.to(roomId).emit("unsold");
            }
            // ----------- Thank you, Next ------------ //
            room.restartTimer({
                roomId,
                io,
                onZero: () => {
                    io.to(roomId).emit("timeout");
                },
            });
            room.refreshNewPlayer({ roomId, forceRefresh: true });
            io.to(roomId).emit(
                "cricketer_data",
                room.getCurrentCricketer(roomId)
            ); // access from current player map

            io.to(roomId).emit("crystal", "0");
        }
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

export { io, room };

// ------ REST API ---------

app.use(express.json());
app.use(cors());
app.use("/api", apiRouter);

server.listen(PORT, () => {
    console.log(`Server up and running on port ${PORT}`);
}); //tells to host server on localhost:3000
