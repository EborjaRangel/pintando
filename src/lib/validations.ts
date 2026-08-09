import * as Yup from "yup";
import { COLONIAS_COYOACAN } from "@/lib/colonias";
import { parseColors } from "@/lib/paleta-colores";

export const loginSchema = Yup.object({
  email: Yup.string().email("Correo inválido").required("El correo es obligatorio"),
  password: Yup.string().min(6, "Mínimo 6 caracteres").required("La contraseña es obligatoria"),
});

export const registerSchema = Yup.object({
  name: Yup.string().min(2, "Mínimo 2 caracteres").required("El nombre es obligatorio"),
  email: Yup.string().email("Correo inválido").required("El correo es obligatorio"),
  password: Yup.string().min(6, "Mínimo 6 caracteres").required("La contraseña es obligatoria"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Las contraseñas no coinciden")
    .required("Confirma tu contraseña"),
});

export const houseSchema = Yup.object({
  address: Yup.string().min(5, "Escribe una dirección válida").required("La dirección es obligatoria"),
  colonia: Yup.string()
    .oneOf([...COLONIAS_COYOACAN], "Selecciona una colonia de Coyoacán")
    .required("La colonia es obligatoria"),
  latitude: Yup.number()
    .min(19.25, "Latitud fuera de Coyoacán")
    .max(19.4, "Latitud fuera de Coyoacán")
    .required("La latitud es obligatoria"),
  longitude: Yup.number()
    .min(-99.25, "Longitud fuera de Coyoacán")
    .max(-99.05, "Longitud fuera de Coyoacán")
    .required("La longitud es obligatoria"),
  notes: Yup.string()
    .required("Selecciona al menos un color")
    .test(
      "colores-paleta",
      "Elige entre 1 y 4 colores de la paleta",
      (value) => {
        const colors = parseColors(value);
        return colors.length >= 1 && colors.length <= 4;
      }
    ),
  expedienteCompleto: Yup.boolean().required(),
});

export const userAdminSchema = Yup.object({
  name: Yup.string().min(2).required("El nombre es obligatorio"),
  email: Yup.string().email().required("El correo es obligatorio"),
  password: Yup.string().min(6).required("La contraseña es obligatoria"),
  role: Yup.mixed<"USER" | "AUTORIZACION" | "ADMIN">()
    .oneOf(["USER", "AUTORIZACION", "ADMIN"])
    .required(),
});
