import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema({
    apiName:{
        type: String,
        required: true
    },
    apiKey: {
        type: String,
        required: true,
        unique: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
})

const ApiKey = mongoose.model('apiKeys', apiKeySchema)

export default ApiKey