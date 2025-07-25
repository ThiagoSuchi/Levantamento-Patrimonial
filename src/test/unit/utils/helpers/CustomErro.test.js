import { CustomError } from "@utils/helpers";

describe('CustomError', () => {
  it('deve criar um erro com as propriedades padrão', () => {
    const error = new CustomError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CustomError');
    expect(error.message).toBe('An error occurred');
    expect(error.statusCode).toBeUndefined();
    expect(error.errorType).toBeUndefined();
    expect(error.field).toBeNull();
    expect(error.details).toEqual([]);
    expect(error.customMessage).toBeNull();
    expect(error.isOperational).toBe(true);
  });

  it('deve criar um erro com todos os parâmetros fornecidos', () => {
    const error = new CustomError({
      statusCode: 401,
      errorType: 'tokenExpired',
      field: 'authToken',
      details: ['Token inválido', 'Token expirado'],
      customMessage: 'Seu token expirou. Faça login novamente.'
    });

    expect(error.message).toBe('Seu token expirou. Faça login novamente.');
    expect(error.statusCode).toBe(401);
    expect(error.errorType).toBe('tokenExpired');
    expect(error.field).toBe('authToken');
    expect(error.details).toEqual(['Token inválido', 'Token expirado']);
    expect(error.customMessage).toBe('Seu token expirou. Faça login novamente.');
    expect(error.isOperational).toBe(true);
  });

  it('deve priorizar customMessage como mensagem principal', () => {
    const error = new CustomError({
      customMessage: 'Erro personalizado'
    });

    expect(error.message).toBe('Erro personalizado');
  });
});
