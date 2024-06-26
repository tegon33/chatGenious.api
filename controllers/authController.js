import userSchema from "../models/userModel.js";
import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import { signJWT, signTokens } from "../utils/index.js";
import jwt from "jsonwebtoken";

export const register = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(403).json({ message: "Riempi ogni campo" });

  if (username.length < 8 || password.length < 8)
    return res.status(403).json({
      message: "L'username e la password devono contenere almeno 8 caratteri",
    });

  const usernameExist = await userSchema.findOne({ username }).exec();

  if (usernameExist)
    return res
      .status(403)
      .json({ message: "Questo username e' gia' esistente" });

  const hashedPw = await bcrypt.hash(password, 10);

  const addedUser = new userSchema({ ...req.body, password: hashedPw });

  const newUser = await addedUser.save();

  const userInfo = {
    userId: newUser._id.toString(),
    username,
    createdAt: newUser.createdAt,
  };

  const { accessToken } = signTokens(res, userInfo);

  res.status(200).json({ message: `Benvenuto/a ${username}`, accessToken });
});

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  let success = false;

  if (!username || !password)
    return res.json({ success, message: "Riempi ogni campo" });

  const userExist = await userSchema.findOne({ username }).exec();

  if (!userExist)
    return res.json({ success, message: "Username non esistente" });

  const isPwMatch = await bcrypt.compare(password, userExist.password);

  if (!isPwMatch) return res.json({ success, message: "Password errata" });

  const userInfo = {
    userId: userExist._id.toString(),
    username,
    createdAt: userExist.createdAt,
  };

  const { accessToken } = signTokens(res, userInfo);

  success = true;

  res
    .status(201)
    .json({ success, message: `Bentornato/a ${username}`, accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const { jwt } = req?.cookies;

  if (!jwt) return res.sendStatus(204);

  res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
  res.json({ message: "Utente sloggato con successo" });
});

export const refresh = asyncHandler(async (req, res) => {
  const { jwt: refreshToken } = req?.cookies;

  if (!refreshToken) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    asyncHandler(async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" });

      const foundUser = await userSchema
        .findOne({ username: decoded.username })
        .exec();

      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      const accessToken = signJWT(
        {
          userId: foundUser._id.toString(),
          username: foundUser.username,
          createdAt: foundUser.createdAt,
        },
        "access",
        "15m"
      );

      res.status(200).json({ accessToken, message: "Token refreshed" });
    })
  );
});
