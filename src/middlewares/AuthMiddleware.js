// src/middlewares/AuthMiddleware.js
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import AuthenticationError from '../utils/errors/AuthenticationError.js';
import TokenExpiredError from '../utils/errors/TokenExpiredError.js';
import Usuario from '../models/Usuario.js';

class AuthMiddleware {
  constructor() {
    /**
     * Vinculação para grantir ao método handle o contexto 'this' correto
     * Ao usar bind(this) no método handle garantimos independentemente de como ou onde o método é chamado, 
     * this sempre se referirá à instância atual de AuthMiddleware.
     */
    this.handle = this.handle.bind(this);
  }

  async handle(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new AuthenticationError("Acesso negado, o token de autenticação não existe!");
      }

      // Separa o tipo do token ("Bearer") do valor real do token
      const [scheme, token] = authHeader.split(' ');

      // Garante que o esquema seja 'Bearer' e que o token exista
      if (scheme !== 'Bearer' || !token) {
        throw new AuthenticationError("Formato do token de autenticação inválido!");
      }

      /**
       * Verifica e decodifica o token usando a chave secreta.
       * - A função 'jwt.verify' é transformada em 'promise' para usar com 'await'.
       * - Se o token for válido, ele retorna os dados codificados no token (payload).
       */
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

      if (!decoded) { // Se não ocorrer a decodificação do token
        throw new TokenExpiredError("O token JWT está expirado!");
      }

      // Buscando o usuário no bd e injeta o cargo
      const usuario = await Usuario.findById(decoded.id).select("cargo nome email");

      if (!usuario) {
        throw new AuthenticationError("Usuário não encontrado.")
      }

      // Se o token for válido, anexa o user_id à requisição
      req.user = {
        _id: usuario._id,
        cargo: usuario.cargo,
        nome: usuario.nome,
        email: usuario.email
      };

      next();

    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        next(new AuthenticationError("Token JWT inválido!"));
      } else if (err.name === 'TokenExpiredError') {
        next(new TokenExpiredError("O token JWT está expirado!"));
      } else {
        next(err);
      }
    }
  }
}

export default new AuthMiddleware().handle;
