import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UsuarioService from "@services/UsuarioService.js";
import UsuarioRepository from "@repositories/UsuarioRepository.js";
import CampusService from "@services/CampusService.js";
import Usuario from "@models/Usuario.js";
import { CustomError, HttpStatusCodes, messages } from "@utils/helpers/index.js";

jest.mock("@repositories/UsuarioRepository.js");
jest.mock("@services/CampusService.js");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("@models/Usuario.js");

jest.mock("@utils/SendMail.js", () => ({
    enviaEmail: jest.fn().mockResolvedValue({ 
        messageId: 'test-message-id' 
    })
}));

const mockCustomError = jest.fn();
jest.mock("@utils/helpers/index.js", () => {
    const originalHelpers = jest.requireActual("@utils/helpers/index.js");
    return {
        ...originalHelpers,
        CustomError: jest.fn().mockImplementation(function(args) {
            const instance = new Error(args.customMessage || 'Erro Customizado');
            Object.assign(instance, args);
            instance.name = 'CustomError';
            mockCustomError(args);
            return instance;
        }),
        HttpStatusCodes: {
            BAD_REQUEST: { code: 400, reason: "Bad Request" },
            NOT_FOUND: { code: 404, reason: "Not Found" },
        },
        messages: {
            error: {
                resourceNotFound: jest.fn(resource => `${resource} não encontrado.`),
            },
        },
    };
});

describe("UsuarioService", () => {
    let usuarioService;
    let mockUsuarioRepositoryInstance;
    let mockCampusServiceInstance;

    beforeEach(() => {
        mockUsuarioRepositoryInstance = {
            listar: jest.fn(),
            criar: jest.fn(),
            atualizar: jest.fn(),
            deletar: jest.fn(),
            buscarPorEmail: jest.fn(),
            buscarPorCpf: jest.fn(),
            buscarPorId: jest.fn(),
        };
        mockCampusServiceInstance = {
            ensureCampExists: jest.fn(),
        };

        UsuarioRepository.mockImplementation(() => mockUsuarioRepositoryInstance);
        CampusService.mockImplementation(() => mockCampusServiceInstance);

        usuarioService = new UsuarioService();
        mockCustomError.mockClear();
        bcrypt.hash.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("listar", () => {
        test("deve chamar repository.listar com os parâmetros corretos e retornar os dados", async () => {
            const mockReq = { query: { status: "ativo" } };
            const mockResponseData = [{ id: "1", nome: "Usuário Teste" }];
            mockUsuarioRepositoryInstance.listar.mockResolvedValue(mockResponseData);

            const resultado = await usuarioService.listar(mockReq);

            expect(mockUsuarioRepositoryInstance.listar).toHaveBeenCalledWith(mockReq);
            expect(resultado).toEqual(mockResponseData);
        });

        test("deve propagar erros do repository.listar", async () => {
            const mockReq = {};
            const erro = new Error("Erro de banco de dados");
            mockUsuarioRepositoryInstance.listar.mockRejectedValue(erro);

            await expect(usuarioService.listar(mockReq)).rejects.toThrow(erro);
        });
    });

    describe("criar", () => {
        let mockParsedData;
        const hashedPassword = "senhaHasheadaSuperSegura";

        beforeEach(() => {
            mockParsedData = {
                nome: "Novo Usuário",
                email: "novo@exemplo.com",
                cpf: "12345678900",
                campus: "campusId123",
                senha: "senhaOriginal123",
            };
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue(null);
            mockUsuarioRepositoryInstance.buscarPorCpf.mockResolvedValue(null);
            mockCampusServiceInstance.ensureCampExists.mockResolvedValue(true);
            bcrypt.hash.mockResolvedValue(hashedPassword);
            mockUsuarioRepositoryInstance.criar.mockResolvedValue({ id: "userId1", ...mockParsedData, senha: hashedPassword });
        });

        test("deve criar um usuário sem senha, se não fornecida", async () => {
            const dataSemSenha = { ...mockParsedData, senha: undefined };
            mockUsuarioRepositoryInstance.criar.mockResolvedValue({ id: "userId1", ...dataSemSenha });

            const result = await usuarioService.criar(dataSemSenha);

            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(mockUsuarioRepositoryInstance.criar).toHaveBeenCalledWith(dataSemSenha);
            expect(result.senha).toBeUndefined();
        });

        test("deve lançar CustomError se o email já existir", async () => {
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue({ id: "outroUser", email: mockParsedData.email });

            await expect(usuarioService.criar(mockParsedData)).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                field: "email",
                customMessage: "Email já está em uso.",
            }));
        });

        test("deve lançar CustomError se o CPF já existir", async () => {
            mockUsuarioRepositoryInstance.buscarPorCpf.mockResolvedValue({ id: "outroUser", cpf: mockParsedData.cpf });

            await expect(usuarioService.criar(mockParsedData)).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                field: "cpf",
                customMessage: "CPF já está em uso.",
            }));
        });

        test("deve lançar erro se campusService.ensureCampExists falhar", async () => {
            const erroCampus = new Error("Campus não existe");
            mockCampusServiceInstance.ensureCampExists.mockRejectedValue(erroCampus);

            await expect(usuarioService.criar(mockParsedData)).rejects.toThrow(erroCampus);
        });
    });

    describe("atualizar", () => {
        let userId;
        let mockUpdateData;

        beforeEach(() => {
            userId = "userIdExistente";
            mockUpdateData = {
                nome: "Usuário Atualizado",
                email: "atualizado@exemplo.com",
                cpf: "00987654321",
                campus: "campusIdNovo",
                senha: "novaSenha123",
            };

            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue({ id: userId, nome: "Antigo" });
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue(null);
            mockUsuarioRepositoryInstance.buscarPorCpf.mockResolvedValue(null);
            mockCampusServiceInstance.ensureCampExists.mockResolvedValue(true);
            mockUsuarioRepositoryInstance.atualizar.mockResolvedValue({ id: userId, ...mockUpdateData, email: undefined, senha: undefined });
        });

        test("deve atualizar um usuário com sucesso, deletando email e senha dos dados de atualização", async () => {
            const dadosParaAtualizar = { ...mockUpdateData };
            const usuarioAtualizadoEsperado = { ...dadosParaAtualizar };
            delete usuarioAtualizadoEsperado.email;
            delete usuarioAtualizadoEsperado.senha;

            const resultado = await usuarioService.atualizar(userId, dadosParaAtualizar);

            expect(mockUsuarioRepositoryInstance.buscarPorId).toHaveBeenCalledWith(userId);
            expect(mockUsuarioRepositoryInstance.buscarPorEmail).toHaveBeenCalledWith(mockUpdateData.email, userId);
            expect(mockUsuarioRepositoryInstance.buscarPorCpf).toHaveBeenCalledWith(mockUpdateData.cpf, userId);
            expect(mockCampusServiceInstance.ensureCampExists).toHaveBeenCalledWith(mockUpdateData.campus);
            expect(mockUsuarioRepositoryInstance.atualizar).toHaveBeenCalledWith(userId, usuarioAtualizadoEsperado);
            expect(resultado).toEqual(expect.objectContaining({ nome: "Usuário Atualizado" }));
        });

        test("deve lançar CustomError se usuário não existir", async () => {
            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue(null);

            await expect(usuarioService.atualizar(userId, mockUpdateData)).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                customMessage: messages.error.resourceNotFound("Usuário"),
            }));
        });

        test("deve lançar CustomError se email já existir para outro usuário", async () => {
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue({ id: "outroUserId", email: mockUpdateData.email });

            await expect(usuarioService.atualizar(userId, mockUpdateData)).rejects.toThrow(Error);
             expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                field: "email"
            }));
        });
    });

    describe("deletar", () => {
        const userIdValido = "idParaDeletar";

        beforeEach(()=> {
            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue({ id: userIdValido });
            mockUsuarioRepositoryInstance.deletar.mockResolvedValue({ "message": "Usuário deletado" });
        })

        test("deve deletar um usuário com sucesso", async () => {
            const result = await usuarioService.deletar(userIdValido);

            expect(mockUsuarioRepositoryInstance.buscarPorId).toHaveBeenCalledWith(userIdValido);
            expect(mockUsuarioRepositoryInstance.deletar).toHaveBeenCalledWith(userIdValido);
            expect(result).toEqual({ "message": "Usuário deletado" });
        });

        test("deve lançar CustomError se o usuário a ser deletado não for encontrado", async () => {
            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue(null);

            await expect(usuarioService.deletar("idInexistente")).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                customMessage: messages.error.resourceNotFound("Usuário"),
            }));
            expect(mockUsuarioRepositoryInstance.deletar).not.toHaveBeenCalled();
        });
    });

    describe("validateEmail", () => {
        test("não deve lançar erro se o email não estiver em uso", async () => {
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue(null);
            await expect(usuarioService.validateEmail("email.novo@teste.com")).resolves.not.toThrow();
            expect(mockUsuarioRepositoryInstance.buscarPorEmail).toHaveBeenCalledWith("email.novo@teste.com", null);
        });

        test("deve lançar CustomError se o email já estiver em uso por outro usuário", async () => {
            mockUsuarioRepositoryInstance.buscarPorEmail.mockResolvedValue({ id: "outroId" });
            await expect(usuarioService.validateEmail("email.existente@teste.com", "idAtual")).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                 statusCode: HttpStatusCodes.BAD_REQUEST.code,
                 field: "email",
            }));
        });
    });

    describe("validateCpf", () => {
        test("não deve lançar erro se CPF não estiver em uso", async () => {
            mockUsuarioRepositoryInstance.buscarPorCpf.mockResolvedValue(null);
            await expect(usuarioService.validateCpf("12345678900")).resolves.not.toThrow();
            expect(mockUsuarioRepositoryInstance.buscarPorCpf).toHaveBeenCalledWith("12345678900", null);
        });

        test("deve lançar CustomError se CPF estiver em uso", async () => {
            mockUsuarioRepositoryInstance.buscarPorCpf.mockResolvedValue({ id: "idExistente" });
            await expect(usuarioService.validateCpf("00987654321", "idAtual")).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({ field: "cpf" }));
        });
    });

    describe("ensureUserExists", () => {
        test("deve retornar o usuário se ele existir", async () => {
            const mockUser = { id: "idExistente", nome: "Usuário" };
            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue(mockUser);
            const resultado = await usuarioService.ensureUserExists("idExistente");
            expect(resultado).toEqual(mockUser);
        });

        test("deve lançar CustomError se usuário não existir", async () => {
            mockUsuarioRepositoryInstance.buscarPorId.mockResolvedValue(null);
            await expect(usuarioService.ensureUserExists("idInexistente")).rejects.toThrow(Error);
            expect(mockCustomError).toHaveBeenCalledWith(expect.objectContaining({
                 customMessage: messages.error.resourceNotFound("Usuário")
            }));
        });
    });

    describe("cadastrarSenha", () => {
        const validToken = "validToken123";
        const validSenha = "novaSenha123";
        const mockDecodedToken = { email: "test@email.com" };
        const mockUsuario = {
            email: "test@email.com",
            senhaToken: validToken,
            senhaTokenExpira: new Date(Date.now() + 3600000),
            save: jest.fn().mockResolvedValue()
        };

        beforeEach(() => {
            process.env.JWT_SECRET = "testSecret";
            jwt.verify.mockReturnValue(mockDecodedToken);
            Usuario.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUsuario)
            });
            bcrypt.hash.mockResolvedValue("hashedPassword");
        });

        test("deve cadastrar senha com sucesso", async () => {
            const result = await usuarioService.cadastrarSenha(validToken, validSenha);

            expect(jwt.verify).toHaveBeenCalledWith(validToken, "testSecret");
            expect(Usuario.findOne).toHaveBeenCalledWith({ email: mockDecodedToken.email });
            expect(bcrypt.hash).toHaveBeenCalledWith(validSenha, 10);
            expect(mockUsuario.save).toHaveBeenCalled();
            expect(result).toEqual({ mensagem: "Senha cadastrada com sucesso!" });
        });

        test("deve lançar erro se token for inválido", async () => {
            jwt.verify.mockImplementation(() => {
                throw new Error("Token inválido");
            });

            await expect(usuarioService.cadastrarSenha("invalidToken", validSenha))
                .rejects.toThrow("Erro ao cadastrar senha.");
        });

        test("deve lançar erro se usuário não for encontrado", async () => {
            Usuario.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            await expect(usuarioService.cadastrarSenha(validToken, validSenha))
                .rejects.toThrow("Erro ao cadastrar senha.");
        });

        test("deve lançar erro se token estiver expirado", async () => {
            const mockUsuarioTokenExpirado = {
                ...mockUsuario,
                senhaTokenExpira: new Date(Date.now() - 3600000)
            };

            Usuario.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUsuarioTokenExpirado)
            });

            await expect(usuarioService.cadastrarSenha(validToken, validSenha))
                .rejects.toThrow("Erro ao cadastrar senha.");
        });
    });
});