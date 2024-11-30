import mongoose from "mongoose";

const connectDB = async () => {
    try{
        const connectionStatus = await mongoose.connect(`${process.env.MONGO_DB_URI}/freepik`)
        console.warn(`Succesfully Connected To Database ${connectionStatus.connection.db.databaseName}`)    
    }
    catch(err){
        throw err
        console.error(err)
    }
}

export default connectDB