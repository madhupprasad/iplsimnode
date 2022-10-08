import express from "express";
import { room } from "../index.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        res.send("poda /");
    } catch (error) {
        res.send(error);
    }
});

router.post("/get_info", async (req, res) => {
    try {
        let roomId = req.body.roomId;
        let res_data = room.getInfo(roomId);
        console.log(res_data);
        let res_str = "";
        if (res_data) {
            Object.entries(res_data).map(([key, val]) => {
                const pName = room.getPlayerName(roomId, key);
                const cricks = val.map((item) => item.player);
                res_str += `${pName} : ${cricks.join(
                    " , "
                )}\n -------------------------------- \n`;
            });
        }
        res.send({ info: res_str || "No Data Found" });
    } catch (error) {
        res.send(error);
    }
});

export default router;
