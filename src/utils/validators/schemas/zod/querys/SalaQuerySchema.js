import { z } from "zod";
import mongoose from 'mongoose';

export const SalaIdSchema = z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "ID inválido",
});

export const SalaQuerySchema = z.object({
    nome: z
        .string()
        .optional()
        .refine((val) => !val || val.trim().length > 0, {
            message: "Nome não pode ser vazio",
        })
        .transform((val) => val?.trim()),
    campus: z
        .string()
        .optional()
        .refine((val) => !val || val.trim().length > 0, {
            message: "Campus não pode ser vazio",
        })
        .transform((val) => val?.trim()),
    bloco: z
        .string()
        .optional()
        .refine((val) => !val || val.trim().length > 0, {
            message: "Bloco não pode ser vazio",
        })
        .transform((val) => val?.trim()),
    page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .refine((val) => Number.isInteger(val) && val > 0, {
            message: "Page deve ser um número inteiro maior que 0",
        }),
    limite: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 10))
        .refine((val) => Number.isInteger(val) && val > 0 && val <= 100, {
            message: "Limite deve ser um número inteiro entre 1 e 100",
        }),
});
