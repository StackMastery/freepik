import ApiKey from "../models/apikey.model.js"

// Creating New Api Keys
const createApi = async (req, res) => {
    try {
        const newApi = new ApiKey({
            apiName: req.body.apiName,
            apiKey: req.body.apiKey
        })

        const saveApi = await newApi.save()
        
        res.send(saveApi)

    }
    catch (err) {
        console.error(err)
        if(err.code === 11000){
            res.status(400).send('Api already exists')
        }
    }
}

// Get All Api Keys
const getApiKeys = async (req, res) => {
    try {
        const apiKeys = await ApiKey.find()
        res.send(apiKeys)
    }
    catch (err) {
        console.error(err)
    }
}

//  Delet Api Keys
const deletApikey = async (req, res) => {
    const { apiId } = req.body; 
    try {
        const status = await ApiKey.findOneAndDelete({ _id: apiId });
        if (!status) {
            return res.status(404).send("API Key not found");
        }
        res.send(status);  // Send the deleted API key or a success message
    } catch (err) {
        res.status(500).send(err);
    }
};

export { createApi, getApiKeys , deletApikey}
