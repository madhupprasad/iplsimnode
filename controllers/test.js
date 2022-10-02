import express from "express";
import { io } from "../index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    res.send("poda /");
  } catch (error) {
    res.send(error);
  }
});

router.post("/createroom", async (req, res) => {
  try {
    let name = req.body.name;
    let maxPlayerCount = req.body.maxPlayerCount;
    res.send({ roomid: "123" });
  } catch (error) {
    res.send(error);
  }
});

export default router;
