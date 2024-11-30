import express  from 'express';
import { createApi, deletApikey, getApiKeys } from '../controllers/apiControllers.js';

const apiRouter = express.Router();

apiRouter.get('/keys', getApiKeys) // get Api keys
apiRouter.post('/create', createApi) // Create Api Keys
apiRouter.delete('/delete', deletApikey)

export { apiRouter }
