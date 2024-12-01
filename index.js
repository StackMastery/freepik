import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/db.js";
import cors from 'cors';
import { apiRouter } from "./routes/routes.js";

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('dist'))

// Router Use
app.use('/api', apiRouter)


connectDB()

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`)
})