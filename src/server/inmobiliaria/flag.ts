/** Solo el literal true habilita el módulo; no depende de validar secretos. */
export function parseRealEstateFlag(valor: string | undefined): boolean {
  return valor === "true";
}
export function inmobiliariaActiva(): boolean {
  return parseRealEstateFlag(process.env.FEATURE_REAL_ESTATE);
}
export function exigirInmobiliaria(): void {
  if (!inmobiliariaActiva()) throw new ErrorInmobiliario(404, "Módulo no disponible");
}
export class ErrorInmobiliario extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje); }
}
