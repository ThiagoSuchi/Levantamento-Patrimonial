import express from "express";
import routes from "./routes/index.js";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import DbConnect from './config/dbConnect.js';
import setupMinio from './config/setupMinio.js';
import errorHandler from './utils/helpers/errorHandler.js';
import logger from './utils/logger.js';
import CommonResponse from './utils/helpers/CommonResponse.js';
import rotaSeed from "./seeds/rotaSeed.js";

const app = express();

async function initializeApp() {
    await setupMinio();
    await DbConnect.conectar();
    await rotaSeed();
}

if (process.env.NODE_ENV !== 'test') {
    initializeApp().catch(error => {
        logger.error('Erro na inicialização da aplicação:', error);
        process.exit(1);
    });
}


// Middlewares de segurança
app.use(helmet());

// Habilitando CORS
app.use(cors());

// Habilitando a compressão de respostas
app.use(compression());

// Habilitando o uso de json pelo express
app.use(express.json());

// Habilitando o uso de urlencoded pelo express
app.use(express.urlencoded({ extended: true }));

// Passando para o arquivo de rotas o app
routes(app);

// Middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    return CommonResponse.error(
        res,
        404,
        'resourceNotFound',
        null,
        [{ message: 'Rota não encontrada.' }]
    );
});


// Listener para erros não tratados (opcional, mas recomendado)
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Não finalizar o processo para evitar interrupção da API
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown:', error);
    // Não finalizar o processo para evitar interrupção da API
    // Considerar reiniciar a aplicação em caso de exceções críticas
});

// Middleware de Tratamento de Erros (deve ser adicionado após as rotas)
app.use(errorHandler);

// exportando para o server.js fazer uso
export default app;

