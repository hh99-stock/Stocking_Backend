import { createServer } from 'http';
import express from 'express';
import dotenv from 'dotenv';
import generalErrorHandler from './middlewares/generalError.middleware.js';
import { initKafka } from './utils/receiveFromMainServer/index.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT;

initKafka();

app.use(generalErrorHandler);
server.listen(PORT, () => {
  console.log(PORT, '포트로 매칭 서버가 열렸어요!');
});
